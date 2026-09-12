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

  async function loadOutlook() {
    try {
      const resp = await fetch(OUTLOOK_URL);
      if (!resp.ok) return { integrationStatus: 'pending', outlookAvailable: false };
      return resp.json();
    } catch (e) {
      return { integrationStatus: 'pending', outlookAvailable: false };
    }
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
    const authoritativeGate = config.ticketFilters.authoritativeGate || {};
    const requiredSystemStatus = authoritativeGate.displayStatusSystemStatus ?? 10;
    const includeStatuses = (authoritativeGate.displayStatusNames || ['New', 'Pending']).map(s => s.toLowerCase());
    const excludeStatuses = (config.ticketFilters.excludeStatuses || []).map(s => s.toLowerCase());
    const excludeInvoiceItems = (config.ticketFilters.excludeInvoiceItems || []).map(s => s.toLowerCase());
    const ufnEnabled = config.ticketFilters.ufnFilterEnabled !== false;

    let filtered = tickets.filter(t => {
      const status = (t.displayStatusName || t.opsStatus || t.status || '').toLowerCase();
      const systemStatus = t.displayStatusSystemStatus;

      // Ticket Ops system/display status is the complete eligibility gate.
      if (systemStatus !== requiredSystemStatus) return false;

      // Must be in include list
      if (!includeStatuses.includes(status)) return false;

      // Must NOT be in exclude list
      if (excludeStatuses.includes(status)) return false;

      // Exclude by invoice item type
      const itemType = (t.invoiceItemType || '').toLowerCase();
      if (itemType && excludeInvoiceItems.some(ex => itemType.includes(ex))) return false;

      if (ufnEnabled && !/^UFN-/i.test(t.ticketId || '')) return false;

      // closeFlag is intentionally evidence-only and never gates eligibility.
      return true;
    });

    // Tag each ticket with UFN status
    filtered.forEach(t => {
      t.isUFN = /^UFN-/i.test(t.ticketId || '') || !!(t.ufn || t.ufnTag || (t.tags && t.tags.some(tag => /ufn/i.test(tag))));
    });

    return filtered;
  }

  /* ── Deduplicate Overlapping Threads ────────────────────────── */
  function deduplicate(tickets, config) {
    if (!config.deduplication || !config.deduplication.enabled) return tickets;

    const seen = new Set();
    const result = [];

    tickets.forEach(t => {
      // Only a source-backed conversation identifier may collapse records.
      if (!t.conversationId) {
        result.push(t);
        return;
      }
      if (seen.has(t.conversationId)) return;
      seen.add(t.conversationId);
      result.push(t);
    });

    return result;
  }

  /* ── Compute Statistics ─────────────────────────────────────── */
  function computeStats(rawTickets, dedupedTickets, config, outlookContext) {
    const snapshot = config.snapshotMetrics || {};

    const byStatus = {};
    dedupedTickets.forEach(t => {
      const s = t.opsStatus || t.status || 'Unknown';
      byStatus[s] = (byStatus[s] || 0) + 1;
    });

    const ufnCount = dedupedTickets.filter(t => t.isUFN).length;

    const excludedCount = snapshot.excludedCount ?? 0;
    const duplicatesRemoved = snapshot.duplicatesRemoved ?? 0;
    const invoiceItemsExcluded = snapshot.invoiceItemsExcluded ?? 0;
    const outlookThreadsMatched = outlookContext?.outlookAvailable
      ? (outlookContext.threadsMatched ?? 0)
      : 'Pending';

    return {
      totalEligible: snapshot.totalEligible ?? dedupedTickets.length,
      byStatus,
      ufnCount,
      excludedCount,
      duplicatesRemoved,
      invoiceItemsExcluded,
      outlookThreadsMatched,
      avgResponseHours: computeAvgResponse(dedupedTickets),
      slaBreachRisk: computeSLARisk(dedupedTickets),
      dataFreshness: computeFreshness(snapshot.refreshedAt),
    };
  }

  /* ── Helpers ────────────────────────────────────────────────── */
  function normalizeTicket(t) {
    return {
      ticketId: t.ticketId || t.id || t.ticket_id || null,
      customer: t.customer || t.customerName || t.account || 'Customer not listed',
      status: t.displayStatusName || t.status || '',
      opsStatus: t.displayStatusName || t.opsStatus || t.ops_status || t.status || '',
      displayStatusName: t.displayStatusName || t.opsStatus || t.status || '',
      displayStatusSystemStatus: t.displayStatusSystemStatus,
      subject: t.subject || t.title || t.summary || '',
      priority: t.priority || t.severity || null,
      createdAt: t.createdAt || t.created_at || t.createdDate || null,
      ageDays: t.ageDays ?? computeAgeDays(t.createdAt || t.created_at || t.createdDate),
      ageHours: t.ageHours ?? null,
      dueDate: t.dueDate || null,
      slaStatus: t.slaStatus || null,
      closeFlag: t.closeFlag === true,
      conversationId: t.conversationId || null,
      invoiceItemType: t.invoiceItemType || t.invoice_item_type || t.itemType || '',
      ufn: t.ufn || t.ufnTag || false,
      tags: t.tags || [],
      responseHours: t.responseHours || t.response_hours || null,
    };
  }

  function computeAgeDays(createdAt) {
    if (!createdAt) return null;
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
    const atRisk = tickets.filter(t => t.slaStatus === 'Breached');
    return atRisk.length === 0 ? 'None' : atRisk.length + ' tickets';
  }

  function computeFreshness(refreshedAt) {
    if (!refreshedAt) return 'Pending';
    const ageMinutes = (Date.now() - new Date(refreshedAt).getTime()) / 60000;
    if (!Number.isFinite(ageMinutes)) return 'Pending';
    if (ageMinutes > 120) return 'Refresh due';
    return 'Current';
  }

  /* ── Public API ─────────────────────────────────────────────── */
  return {
    loadConfig,
    loadOutlook,
    loadTickets,
    applyFilters,
    deduplicate,
    computeStats,
  };
})();
