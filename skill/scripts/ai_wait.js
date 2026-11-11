/* web-ai-search / ai_wait.js
 * Wait until the streaming answer has finished, then return the final reply text.
 * Requires ai_lib.js injected on this page. Re-entrant: call again when done=false;
 * the stability clock is kept in window.__WAI_STATE__ across calls (ai_send.js resets it).
 * Optional: window.__WAI_OPTS__ = { maxMs: 18000, stableMs: 2200, interval: 500,
 *                                  minChars: 2, hardTimeoutMs: 180000 }
 * Call with evaluate_script { sourcePath: ..., format: 'function', waitForStableDom: false }
 * Keep maxMs <= ~20000 per call to stay below the MCP/CDP request timeout.
 */
async () => {
  const W = window.__WAI__;
  if (!W) return { error: 'ai_lib.js not injected (re-inject after every navigation).' };
  const o = Object.assign(
    { maxMs: 18000, stableMs: 2200, interval: 500, minChars: 2, hardTimeoutMs: 180000 },
    window.__WAI_OPTS__ || {}
  );
  const st = window.__WAI_STATE__ || (window.__WAI_STATE__ = {
    start: Date.now(), last: '', stableSince: Date.now(), polls: 0, sawStreaming: false, maxChars: 0,
  });
  const t0 = Date.now();
  let snap = null;
  while (Date.now() - t0 < o.maxMs) {
    const r = W.reply();
    const s = W.streaming();
    const finishes = W.finishControls();
    if (s.value) st.sawStreaming = true;
    if (r.text !== st.last) { st.last = r.text; st.stableSince = Date.now(); }
    st.maxChars = Math.max(st.maxChars, r.chars);
    st.polls++;
    const stableMs = Date.now() - st.stableSince;
    const hasContent = r.chars >= o.minChars;
    const evidence = st.sawStreaming || finishes.length > 0 || stableMs >= o.stableMs * 2;
    const done = !s.value && hasContent && evidence && stableMs >= o.stableMs;
    const expired = Date.now() - st.start > o.hardTimeoutMs;
    snap = { r, s, stableMs, finishes };
    if (done || expired) {
      return {
        done, reason: expired ? 'hard-timeout' : 'stream-finished',
        site: W.id, url: location.href,
        elapsedMs: Date.now() - st.start, stableMs, polls: st.polls,
        sawStreaming: st.sawStreaming, maxChars: st.maxChars,
        streaming: s, finishControls: finishes,
        reply: { text: r.text, chars: r.chars, selector: r.selector, sources: r.sources },
        note: done ? 'Final answer captured. Cross-check with ai_reply.js if needed.' : 'Timed out; verify the page manually.',
      };
    }
    await W.sleep(o.interval);
  }
  return {
    done: false, reason: 'poll-budget-exhausted', site: W.id, url: location.href,
    elapsedMs: Date.now() - st.start,
    stableMs: snap ? snap.stableMs : 0, polls: st.polls, sawStreaming: st.sawStreaming,
    streaming: snap ? snap.s : W.streaming(),
    reply: { text: snap ? snap.r.text : '', chars: snap ? snap.r.chars : 0, sources: snap ? snap.r.sources : [] },
    note: 'Call ai_wait.js again (the stability state is preserved). Stop after ~10 calls / 3 minutes.',
  };
}
