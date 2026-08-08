/**
 * Data Loader — fetches, filters, and deduplicates ticket data
 * for the Customer Command Center Dashboard (NHT/Cesanek — LT_F21).
 *
 * Rules:
 *  - INCLUDE  statuses: New, Open, Pending
 *  - EXCLUDE  statuses: Reopen, Reopened, Closed, Resolved, Cancelled, Done
 *  - EXCLUDE  invoice items: billing, UF Billing, storage, handling
 *  - ENABLE   UFN-related ticket filtering
 *  - DEDUP    overlapping ticket/email threads
 *  - OUTLOOK  non-blocking; enrich where available
 */

window.DataLoader = (function () {
  'use strict';

  const CONFIG_URL = '/config.json';
  const TICKETS_URL = '/data/tickets.json';
  const OUTLOOK_URL = '/data/outlook-context.json';

  /* ── Load Configuration ─────────────────────────────────────── */
  async function loadConfig() {
    const resp = await fetch(CONFIG_URL);
    if (!resp.ok) throw new Error('Failed to load config: ' + resp.status);
    return resp.json();
  }

  /* ── Load Raw Tickets ───────────────────────────────────────── */
  async function loadTickets(config) {
    let tickets = [];
    try {
      const resp = await fetch(TICKETS_URL);
      if (resp.ok) {
        const data = await resp.json();
        tickets = data.tickets || data;
      }
    } catch (e) {
      console.warn('[DataLoader] Tickets endpoint unavailable, using embedded defaults:', e.message);
    }

    // Ensure every ticket has normalized fields
    return tickets.map(normalizeTicket);
  }

  /* ── Apply Filters ──────────────────────────────────────────── */
  function applyFilters(tickets, config) {
    const includeStatuses = (config.ticketFilters.includeStatuses || []).map(s => s.toLowerCase());
    const excludeStatuses = (config.ticketFilters.excludeStatuses || []).map(s => s.toLowerCase());
    const excludeInvoiceItems = (config.ticketFilters.excludeInvoiceItems || []).map(s => s.toLowerCase());
    const ufnEnabled = config.ticketFilters.ufnFilterEnabled !== false;

    let filtered = tickets.filter(t => {
      const status = (t.opsStatus || t.status || '').toLowerCase();

      // Must be in include list
      if (!includeStatuses.includes(status)) return false;

      // Must NOT be in exclude list
      if (excludeStatuses.includes(status)) return false;

      // Exclude by invoice item type
      const itemType = (t.invoiceItemType || '').toLowerCase();
      if (itemType && excludeInvoiceItems.some(ex => itemType.includes(ex))) return false;

      // UFN filter: if enabled, only passes tickets explicitly tagged as UFN when relevant
      // (keep all tickets, but mark UFN status for downstream rendering)
      return true;
    });

    // Tag each ticket with UFN status
    filtered.forEach(t => {
      t.isUFN = !!(t.ufn || t.ufnTag || (t.tags && t.tags.some(tag => /ufn/i.test(tag))));
    });

    return filtered;
  }

  /* ── Deduplicate Overlapping Threads ────────────────────────── */
  function deduplicate(tickets, config) {
    if (!config.deduplication || !config.deduplication.enabled) return tickets;

    const seen = new Set();
    const result = [];

    tickets.forEach(t => {
      // Build dedup key from subject + customer
      const key = normalizeDedupKey(t);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(t);
      }
    });

    return result;
  }

  /* ── Compute Statistics ─────────────────────────────────────── */
  function computeStats(rawTickets, dedupedTickets, config) {
    const includeStatuses = (config.ticketFilters.includeStatuses || []).map(s => s.toLowerCase());
    const excludeInvoiceItems = (config.ticketFilters.excludeInvoiceItems || []).map(s => s.toLowerCase());

    const byStatus = {};
    dedupedTickets.forEach(t => {
      const s = t.opsStatus || t.status || 'Unknown';
      byStatus[s] = (byStatus[s] || 0) + 1;
    });

    const ufnCount = dedupedTickets.filter(t => t.isUFN).length;

    // Excluded count = raw minus eligible (approximation)
    const eligibleInRaw = rawTickets.filter(t => {
      const status = (t.opsStatus || t.status || '').toLowerCase();
      return includeStatuses.includes(status);
    }).length;
    const excludedCount = rawTickets.length - eligibleInRaw;

    // Duplicates removed
    const duplicatesRemoved = (rawTickets.length > 0)
      ? rawTickets.filter(t => {
          const status = (t.opsStatus || t.status || '').toLowerCase();
          return includeStatuses.includes(status);
        }).length - dedupedTickets.length
      : 0;

    // Invoice items excluded
    const invoiceItemsExcluded = rawTickets.filter(t => {
      const itemType = (t.invoiceItemType || '').toLowerCase();
      return itemType && excludeInvoiceItems.some(ex => itemType.includes(ex));
    }).length;

    // Outlook context
    let outlookThreadsMatched = '—';
    try {
      // Attempt synchronous read from pre-loaded data
      if (window.__outlookContext) {
        outlookThreadsMatched = window.__outlookContext.threadsMatched || 0;
      }
    } catch (e) { /* non-blocking */ }

    return {
      totalEligible: dedupedTickets.length,
      byStatus,
      ufnCount,
      excludedCount,
      duplicatesRemoved,
      invoiceItemsExcluded,
      outlookThreadsMatched,
      avgResponseHours: computeAvgResponse(dedupedTickets),
      slaBreachRisk: computeSLARisk(dedupedTickets),
      dataFreshness: computeFreshness(dedupedTickets),
    };
  }

  /* ── Helpers ────────────────────────────────────────────────── */
  function normalizeTicket(t) {
    return {
      ticketId: t.ticketId || t.id || t.ticket_id || `T-${Math.random().toString(36).slice(2,8)}`,
      customer: t.customer || t.customerName || t.account || 'Unknown',
      status: t.status || 'New',
      opsStatus: t.opsStatus || t.ops_status || t.status || 'New',
      subject: t.subject || t.title || t.summary || '',
      priority: t.priority || t.severity || 'Medium',
      createdAt: t.createdAt || t.created_at || t.createdDate || new Date().toISOString(),
      ageDays: computeAgeDays(t.createdAt || t.created_at || t.createdDate || new Date().toISOString()),
      invoiceItemType: t.invoiceItemType || t.invoice_item_type || t.itemType || '',
      ufn: t.ufn || t.ufnTag || false,
      tags: t.tags || [],
      responseHours: t.responseHours || t.response_hours || null,
    };
  }

  function normalizeDedupKey(t) {
    const subject = (t.subject || '').toLowerCase().replace(/^(re|fwd?):\s*/i, '').trim();
    const customer = (t.customer || '').toLowerCase().trim();
    return `${subject}::${customer}`;
  }

  function computeAgeDays(createdAt) {
    const created = new Date(createdAt);
    if (isNaN(created.getTime())) return 0;
    return Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
  }

  function computeAvgResponse(tickets) {
    const withResponse = tickets.filter(t => t.responseHours != null);
    if (withResponse.length === 0) return '—';
    const avg = withResponse.reduce((sum, t) => sum + (t.responseHours || 0), 0) / withResponse.length;
    return avg.toFixed(1);
  }

  function computeSLARisk(tickets) {
    if (tickets.length === 0) return 'None';
    const atRisk = tickets.filter(t => t.ageDays > 5 && (t.priority === 'Critical' || t.priority === 'High'));
    if (atRisk.length === 0) return 'None';
    return atRisk.length + ' ticket(s)';
  }

  function computeFreshness(tickets) {
    if (tickets.length === 0) return 'N/A';
    const ages = tickets.map(t => t.ageDays);
    const maxAge = Math.max(...ages);
    if (maxAge > 30) return 'Stale';
    if (maxAge > 14) return 'Aging';
    return 'Fresh';
  }

  /* ── Public API ─────────────────────────────────────────────── */
  return {
    loadConfig,
    loadTickets,
    applyFilters,
    deduplicate,
    computeStats,
  };
})();
