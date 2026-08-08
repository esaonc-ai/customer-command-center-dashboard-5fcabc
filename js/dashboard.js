/**
 * Customer Command Center Dashboard — NHT/Cesanek (LT_F21)
 * Core dashboard orchestration: wires data, rendering, and periodic refresh.
 */

(function () {
  'use strict';

  const REFRESH_MS = 15 * 60 * 1000;
  let refreshTimer = null;

  /* ── Bootstrap ──────────────────────────────────────────────── */
  async function init() {
    console.log('[CCC] Initializing Customer Command Center — NHT/Cesanek');
    document.getElementById('lastRefresh').textContent = 'Refreshing…';
    await refreshAll();
    refreshTimer = setInterval(refreshAll, REFRESH_MS);
    console.log('[CCC] Auto-refresh scheduled every', REFRESH_MS / 60000, 'min');
  }

  async function refreshAll() {
    try {
      const config = await DataLoader.loadConfig();
      const rawTickets = await DataLoader.loadTickets(config);
      const filteredTickets = DataLoader.applyFilters(rawTickets, config);
      const dedupedTickets = DataLoader.deduplicate(filteredTickets, config);

      const stats = DataLoader.computeStats(rawTickets, dedupedTickets, config);

      renderCounts(stats);
      renderPriorityQueue(dedupedTickets);
      renderActionBuckets(dedupedTickets);
      renderCustomerHealth(dedupedTickets, config);
      renderEvidenceMetrics(stats);

      const now = new Date();
      document.getElementById('lastRefresh').textContent =
        'Last refreshed: ' + now.toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
    } catch (err) {
      console.error('[CCC] Refresh failed:', err);
      document.getElementById('lastRefresh').textContent = 'Refresh failed — check console';
    }
  }

  /* ── Render: Counts ─────────────────────────────────────────── */
  function renderCounts(stats) {
    document.getElementById('countTotal').textContent = stats.totalEligible;
    document.getElementById('countNew').textContent = stats.byStatus.New || 0;
    document.getElementById('countOpen').textContent = stats.byStatus.Open || 0;
    document.getElementById('countPending').textContent = stats.byStatus.Pending || 0;
    document.getElementById('countUFN').textContent = stats.ufnCount;
    document.getElementById('countExcluded').textContent = stats.excludedCount;
  }

  /* ── Render: Priority Queue ─────────────────────────────────── */
  function renderPriorityQueue(tickets) {
    const tbody = document.getElementById('priorityQueueBody');
    const sorted = [...tickets].sort((a, b) => {
      const prio = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      return (prio[a.priority] ?? 99) - (prio[b.priority] ?? 99) || a.ageDays - b.ageDays;
    });

    if (sorted.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading">No eligible tickets in queue.</td></tr>';
      return;
    }

    tbody.innerHTML = sorted.slice(0, 50).map(t => `
      <tr>
        <td><span class="ticket-id">${esc(t.ticketId)}</span></td>
        <td>${esc(t.customer)}</td>
        <td><span class="badge badge-${t.status.toLowerCase()}">${esc(t.status)}</span></td>
        <td>${esc(t.priority || '—')}</td>
        <td>${t.ageDays}</td>
        <td>${esc(truncate(t.subject, 60))}</td>
        <td>${t.isUFN ? '<span class="badge badge-ufn">UFN</span>' : '—'}</td>
      </tr>
    `).join('');
  }

  /* ── Render: Action Buckets ─────────────────────────────────── */
  function renderActionBuckets(tickets) {
    const now = Date.now();
    const immediate = [], short = [], medium = [], watch = [];

    tickets.forEach(t => {
      const ageMs = now - new Date(t.createdAt).getTime();
      const ageH = ageMs / (1000 * 60 * 60);
      if (ageH < 24) immediate.push(t);
      else if (ageH < 72) short.push(t);
      else if (ageH < 168) medium.push(t);
      else watch.push(t);
    });

    renderBucket('bucketImmediateList', immediate);
    renderBucket('bucketShortList', short);
    renderBucket('bucketMediumList', medium);
    renderBucket('bucketWatchList', watch);
  }

  function renderBucket(listId, tickets) {
    const ul = document.getElementById(listId);
    if (tickets.length === 0) {
      ul.innerHTML = '<li>— None —</li>';
      return;
    }
    ul.innerHTML = tickets.map(t =>
      `<li><span class="ticket-id">${esc(t.ticketId)}</span> — ${esc(t.customer)} (${t.ageDays}d, ${esc(t.priority || 'N/A')})${t.isUFN ? ' 🔴UFN' : ''}</li>`
    ).join('');
  }

  /* ── Render: Customer Health ────────────────────────────────── */
  function renderCustomerHealth(tickets, config) {
    const tbody = document.getElementById('customerHealthBody');
    const byCustomer = {};

    tickets.forEach(t => {
      const c = t.customer || 'Unknown';
      if (!byCustomer[c]) byCustomer[c] = { total: 0, old: 0, ufn: 0 };
      byCustomer[c].total++;
      if (t.ageDays > 7) byCustomer[c].old++;
      if (t.isUFN) byCustomer[c].ufn++;
    });

    const entries = Object.entries(byCustomer).sort((a, b) => b[1].total - a[1].total);

    if (entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading">No customer data available.</td></tr>';
      return;
    }

    tbody.innerHTML = entries.map(([name, data]) => {
      const ratio = data.total > 0 ? data.old / data.total : 0;
      let health, healthClass;
      if (ratio >= 0.5 || data.ufn >= 3) { health = 'Critical'; healthClass = 'health-critical'; }
      else if (ratio >= 0.25 || data.ufn >= 1) { health = 'Warning'; healthClass = 'health-warning'; }
      else { health = 'Healthy'; healthClass = 'health-healthy'; }

      return `
        <tr>
          <td>${esc(name)}</td>
          <td>${data.total}</td>
          <td>${data.old}</td>
          <td>${data.ufn}</td>
          <td><span class="${healthClass}">${health}</span></td>
          <td>—</td>
        </tr>
      `;
    }).join('');
  }

  /* ── Render: Evidence Metrics ───────────────────────────────── */
  function renderEvidenceMetrics(stats) {
    document.getElementById('metricOutlookMatched').textContent = stats.outlookThreadsMatched ?? '—';
    document.getElementById('metricDupesRemoved').textContent = stats.duplicatesRemoved ?? 0;
    document.getElementById('metricInvoiceExcluded').textContent = stats.invoiceItemsExcluded ?? 0;
    document.getElementById('metricAvgResponse').textContent = stats.avgResponseHours ?? '—';
    document.getElementById('metricSLARisk').textContent = stats.slaBreachRisk ?? '—';
    document.getElementById('metricFreshness').textContent = stats.dataFreshness ?? '—';
  }

  /* ── Helpers ────────────────────────────────────────────────── */
  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function truncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  /* ── Start ──────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
