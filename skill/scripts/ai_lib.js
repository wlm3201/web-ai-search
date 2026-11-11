/* web-ai-search / ai_lib.js
 * Inject once per page (evaluate_script with sourcePath, default format "function").
 * Installs window.__WAI__ (site profile + DOM helpers) and returns a compact diagnosis.
 * Re-inject after every navigation / reload: window is recreated on navigation.
 */
() => {
  const PROFILES = [
    { id: 'doubao', host: 'doubao.com', editor: '[contenteditable="true"].tiptap, .ProseMirror[contenteditable="true"]', web: ['联网', '搜索', '自动联网'], think: ['深度思考', '思考', '深度'], reply: ['[class*="message-content"]', '[class*="markdown"]', '[data-testid*="message"]'], newChat: 'https://www.doubao.com/chat/' },
    { id: 'stepfun', host: 'stepfun.com', editor: '[contenteditable="true"],textarea', web: ['联网', '搜索'], think: ['深度思考', '思考'], reply: ['[class*="message"]', '[class*="markdown"]', 'article'], newChat: 'https://www.stepfun.com/chats/new' },
    { id: 'chatgpt', host: 'chatgpt.com', editor: '.ProseMirror[contenteditable="true"],[contenteditable="true"]', web: ['搜索网页', 'Search the web', '网页搜索', '联网', '搜索'], think: ['思考', 'Thinking', 'Reasoning', '推理'], reply: ['[data-message-author-role="assistant"]', '[class*="markdown"]', '[data-testid*="message"]'], newChat: 'https://chatgpt.com/' },
    { id: 'deepseek', host: 'deepseek.com', editor: 'textarea,[contenteditable="true"]', web: ['联网搜索', '联网', '搜索'], think: ['深度思考', 'R1', '思考'], reply: ['[class*="markdown"]', '[class*="message"]', '[class*="answer"]'], newChat: 'https://chat.deepseek.com/' },
    { id: 'gemini', host: 'gemini.google.com', editor: '[contenteditable="true"],textarea', web: ['联网', 'Google 搜索', 'Search', '工具'], think: ['思考', 'Thinking', 'Pro', '推理'], reply: ['[class*="markdown"]', '[class*="response"]', '[class*="message"]', 'article'], newChat: 'https://gemini.google.com/app' },
    { id: 'grok', host: 'grok.com', editor: '[contenteditable="true"],textarea', web: ['联网', '搜索', 'Web', 'Search', 'DeepSearch'], think: ['Think', '思考', 'Big Brain', '推理'], reply: ['[class*="markdown"]', '[class*="message"]', 'article'], newChat: 'https://grok.com/' },
    { id: 'kimi', host: 'kimi.com', editor: '[contenteditable="true"].chat-input-editor,[contenteditable="true"]', web: ['联网', '搜索', '插件'], think: ['进阶', '快速', '深度', '思考'], reply: ['[class*="message"]', '[class*="markdown"]', '[class*="answer"]'], newChat: 'https://www.kimi.com/?chat_enter_method=new_chat' },
    { id: 'perplexity', host: 'perplexity.ai', editor: 'textarea,[contenteditable="true"]', web: ['联网', '搜索', 'Search', 'Focus'], think: ['Research', 'Deep Research', '推理', 'Pro'], reply: ['[class*="answer"]', '[class*="markdown"]', '[class*="prose"]', 'article'], newChat: 'https://www.perplexity.ai/' },
    { id: 'qwen', host: 'qwen.ai', editor: '[contenteditable="true"],textarea', web: ['联网', '搜索', '网页'], think: ['思考', '深度思考', '推理'], reply: ['[class*="markdown"]', '[class*="message"]', '[class*="answer"]'], newChat: 'https://chat.qwen.ai/' },
    { id: 'mimo', host: 'xiaomimimo.com', editor: 'textarea,[contenteditable="true"]', web: ['联网', '搜索'], think: ['思考', '推理'], reply: ['[class*="markdown"]', '[class*="message"]', 'article'], newChat: 'https://aistudio.xiaomimimo.com/#/' },
    { id: 'zai', host: 'chat.z.ai', editor: 'textarea,[contenteditable="true"]', web: ['联网', '搜索', 'Search'], think: ['思考', '推理', 'GLM'], reply: ['[class*="markdown"]', '[class*="message"]', 'article'], newChat: 'https://chat.z.ai/' },
    { id: 'hunyuan', host: 'aistudio.tencent.com', editor: 'textarea,[contenteditable="true"]', web: ['联网', '搜索'], think: ['思考', '推理', '深度'], reply: ['[class*="markdown"]', '[class*="message"]', 'article'], newChat: 'https://aistudio.tencent.com/' },
    { id: 'claude', host: 'claude.ai', editor: '[contenteditable="true"],textarea', web: ['联网', 'Web search', '搜索', 'Research'], think: ['思考', 'Extended thinking', 'Thinking', '推理'], reply: ['[class*="markdown"]', '[class*="message"]', '[data-testid*="message"]'], newChat: 'https://claude.ai/new' },
  ];

  const WEB_RE = /联网|联网搜索|网页搜索|搜索网页|在线搜索|网络搜索|web\s*search|search\s*the\s*web|browse|web\s*access|deep\s*research|深度研究|搜索|search/i;
  const THINK_RE = /思考|深度思考|推理|思维|进阶|快速|think|thinking|reasoning|extended|instant|auto|pro\b/i;
  const STOP_RE = /停止|暂停生成|中止|stop\s*generating|stop\s*streaming|^\s*stop\s*$|生成中/i;
  const SEND_RE = /发送|send|提交|submit|send.?prompt|发送消息/i;
  const FINISH_RE = /复制|copy|重新生成|regenerate|重试|retry|分享|share|点赞|点踩|thumbs/i;
  const LOGIN_RE = /^(登录|登陆|立即登录|log in|sign in|sign up|get started|继续|授权登录)/i;
  const GENERIC_REPLY = ['[data-message-author-role="assistant"]', '[data-role="assistant"]', '[data-testid*="assistant"]', '[class*="assistant"]', '[class*="answer"]', '[class*="response"]', '[class*="markdown"]', '[class*="message-content"]', '[data-testid*="message"]', 'article'];

  const prof = PROFILES.find(p => location.hostname.includes(p.host)) || { id: 'unknown', host: location.hostname, editor: 'textarea,[contenteditable="true"]', web: [], think: [], reply: [], newChat: '' };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = s => (s || '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  function visible(e) {
    if (!e || !e.getBoundingClientRect) return false;
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(e);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  }
  function label(e) {
    return [e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('data-testid'), e.getAttribute('placeholder'), e.getAttribute('value'), e.innerText, e.getAttribute('aria-roledescription')]
      .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  function describe(c, withRect) {
    const o = { text: c.text, tag: c.e.tagName, cls: String(c.e.className || '').slice(0, 70), pressed: c.pressed, state: c.state, disabled: c.disabled };
    if (withRect) { const r = c.e.getBoundingClientRect(); o.rect = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }
    return o;
  }
  function controls() {
    const sel = 'button,[role="button"],[role="switch"],[role="checkbox"],[role="menuitem"],[role="option"],[aria-pressed],[data-testid*="button"],[data-testid*="send"]';
    return [...document.querySelectorAll(sel)].filter(visible).map(e => ({
      e, text: label(e), pressed: e.getAttribute('aria-pressed'), state: e.getAttribute('data-state') || e.getAttribute('aria-checked'),
      disabled: !!e.disabled || e.getAttribute('aria-disabled') === 'true',
    }));
  }
  function editor() {
    let list = [];
    try { list = [...document.querySelectorAll(prof.editor || 'textarea,[contenteditable="true"]')]; } catch (_) { }
    if (!list.length) list = [...document.querySelectorAll('textarea,[contenteditable="true"]')];
    list = list.filter(visible);
    if (!list.length) return null;
    // Prefer the lowest / largest visible editor (composer is near the bottom).
    return list.sort((a, b) => (b.getBoundingClientRect().top + b.getBoundingClientRect().height / 10) - (a.getBoundingClientRect().top + a.getBoundingClientRect().height / 10))[0];
  }
  const CF_STRICT_RE = /just a moment|checking your browser|verify you are human|verify you are not a bot|attention required|enable javascript and cookies|performing security verification|正在进行安全验证|执行安全验证|请稍候，正在验证|cf-chl/i;
  function inSidebar(e) {
    for (let p = e; p && p !== document.body; p = p.parentElement) {
      try { if (p.matches('aside,nav,[data-testid*="sidebar"]')) return true; } catch (_) { }
      const c = String(p.className || '');
      if (/\bsidebar\b|sidebar[_-]|next-sidebar|side-bar/i.test(c)) {
        const r = p.getBoundingClientRect();
        if (r.width < innerWidth * 0.5 && r.left < innerWidth * 0.5) return true;
      }
    }
    return false;
  }
  function nearComposer(c, ed) {
    if (inSidebar(c.e)) return false;
    if (!ed) return true;
    const r = c.e.getBoundingClientRect(), er = ed.getBoundingClientRect();
    const cy = r.top + r.height / 2, cx = r.left + r.width / 2;
    return cy > er.top - 340 && cy < er.bottom + 380 && cx > er.left - 850 && cx < er.right + 850;
  }
  function replyNodes() {
    const ed = editor();
    const sel = (prof.reply || []).concat(GENERIC_REPLY).join(',');
    let nodes = [];
    try { nodes = [...document.querySelectorAll(sel)]; } catch (_) { }
    return nodes.filter(e => visible(e) && e !== ed && !e.contains(ed) && !(ed && ed.contains(e)));
  }
  function reply() {
    const nodes = replyNodes();
    let best = null, bestScore = -1, bestIndex = -1;
    nodes.forEach((e, i) => {
      const t = clean(e.innerText || e.textContent || '');
      if (t.length < 2) return;
      let score = Math.min(t.length, 4000) + i * 25;
      const role = e.getAttribute('data-message-author-role') || e.getAttribute('data-role') || '';
      if (role === 'assistant') score += 4000;
      if (/assistant|answer|response|markdown/i.test(String(e.className || ''))) score += 900;
      if (e.closest('[data-message-author-role="user"],[class*="user-message"],[class*="user-query"]')) score -= 5000;
      if (/^(登录|注册|cookie|隐私|条款)/i.test(t) && t.length < 60) score -= 2000;
      if (score > bestScore) { bestScore = score; best = { e, t }; bestIndex = i; }
    });
    if (!best) return { text: '', chars: 0, selector: null, sources: [], nodeCount: nodes.length };
    const links = [...best.e.querySelectorAll('a[href^="http"]')].map(a => ({ title: clean(a.innerText || a.getAttribute('aria-label') || '').slice(0, 100), url: a.href }));
    const seen = new Set();
    const sources = links.filter(l => !seen.has(l.url) && seen.add(l.url)).slice(0, 20);
    return {
      text: best.t, chars: best.t.length,
      selector: String(best.e.className || best.e.tagName).slice(0, 100),
      nodeIndex: bestIndex, nodeCount: nodes.length, sources,
    };
  }
  function streaming() {
    const stop = controls().find(c => !c.disabled && STOP_RE.test(c.text) && !/停止语音|停止录音|停止播放/.test(c.text));
    if (stop) return { value: true, reason: 'stop-button: ' + stop.text.slice(0, 40) };
    const busy = [...document.querySelectorAll('[data-is-streaming="true"],[class*="is-streaming"],[class*="streaming"],[class*="generating"],[class*="is-typing"]')].some(visible);
    return { value: busy, reason: busy ? 'busy-marker' : 'no-marker' };
  }
  function finishControls() { return controls().filter(c => FINISH_RE.test(c.text)).map(c => c.text).slice(0, 10); }
  function cf() {
    const title = document.title || '';
    const body = document.body ? document.body.innerText : '';
    const head = body.slice(0, 800);
    const marker = !!document.querySelector('iframe[src*="challenges.cloudflare.com"],iframe[title*="Cloudflare"],.cf-turnstile,#cf-turnstile,[class*="turnstile-wrapper"]');
    const titleHit = /just a moment|checking your browser|attention required|cloudflare|安全验证|人机验证/i.test(title);
    const bodyHit = body.length < 2500 && CF_STRICT_RE.test(head);
    // A real challenge page has no working chat composer. Chat history containing the
    // word "Cloudflare" must NOT be mistaken for a challenge.
    const hasEditor = !!editor();
    return {
      challenge: marker || (titleHit && !hasEditor) || (bodyHit && !hasEditor),
      marker, titleHit, bodyHit, hasEditor, title: title.slice(0, 100), bodyChars: body.length,
      headPreview: head.slice(0, 120),
    };
  }
  function loginHint() {
    const hits = controls().filter(c => LOGIN_RE.test(c.text)).map(c => c.text).slice(0, 5);
    return { hasLoginButton: hits.length > 0, buttons: hits, hasEditor: !!editor() };
  }
  function humanClick(e) {
    try { e.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); } catch (_) { }
    try { e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window, isPrimary: true })); } catch (_) { }
    try { e.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, buttons: 1 })); } catch (_) { }
    try { e.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window })); } catch (_) { }
    try { e.click(); } catch (_) { }
  }
  function setEditorText(ed, txt) {
    ed.focus();
    if (ed.tagName === 'TEXTAREA' || ed.tagName === 'INPUT') {
      const proto = ed.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(ed, txt);
      ed.dispatchEvent(new Event('input', { bubbles: true }));
      ed.dispatchEvent(new Event('change', { bubbles: true }));
      return 'native-setter';
    }
    try { document.execCommand('selectAll', false, null); document.execCommand('delete', false, null); } catch (_) { }
    let ok = false;
    try { ok = document.execCommand('insertText', false, txt); } catch (_) { }
    if (!ok || !clean(ed.innerText)) {
      ed.textContent = txt;
      try { ed.dispatchEvent(new InputEvent('input', { bubbles: true, data: txt, inputType: 'insertText' })); } catch (_) { ed.dispatchEvent(new Event('input', { bubbles: true })); }
      return 'textContent+input';
    }
    return 'execCommand-insertText';
  }
  function send(ed) {
    const btn = controls().find(c => nearComposer(c, ed) && !c.disabled && SEND_RE.test(c.text));
    if (btn) { humanClick(btn.e); return { via: 'send-button', label: btn.text }; }
    const o = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13, view: window };
    ed.dispatchEvent(new KeyboardEvent('keydown', o));
    ed.dispatchEvent(new KeyboardEvent('keypress', o));
    ed.dispatchEvent(new KeyboardEvent('keyup', o));
    return { via: 'synthetic-enter', note: 'If nothing was sent, use MCP press_key with Enter.' };
  }
  function menuItems() {
    const sel = '[role="menuitem"],[role="option"],[role="menuitemcheckbox"],[role="menuitemradio"],[data-radix-menu-content] button,[class*="dropdown"] button,[class*="popover"] button';
    return controls().filter(c => { try { return !!c.e.matches(sel); } catch (_) { return false; } });
  }

  const W = {
    id: prof.id, profile: prof, PROFILES, RE: { WEB_RE, THINK_RE, STOP_RE, SEND_RE, FINISH_RE },
    sleep, clean, visible, label, describe, controls, editor, inSidebar, nearComposer, replyNodes, reply,
    streaming, finishControls, cf, loginHint, humanClick, setEditorText, send, menuItems,
  };
  window.__WAI__ = W;

  const ed = editor();
  const all = controls();
  const near = all.filter(c => nearComposer(c, ed));
  const r = reply();
  return {
    ok: true, site: W.id, url: location.href, title: document.title, ready: document.readyState,
    cloudflare: cf(), login: loginHint(),
    editor: ed ? { tag: ed.tagName, cls: String(ed.className || '').slice(0, 100), aria: ed.getAttribute('aria-label'), placeholder: ed.getAttribute('data-placeholder'), rect: [Math.round(ed.getBoundingClientRect().left), Math.round(ed.getBoundingClientRect().top)] } : null,
    composerControls: near.slice(-35).map(c => describe(c, true)),
    webCandidates: near.filter(c => WEB_RE.test(c.text)).map(c => describe(c, true)),
    thinkCandidates: near.filter(c => THINK_RE.test(c.text)).map(c => describe(c, true)),
    sendCandidates: near.filter(c => SEND_RE.test(c.text)).map(c => describe(c, true)),
    stopCandidates: all.filter(c => STOP_RE.test(c.text)).map(c => describe(c, false)),
    reply: { chars: r.chars, selector: r.selector, preview: r.text.slice(0, 160), sources: r.sources.slice(0, 5), nodeCount: r.nodeCount },
    streaming: streaming(), finishControls: finishControls(),
    hint: 'Use take_snapshot + click(uid) for Cloudflare / canvas challenges; use this diagnosis for DOM-based controls.',
  };
}
