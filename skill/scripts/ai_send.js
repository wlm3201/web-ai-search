/* web-ai-search / ai_send.js
 * Fallback "type and send" tool. Preferred path is native MCP: fill(uid, text) / type_text
 * + press_key("Enter"). Use this script when the native path fails (ProseMirror /
 * contenteditable state not updating, long multi-line prompt, no textbox uid).
 * Setup before calling:
 *   window.__WAI_TEXT__ = "the full prompt"
 *   window.__WAI_OPTS__ = { send: true }   // set send:false to only fill the editor
 * Requires ai_lib.js injected on this page. Resets the streaming-wait state.
 * Call with evaluate_script { sourcePath: ..., format: 'function', waitForStableDom: false }
 */
async () => {
  const W = window.__WAI__;
  if (!W) return { error: 'ai_lib.js not injected (re-inject after every navigation).' };
  const txt = window.__WAI_TEXT__ || '';
  if (!txt) return { error: 'window.__WAI_TEXT__ is empty. Set the full prompt first.' };
  const opts = Object.assign({ send: true }, window.__WAI_OPTS__ || {});
  const challenge = W.cf();
  if (challenge.challenge) return { error: 'Cloudflare challenge still on screen; clear it first.', challenge };
  const ed = W.editor();
  if (!ed) return { error: 'No visible editor found; check login state and page load.', login: W.loginHint() };

  delete window.__WAI_STATE__;
  const before = W.reply().chars;
  W.humanClick(ed);
  ed.focus();
  const how = W.setEditorText(ed, txt);
  await W.sleep(250);
  const inEditor = W.clean(ed.innerText || ed.value || '');
  const ok = inEditor.slice(0, 80) === txt.slice(0, 80);
  let sent = null;
  if (opts.send && ok) sent = W.send(ed);
  await W.sleep(700);
  return {
    site: W.id, url: location.href, typedChars: txt.length, method: how,
    editorMatchesPrompt: ok, editorPreview: inEditor.slice(0, 120),
    sent: sent || (opts.send ? null : 'skipped-by-option'),
    replyCharsBefore: before, streaming: W.streaming(),
    note: 'If sent.via="synthetic-enter" and nothing happened, call MCP press_key("Enter"). Next: ai_wait.js.',
  };
}
