/* web-ai-search / ai_toggles.js
 * Turn on web search and pick a thinking level, the way a human clicks the composer.
 * Requires ai_lib.js injected on this page. Optional input:
 *   window.__WAI_OPTS__ = { web: true, thinking: 'high'|'medium'|'low'|'off', dryRun: false }
 * Call with evaluate_script { sourcePath: ..., format: 'function', waitForStableDom: false }
 * Always review the returned actions/candidates; fall back to take_snapshot + click(uid)
 * when the UI is a menu, a switch or a custom popup that the heuristics could not open.
 */
async () => {
  const W = window.__WAI__;
  if (!W) return { error: 'ai_lib.js not injected (re-inject after every navigation).' };
  const opts = Object.assign({ web: true, thinking: 'high', dryRun: false }, window.__WAI_OPTS__ || {});
  const actions = [];
  const ed = W.editor();
  const near = () => W.controls().filter(c => W.nearComposer(c, ed));
  const isOn = c => c.pressed === 'true' || c.state === 'true' ||
    /^(active|selected|checked|enabled|on)$/i.test(c.state || '') ||
    /\b(active|selected|checked|enabled|is-on|toggle-on)\b/i.test(String(c.e.className || ''));
  const click = (c, tag) => {
    if (opts.dryRun) { actions.push({ tag, wouldClick: c.text.slice(0, 80) }); return; }
    W.humanClick(c.e);
    actions.push({ tag, clicked: c.text.slice(0, 80) });
  };
  const LEVELS = {
    high: /深度|进阶|加强|高强度|high|max|extended|think harder|pro\b|long|r1|深度研究/i,
    medium: /中档|标准|适中|medium|standard|balanced|default/i,
    low: /快速|轻量|简短|低|low|instant|fast|brief|flash|auto/i,
    off: /关闭|不使用|关|off|none|no thinking|禁用/i,
  };
  const wanted = LEVELS[opts.thinking] || LEVELS.high;
  const webWords = (W.profile.web || []).concat(['联网', '搜索网页', 'web search', 'search the web', 'search']);

  // 1) Web search: prefer an exact composer toggle, then a menu item behind a "+" / tools button.
  let webState = 'not-found';
  const webExact = near().filter(c => webWords.some(k => c.text.toLowerCase().includes(String(k).toLowerCase())) && !/新建|新对话|历史/.test(c.text));
  if (webExact.length) {
    const already = webExact.find(isOn);
    if (already) webState = 'already-on';
    else {
      click(webExact[0], 'web-toggle');
      await W.sleep(400);
      const menu = W.menuItems().filter(c => W.RE.WEB_RE.test(c.text) && !isOn(c));
      if (menu.length) { click(menu[0], 'web-menu-item'); webState = 'clicked-menu-item'; }
      else if (!opts.dryRun && isOn(webExact[0])) webState = 'toggled-on';
      else webState = 'clicked-toggle-verify';
    }
  } else {
    const plus = near().filter(c => /添加|更多|工具|插件|技能|\+|plus|tools|attach/i.test(c.text));
    for (const c of plus.slice(0, 2)) {
      click(c, 'open-tools-menu');
      await W.sleep(400);
      const menu = W.menuItems().filter(m => W.RE.WEB_RE.test(m.text));
      if (menu.length) { click(menu[0], 'web-menu-item'); webState = 'clicked-menu-item'; break; }
    }
  }

  // 2) Thinking level: open the Think/Reasoning control and choose the wanted level.
  let thinkState = 'not-found';
  const thinkBtn = near().find(c => W.RE.THINK_RE.test(c.text) && !/sidebar|侧栏/i.test(String(c.e.className || '')));
  if (thinkBtn) {
    if (isOn(thinkBtn) && wanted.test(thinkBtn.text)) thinkState = 'already-at-target';
    else {
      click(thinkBtn, 'think-toggle');
      await W.sleep(450);
      const items = W.menuItems().filter(c => wanted.test(c.text) || W.RE.THINK_RE.test(c.text));
      const target = items.find(c => wanted.test(c.text));
      if (target) { click(target, 'think-level'); thinkState = 'selected-level'; }
      else if (items.length) { click(items[items.length - 1], 'think-fallback'); thinkState = 'selected-fallback'; }
      else if (!opts.dryRun && isOn(thinkBtn)) thinkState = 'toggled-on';
      else thinkState = 'clicked-toggle-verify';
    }
  }

  const after = near().map(c => W.describe(c, false)).slice(-25);
  return {
    site: W.id, url: location.href, dryRun: !!opts.dryRun,
    requested: { web: opts.web, thinking: opts.thinking },
    result: { web: webState, thinking: thinkState }, actions,
    composerControlsAfter: after,
    webCandidates: near().filter(c => W.RE.WEB_RE.test(c.text)).map(c => W.describe(c, true)),
    thinkCandidates: near().filter(c => W.RE.THINK_RE.test(c.text)).map(c => W.describe(c, true)),
    note: 'States ending in "verify" or "not-found" require take_snapshot + click(uid) by the agent.',
  };
}
