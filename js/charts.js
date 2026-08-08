/**
 * Charts & Outlook Integration — Non-blocking Outlook context loader
 * for the Customer Command Center Dashboard.
 */

(function () {
  'use strict';

  const OUTLOOK_URL = '/data/outlook-context.json';

  async function loadOutlookContext() {
    try {
      const resp = await fetch(OUTLOOK_URL);
      if (resp.ok) {
        const ctx = await resp.json();
        window.__outlookContext = ctx;
        console.log('[Outlook] Context loaded:', ctx.threadsMatched || 0, 'threads matched');
      }
    } catch (e) {
      console.log('[Outlook] No context available (non-blocking)');
      window.__outlookContext = { threadsMatched: 0 };
    }
  }

  // Load on startup, non-blocking
  loadOutlookContext();
})();
