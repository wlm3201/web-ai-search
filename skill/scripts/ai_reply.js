/* web-ai-search / ai_reply.js
 * Read the last assistant answer from the current page (no waiting).
 * Requires ai_lib.js injected on this page.
 * Call with evaluate_script { sourcePath: ..., format: 'function', waitForStableDom: false }
 * For long answers, pass filePath to evaluate_script so the JSON is written to disk
 * instead of flooding the conversation context.
 */
() => {
  const W = window.__WAI__;
  if (!W) return { error: 'ai_lib.js not injected (re-inject after every navigation).' };
  const r = W.reply();
  return {
    site: W.id, url: location.href, title: document.title,
    capturedAt: new Date().toISOString(),
    cloudflare: W.cf(), streaming: W.streaming(), finishControls: W.finishControls(),
    reply: { text: r.text, chars: r.chars, selector: r.selector, nodeCount: r.nodeCount, sources: r.sources },
    note: 'reply.text is plain text (line breaks kept). sources are http links found inside the answer container.',
  };
}
