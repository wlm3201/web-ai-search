/* web-ai-search / ego_ask_lib.mjs
 * ego lite backend: ask(page, site) handles navigation, Cloudflare checkbox,
 * web/thinking toggles (including the icon-only hunyuan switch), prompt paste,
 * stream-end detection and body-text fallback answer extraction.
 * Import from a round .mjs file; call setPrompt()/setOutDir() before ask().
 * All page.evaluate callbacks are self-contained: ego-browser serializes them
 * without Node-side closures.
 */
import os from 'node:os';
import path from 'node:path';

const { writeFile, mkdir } = await import('node:fs/promises');

// The ego-browser nodejs process can start in a read-only install directory,
// so never default to a relative path resolved against process.cwd().
export let OUT_DIR = path.join(os.tmpdir(), 'web-ai-search-runs');
export let PROMPT = '请联网搜索：所用编程语言的最新稳定版本是什么？请给出官方来源链接，并写出一条安装命令。';
export function setOutDir(d) { OUT_DIR = d; }
export function setPrompt(p) { PROMPT = p; }

export async function save(name, data) {
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(`${OUT_DIR}/${name}.json`, JSON.stringify(data, null, 2), 'utf8');
}

const CFG = {
  web: ['联网搜索', '联网', '网页搜索', '搜索网页', 'web search', 'search the web', 'web access'],
  tools: ['添加文件', '更多工具', '工具', '插件', '技能', 'attach', 'tools', 'plus'],
  think: ['深度思考', '思考', 'thinking', 'reasoning', '进阶'],
};

const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
const lab = e => [e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('data-testid'), e.getAttribute('placeholder'), e.innerText]
  .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

const landing = () => {
  const body = document.body ? document.body.innerText : '';
  const head = body.slice(0, 1200);
  const loginWords = /登录|注册|Sign in|Log in|Sign up|立即登录|登录后可使用/i.test(head);
  const chatEditor = [...document.querySelectorAll('textarea,[contenteditable="true"]')]
    .some(e => /消息|输入|问|prompt|ask|chat/i.test((e.getAttribute('placeholder') || '') + ' ' + (e.getAttribute('aria-label') || '')));
  const hasNewChat = /新对话|新旁聊|新建会话|New chat|新建聊天/i.test(head);
  const welcomeOnly = body.length < 2500 && !/历史|会话记录|最近|消息记录/.test(head);
  return {
    title: document.title,
    url: location.href,
    head: head.slice(0, 220),
    bodyChars: body.length,
    notLoggedIn: loginWords && welcomeOnly && !chatEditor && !hasNewChat,
    hasEditor: !!document.querySelector('textarea,[contenteditable="true"]'),
    editors: [...document.querySelectorAll('textarea,[contenteditable="true"]')].filter(e => e.getBoundingClientRect().width > 0).length,
    cf: /请稍候|正在进行安全验证|just a moment|verify you are human|checking your browser|attention required/i.test(
      document.title + body.slice(0, 400)),
    iframes: [...document.querySelectorAll('iframe')].map(f => f.src).slice(0, 5),
  };
};

const composer = () => {
  const eds = [...document.querySelectorAll('textarea,[contenteditable="true"]')].filter(e => e.getBoundingClientRect().width > 0);
  const ed = eds[eds.length - 1];
  const er = ed ? ed.getBoundingClientRect() : null;
  const ctrls = [...document.querySelectorAll('button,[role="button"],[role="switch"],[aria-pressed],[class*="switch"],label,[class*="toggle"]')]
    .filter(e => e.getBoundingClientRect().width > 0)
    .filter(e => {
      if (!er) return true;
      const r = e.getBoundingClientRect(); const cy = r.top + r.height / 2;
      return cy > er.top - 420 && cy < er.bottom + 420;
    }).map(e => ({
      tag: e.tagName,
      text: (e.getAttribute('aria-label') || e.innerText || e.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 55),
      pressed: e.getAttribute('aria-pressed'),
      cls: String(e.className || '').slice(0, 55),
    })).filter(x => x.text).slice(-30);
  return {
    title: document.title,
    editors: eds.map(e => ({ tag: e.tagName, cls: String(e.className || '').slice(0, 55), ph: e.getAttribute('placeholder') })),
    ctrls,
  };
};

const markControls = (cfg) => {
  const lab = e => [e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('data-testid'), e.getAttribute('placeholder'), e.innerText]
    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  document.querySelectorAll('[data-ego-editor],[data-ego-web],[data-ego-tools],[data-ego-think],[data-ego-menu],[data-ego-web-force]').forEach(x => {
    ['data-ego-editor', 'data-ego-web', 'data-ego-tools', 'data-ego-think', 'data-ego-menu', 'data-ego-web-force'].forEach(a => x.removeAttribute(a));
  });
  const eds = [...document.querySelectorAll('textarea,[contenteditable="true"]')].filter(e => e.getBoundingClientRect().width > 0)
    .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
  const ed = eds[0];
  if (ed) ed.setAttribute('data-ego-editor', '1');
  const er = ed ? ed.getBoundingClientRect() : null;
  const inSidebar = e => {
    for (let p = e; p && p !== document.body; p = p.parentElement) {
      if (p.matches && p.matches('aside,nav,[data-testid*="sidebar"]')) return true;
      const c = String(p.className || '');
      if (/sidebar|side-bar/i.test(c)) { const r = p.getBoundingClientRect(); if (r.width < innerWidth * 0.5 && r.left < innerWidth * 0.5) return true; }
    }
    return false;
  };
  const near = e => {
    if (!er) return true;
    const r = e.getBoundingClientRect(); const cy = r.top + r.height / 2, cx = r.left + r.width / 2;
    return cy > er.top - 360 && cy < er.bottom + 400 && cx > er.left - 850 && cx < er.right + 850;
  };
  const ctrls = [...document.querySelectorAll('button,[role="button"],[role="switch"],[role="menuitem"],[aria-pressed]')]
    .filter(e => e.getBoundingClientRect().width > 0).filter(e => !inSidebar(e) && near(e));
  const hit = (e, words) => words.some(w => (e.getAttribute('aria-label') || e.innerText || e.getAttribute('title') || e.getAttribute('data-testid') || '')
    .toLowerCase().includes(String(w).toLowerCase()));
  const isOn = e => e.getAttribute('aria-pressed') === 'true' || e.getAttribute('data-state') === 'open' ||
    /\b(active|selected|checked|enabled)\b/i.test(String(e.className || ''));
  const out = { editor: !!ed, editorTag: ed ? ed.tagName : null, web: null, webOn: null, tools: null, think: null, controls: ctrls.map(e => lab(e).slice(0, 55)).slice(-22) };
  for (const e of ctrls) {
    if (!out.web && hit(e, cfg.web)) { out.web = lab(e).slice(0, 80); out.webOn = isOn(e); e.setAttribute('data-ego-web', '1'); }
    else if (!out.tools && hit(e, cfg.tools)) { out.tools = lab(e).slice(0, 80); e.setAttribute('data-ego-tools', '1'); }
    if (!out.think && hit(e, cfg.think)) { out.think = lab(e).slice(0, 80); e.setAttribute('data-ego-think', '1'); }
  }
  return out;
};

const forceWebMark = (cfg) => {
  const visible = e => e && e.getBoundingClientRect && e.getBoundingClientRect().width > 0;
  const words = cfg.words || ['联网', '网页搜索', '搜索网页', 'web search'];
  const matches = e => {
    const t = (e.innerText || '').trim();
    if (!t || t.length > 12) return false;
    const first = t.split(/\s+/)[0];
    return words.some(w => t === w || first === w || t.toLowerCase() === String(w).toLowerCase() || first.toLowerCase() === String(w).toLowerCase());
  };
  const buttons = [...document.querySelectorAll('button,[role="button"]')].filter(e => visible(e) && matches(e));
  const all = buttons.length ? buttons : [...document.querySelectorAll('*')].filter(e => visible(e) && matches(e) && e.children.length <= 5);
  let target = all.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];
  let how = 'text';
  if (!target) {
    const icon = [...document.querySelectorAll('[class*="online-tool"],[class*="web-search"],[class*="net-search"],[class*="search-web"],[data-testid*="web-search"],[aria-label*="联网"]')].find(visible);
    if (icon) {
      target = icon.closest('[class*="tool-btn"],[role="button"],button,[class*="switch"],[class*="toggle"]') || icon.parentElement || icon;
      how = 'icon:' + String(icon.className || '').slice(0, 50);
    }
  }
  if (!target) return { found: null };
  target.setAttribute('data-ego-web-force', '1');
  return {
    found: (target.innerText || '').trim().slice(0, 60) || how,
    how, tag: target.tagName, cls: String(target.className || '').slice(0, 80),
    stateBefore: { aria: target.getAttribute('aria-pressed'), html: target.outerHTML.slice(0, 200) },
  };
};

const markMenuItem = (cfg) => {
  const lab = e => [e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('data-testid'), e.innerText]
    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const items = [...document.querySelectorAll('[role="menuitem"],[role="option"],[role="menuitemcheckbox"],[role="menuitemradio"],button')]
    .filter(e => e.getBoundingClientRect().width > 0);
  const found = items.find(e => cfg.words.some(w => lab(e).toLowerCase().includes(String(w).toLowerCase())));
  if (found) { found.setAttribute('data-ego-menu', '1'); return { found: lab(found).slice(0, 80), total: items.length }; }
  return { found: null, total: items.length, sample: items.map(e => lab(e).slice(0, 40)).slice(-12) };
};

const initWait = () => {
  window.__egoWait = { last: '', stableSince: Date.now(), start: Date.now(), sawStream: false, polls: 0, maxChars: 0 };
  return 1;
};

const answerText = (cfg) => {
  const body = document.body ? document.body.innerText : '';
  const idx = body.lastIndexOf(cfg.prompt);
  let tail = idx >= 0 ? body.slice(idx + cfg.prompt.length) : body.slice(-5000);
  tail = tail.replace(/^\s*(ChatGPT 说|助手|回答|Assistant|AI)[:：]?\s*/i, '');
  const marks = ['ChatGPT 可能会出错', '回答已完成', '重新生成', '复制代码', '可能会出错。请核查', '最新一条回复', '提出后续问题', 'Cookie 政策', 'Pro 已启用', '追问', '相关问题', '由 Step', '内容由AI生成', '以上内容均由', '继续问，消息会排队发送', '和Kimi聊天的人太多了', '探索灵感', '模型介绍', '选择项目', '输入消息', '发送消息', '登录/注册', '我知道了', '去升级', '思考 TPS', '输出 TPS'];
  let cut = tail.length;
  for (const m of marks) { const i = tail.indexOf(m); if (i > 40 && i < cut) cut = i; }
  return tail.slice(0, cut).trim();
};

const checkDone = (cfg) => {
  const answerText = (c) => {
    const cleanBody = () => {
      // Live DOM only: hide LEFT NARROW sidebars, never main/article content.
      const sel = 'aside,nav,[class*="sidebar"],[class*="side-bar"],[data-testid*="sidebar"],script,style,noscript,template';
      const nodes = [...document.querySelectorAll(sel)].filter(n => {
        if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(n.tagName)) return true;
        if (n.closest('main,article,[role="main"]')) return false;
        const r = n.getBoundingClientRect();
        return r.width > 0 && r.width < innerWidth * 0.45 && r.left < innerWidth * 0.45;
      });
      const saved = nodes.map(n => { try { return { n, d: n.style.display }; } catch (_) { return { n, d: '' }; } });
      const restore = () => saved.forEach(({ n, d }) => { try { n.style.display = d; } catch (_) { } });
      saved.forEach(({ n }) => { try { n.style.display = 'none'; } catch (_) { } });
      let t = '';
      try { t = document.body ? document.body.innerText : ''; } catch (_) { }
      restore();
      let usedFallback = false;
      if (t.length < (c.minCleanChars || 120)) {
        try { t = document.body ? document.body.innerText : ''; } catch (_) { }
        usedFallback = true;
      }
      window.__egoClean = { hiddenNodes: saved.length, chars: t.length, mainFound: !!document.querySelector('main'), usedDetachedClone: false, usedFallback };
      return t;
    };
    const body = cleanBody();
    const from = c.from || 'after-last';
    const idx = from === 'after-last' ? body.lastIndexOf(c.prompt) : body.indexOf(c.prompt);
    let tail = '';
    window.__egoAnchor = { found: idx >= 0, from, idx };
    if (idx >= 0 && from === 'before-first') {
      const cand = [...document.querySelectorAll('[class*="message"],[class*="markdown"],[class*="answer"],article')]
        .filter(e => e.getBoundingClientRect().width > 0 && /版本|来源|官方|https?:\/\/|安装|结论|截至|\d+\.\d+|参考/i.test(e.innerText || '') && (e.innerText || '').trim().length > 40 && !(e.innerText || '').includes(c.prompt));
      const last = cand[cand.length - 1];
      let pre = body.slice(Math.max(0, idx - 1600), idx);
      const marks = c.startMarks || [];
      let start = -1;
      for (const m of marks) { const j = pre.lastIndexOf(m); if (j > start) start = j; }
      const fallback = start >= 0 ? pre.slice(start) : pre;
      tail = last ? (last.innerText || '').trim() : fallback;
    } else if (idx >= 0) {
      tail = body.slice(idx + c.prompt.length);
    } else {
      const cand = [...document.querySelectorAll('[data-message-author-role="assistant"],[data-role="assistant"],[class*="markdown"],[class*="answer"],[class*="response"],article')]
        .filter(e => e.getBoundingClientRect().width > 0 && (e.innerText || '').trim().length > 20);
      const last = cand[cand.length - 1];
      tail = last ? (last.innerText || '').trim() : '';
    }
    tail = tail.replace(/^\s*(ChatGPT 说|助手|回答|Assistant|AI)[:：]?\s*/i, '');
    const marks = ['ChatGPT 可能会出错', '回答已完成', '重新生成', '复制代码', '可能会出错。请核查', '最新一条回复', '提出后续问题', 'Cookie 政策', 'Pro 已启用', '追问', '相关问题', '由 Step', '内容由AI生成', '以上内容均由', '继续问，消息会排队发送', '和Kimi聊天的人太多了', '探索灵感', '模型介绍', '选择项目', '输入消息', '发送消息', '登录/注册', '我知道了', '去升级', '思考 TPS', '输出 TPS'];
    let cut = tail.length;
    for (const m of marks) { const i = tail.indexOf(m); if (i > 40 && i < cut) cut = i; }
    let out = tail.slice(0, cut).trim();
    out = out.split('\n').filter((l, i, arr) => !(i >= arr.length - 6 && l.trim().length <= 6 && /^(消息|发送|快速|进阶|复制|分享|Muse|登录|注册|Claude|Kimi)$/i.test(l.trim()))).join('\n').trim();
    const stripThinking = (t) => {
      const starts = [/已深度思考（用时[^）]*）/, /已思考（用时[^）]*）/, /思考过程[:：]?/, /已使用 web_search/, /搜索到 \d+ 个网页/, /搜索 \d+ 个网页/, /使用 \d+ 个工具/, /工作了 \d+s/, /Thinking\.\.\./i, /Reasoning[:：]?/i, /探索 \d+ 次文件/, /抓取网页/, /已读取/, /搜索结果已经指向/, /思考 TPS/, /输出 TPS/, /计划[:：]/];
      let s0 = -1;
      for (const re of starts) { const m = re.exec(t); if (m && (s0 < 0 || m.index < s0)) s0 = m.index; }
      if (s0 < 0) return t;
      const ends0 = [/查证完毕[。.]?\s*结论如下[:：]?/, /结论如下[:：]?/, /最终答案[:：]?/, /综合给出答案[。.]?/, /根据已打开页面/, /查证完毕/];
      let e0 = -1;
      for (const re of ends0) { const m = re.exec(t); if (m && m.index > s0 + 20 && (e0 < 0 || m.index < e0)) e0 = m.index; }
      if (e0 > 0) {
        const short = (t.slice(0, s0) + '\n' + t.slice(e0).trim()).trim();
        if (short.length >= 30) return short;
      }
      const seg = t.slice(s0);
      const parts = seg.split(/(\n\s*\n)/);
      let acc = 0;
      for (let i = 0; i < parts.length; i++) {
        const para = parts[i];
        const thinkish = /用户要求|用户需要|需要搜索|让我搜索|计划[:：]|搜索[:：]|The user|Let's search|I need to|已思考|思考过程|web_search|搜索到|使用了?工具|分析中|当前日期|先说明|推断|我应该|需要查询|查证|检索过程|搜索结果|抓取网页|探索 \d+ 次|Do not invent|Let me/i.test(para);
        if (i % 2 === 0 && para.trim().length > 20 && !thinkish) break;
        acc += para.length;
        if (acc > 3000) {
          const tailEnd = seg.slice(-1500);
          const m = /结论[:：]|最终答案[:：]|截至\s*20\d{2}\s*年|官方来源|根据搜索结果|查证完毕|最新|综合/.exec(tailEnd);
          const cut = m && m.index > 0 ? m.index : Math.max(0, tailEnd.length - 900);
          const short = (t.slice(0, s0) + '\n' + tailEnd.slice(cut).trim()).trim();
          return short.length >= 30 ? short : t;
        }
      }
      const cleaned = (t.slice(0, s0) + '\n' + seg.slice(acc).trim()).trim();
      return cleaned.length >= 30 ? cleaned : t;
    };
    const stripped = stripThinking(out);
    return stripped.length >= 20 ? stripped : out;
  };
  if (!window.__egoWait) window.__egoWait = { last: '', stableSince: Date.now(), start: Date.now(), sawStream: false, polls: 0, maxChars: 0 };
  const w = window.__egoWait;
  const ans = answerText(cfg);
  const stop = [...document.querySelectorAll('button,[role="button"]')].some(e => e.getBoundingClientRect().width > 0 &&
    /停止|暂停生成|停止回答|stop generating|stop streaming/i.test((e.getAttribute('aria-label') || e.innerText || '')));
  const busy = [...document.querySelectorAll('[data-is-streaming="true"],[class*="streaming"],[class*="generating"],[class*="is-typing"]')]
    .some(e => e.getBoundingClientRect().width > 0);
  if (stop || busy) w.sawStream = true;
  if (ans !== w.last) { w.last = ans; w.stableSince = Date.now(); }
  w.maxChars = Math.max(w.maxChars, ans.length);
  w.polls++;
  const stable = Date.now() - w.stableSince;
  const noise = /window\.HYDRATION|self\.__next_f|serverPainted|dehydratedAt|=>\{|\.input-flags|<style|<script/i.test(ans);
  const midStream = /思考中|继续问，消息会排队发送|正在搜索|搜索 \d+ 个网页|用户要求联网|用户需要联网|需要搜索并验证|需要先搜索|The user asks|Need search|Let's search|I need to search/i.test(ans);
  const hasSignal = /来源|Sources|https?:\/\/|参考|已读取|搜索了|已完成|引用|版本|命令|结论|\d+\.\d+/i.test(ans);
  const done = !stop && !noise && !midStream && ans.length >= 30 && stable >= (cfg.stableMs || 3000);
  return done || (Date.now() - w.start > (cfg.maxMs || 150000));
};

export const getAnswerFn = (cfg) => {
  const answerText = (c) => {
    const cleanBody = () => {
      // Live DOM only: hide LEFT NARROW sidebars, never main/article content.
      const sel = 'aside,nav,[class*="sidebar"],[class*="side-bar"],[data-testid*="sidebar"],script,style,noscript,template';
      const nodes = [...document.querySelectorAll(sel)].filter(n => {
        if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(n.tagName)) return true;
        if (n.closest('main,article,[role="main"]')) return false;
        const r = n.getBoundingClientRect();
        return r.width > 0 && r.width < innerWidth * 0.45 && r.left < innerWidth * 0.45;
      });
      const saved = nodes.map(n => { try { return { n, d: n.style.display }; } catch (_) { return { n, d: '' }; } });
      const restore = () => saved.forEach(({ n, d }) => { try { n.style.display = d; } catch (_) { } });
      saved.forEach(({ n }) => { try { n.style.display = 'none'; } catch (_) { } });
      let t = '';
      try { t = document.body ? document.body.innerText : ''; } catch (_) { }
      restore();
      let usedFallback = false;
      if (t.length < (c.minCleanChars || 120)) {
        try { t = document.body ? document.body.innerText : ''; } catch (_) { }
        usedFallback = true;
      }
      window.__egoClean = { hiddenNodes: saved.length, chars: t.length, mainFound: !!document.querySelector('main'), usedDetachedClone: false, usedFallback };
      return t;
    };
    const body = cleanBody();
    const from = c.from || 'after-last';
    const idx = from === 'after-last' ? body.lastIndexOf(c.prompt) : body.indexOf(c.prompt);
    let tail = '';
    window.__egoAnchor = { found: idx >= 0, from, idx };
    if (idx >= 0 && from === 'before-first') {
      const cand = [...document.querySelectorAll('[class*="message"],[class*="markdown"],[class*="answer"],article')]
        .filter(e => e.getBoundingClientRect().width > 0 && /版本|来源|官方|https?:\/\/|安装|结论|截至|\d+\.\d+|参考/i.test(e.innerText || '') && (e.innerText || '').trim().length > 40 && !(e.innerText || '').includes(c.prompt));
      const last = cand[cand.length - 1];
      let pre = body.slice(Math.max(0, idx - 1600), idx);
      const marks = c.startMarks || [];
      let start = -1;
      for (const m of marks) { const j = pre.lastIndexOf(m); if (j > start) start = j; }
      const fallback = start >= 0 ? pre.slice(start) : pre;
      tail = last ? (last.innerText || '').trim() : fallback;
    } else if (idx >= 0) {
      tail = body.slice(idx + c.prompt.length);
    } else {
      const cand = [...document.querySelectorAll('[data-message-author-role="assistant"],[data-role="assistant"],[class*="markdown"],[class*="answer"],[class*="response"],article')]
        .filter(e => e.getBoundingClientRect().width > 0 && (e.innerText || '').trim().length > 20);
      const last = cand[cand.length - 1];
      tail = last ? (last.innerText || '').trim() : '';
    }
    tail = tail.replace(/^\s*(ChatGPT 说|助手|回答|Assistant|AI)[:：]?\s*/i, '');
    const marks = ['ChatGPT 可能会出错', '回答已完成', '重新生成', '复制代码', '可能会出错。请核查', '最新一条回复', '提出后续问题', 'Cookie 政策', 'Pro 已启用', '追问', '相关问题', '由 Step', '内容由AI生成', '以上内容均由', '继续问，消息会排队发送', '和Kimi聊天的人太多了', '探索灵感', '模型介绍', '选择项目', '输入消息', '发送消息', '登录/注册', '我知道了', '去升级', '思考 TPS', '输出 TPS'];
    let cut = tail.length;
    for (const m of marks) { const i = tail.indexOf(m); if (i > 40 && i < cut) cut = i; }
    let out = tail.slice(0, cut).trim();
    out = out.split('\n').filter((l, i, arr) => !(i >= arr.length - 6 && l.trim().length <= 6 && /^(消息|发送|快速|进阶|复制|分享|Muse|登录|注册|Claude|Kimi)$/i.test(l.trim()))).join('\n').trim();
    const stripThinking = (t) => {
      const starts = [/已深度思考（用时[^）]*）/, /已思考（用时[^）]*）/, /思考过程[:：]?/, /已使用 web_search/, /搜索到 \d+ 个网页/, /搜索 \d+ 个网页/, /使用 \d+ 个工具/, /工作了 \d+s/, /Thinking\.\.\./i, /Reasoning[:：]?/i, /探索 \d+ 次文件/, /抓取网页/, /已读取/, /搜索结果已经指向/, /思考 TPS/, /输出 TPS/, /计划[:：]/];
      let s0 = -1;
      for (const re of starts) { const m = re.exec(t); if (m && (s0 < 0 || m.index < s0)) s0 = m.index; }
      if (s0 < 0) return t;
      const ends0 = [/查证完毕[。.]?\s*结论如下[:：]?/, /结论如下[:：]?/, /最终答案[:：]?/, /综合给出答案[。.]?/, /根据已打开页面/, /查证完毕/];
      let e0 = -1;
      for (const re of ends0) { const m = re.exec(t); if (m && m.index > s0 + 20 && (e0 < 0 || m.index < e0)) e0 = m.index; }
      if (e0 > 0) {
        const short = (t.slice(0, s0) + '\n' + t.slice(e0).trim()).trim();
        if (short.length >= 30) return short;
      }
      const seg = t.slice(s0);
      const parts = seg.split(/(\n\s*\n)/);
      let acc = 0;
      for (let i = 0; i < parts.length; i++) {
        const para = parts[i];
        const thinkish = /用户要求|用户需要|需要搜索|让我搜索|计划[:：]|搜索[:：]|The user|Let's search|I need to|已思考|思考过程|web_search|搜索到|使用了?工具|分析中|当前日期|先说明|推断|我应该|需要查询|查证|检索过程|搜索结果|抓取网页|探索 \d+ 次|Do not invent|Let me/i.test(para);
        if (i % 2 === 0 && para.trim().length > 20 && !thinkish) break;
        acc += para.length;
        if (acc > 3000) {
          const tailEnd = seg.slice(-1500);
          const m = /结论[:：]|最终答案[:：]|截至\s*20\d{2}\s*年|官方来源|根据搜索结果|查证完毕|最新|综合/.exec(tailEnd);
          const cut = m && m.index > 0 ? m.index : Math.max(0, tailEnd.length - 900);
          const short = (t.slice(0, s0) + '\n' + tailEnd.slice(cut).trim()).trim();
          return short.length >= 30 ? short : t;
        }
      }
      const cleaned = (t.slice(0, s0) + '\n' + seg.slice(acc).trim()).trim();
      return cleaned.length >= 30 ? cleaned : t;
    };
    const stripped = stripThinking(out);
    return stripped.length >= 20 ? stripped : out;
  };
  const text = answerText(cfg);
  const badLink = /(chatgpt\.com|perplexity\.ai|cloudflare|google\.com|apple\.com|microsoft\.com|doubao\.com|kimi\.com|aistudio\.tencent\.com|privacy|terms|cookie|consent|support\.|policies|beian|about)/i;
  const rawLinks = [...document.querySelectorAll('a[href^="http"]')]
    .filter(a => a.getBoundingClientRect().width > 0)
    .map(a => a.href)
    .filter(u => u.length < 300 && !badLink.test(u) && !/%[0-9A-F]{2}%[0-9A-F]{2}%[0-9A-F]{2}/i.test(u));
  let links = [...new Set(rawLinks)].slice(-12);
  const textLinks = [...new Set((text.match(/https?:\/\/[^\s<>"')]+/g) || []))]
    .filter(u => u.length < 300 && !badLink.test(u));
  if (!links.length) links = textLinks.slice(0, 8);
  const bodyText = document.body ? document.body.innerText : '';
  const bodyLinks = [...new Set((bodyText.match(/https?:\/\/[^\s<>"')]+/g) || []))]
    .filter(u => u.length < 300 && !badLink.test(u));
  const allLinks = [...new Set([...textLinks, ...links, ...bodyLinks])];
  const webEvidence = {
    sourceCards: (bodyText.match(/(参考\s*\d+\s*篇|搜索了网页|\d+\s*sources?|已读取|引用来源|来源[:：]|个来源)/gi) || []).length,
    domains: [...new Set(allLinks.map(u => (u.match(/^https?:\/\/([^\/]+)/) || [])[1]).filter(Boolean))].slice(0, 8),
    textLinks: allLinks.slice(0, 8),
  };
  const noise = /window\.HYDRATION|self\.__next_f|serverPainted|dehydratedAt|=>\{|\.input-flags|<style|<script/i.test(text);
  return {
    url: location.href, title: document.title,
    text: text.slice(0, 1600), chars: text.length,
    links, webEvidence,
    quality: { anchor: window.__egoAnchor || null, scriptNoise: noise, cleaning: window.__egoClean || null },
    wait: window.__egoWait ? { polls: window.__egoWait.polls, maxChars: window.__egoWait.maxChars, sawStream: window.__egoWait.sawStream } : null,
  };
};

async function clearCloudflare(page, r) {
  let clicked = false;
  try {
    const snap = await page.snapshot();
    const m = snap.match(/checkbox[^\[\n]*\[ref=(\d+)/);
    if (m) { await page.click(`@${m[1]}`, { label: 'verify human checkbox' }); clicked = true; r.cfAction = 'clicked-ref:' + m[1]; }
  } catch (e) { r.cfRefError = String(e).slice(0, 120); }
  if (!clicked) {
    try { await page.click('loc=role:checkbox', { label: 'verify human checkbox' }); clicked = true; r.cfAction = 'clicked-role-checkbox'; }
    catch (e) { r.cfRoleError = String(e).slice(0, 120); }
  }
  if (!clicked) { r.cfAction = 'no-clickable-checkbox'; return false; }
  try {
    await page.waitForFunction(() => !!document.querySelector('textarea,[contenteditable="true"]'), undefined, { timeout: 50000, polling: 500 });
    r.cfAction += ':passed';
    return true;
  } catch (e) { r.cfAction += ':verify-timeout'; return false; }
}

export async function ask(page, site) {
  const r = { site: site.id, label: page.label, url: site.url, startedAt: new Date().toISOString() };
  const t0 = Date.now();
  try {
    if (!site.skipGoto) {
      await page.goto(site.url, { timeout: 60000 });
      await page.waitForLoadState();
      try {
        await page.waitForFunction(() => !!document.querySelector('textarea,[contenteditable="true"]'), undefined, { timeout: 35000, polling: 500 });
      } catch (_) { }
    }
    r.landing = await page.evaluate(landing);
    if (!r.landing.hasEditor) {
      if (r.landing.cf || /请稍候|安全验证/i.test(r.landing.title + r.landing.head)) {
        const ok = await clearCloudflare(page, r);
        if (!ok) { r.status = 'blocked-cloudflare'; return r; }
        r.landing = await page.evaluate(landing);
      } else { r.status = 'blocked-no-editor'; return r; }
    }
    if (!r.landing.hasEditor) { r.status = 'blocked-no-editor-after-cf'; return r; }
    if (r.landing.notLoggedIn) { r.status = 'blocked-not-logged-in'; return r; }

    if (site.freshSel) {
      try { await page.click(site.freshSel, { label: 'start fresh chat' }); await page.waitForTimeout(700); r.freshAction = 'clicked-new-chat'; }
      catch (e) {
        const ok = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return false; el.click(); return true; }, site.freshSel);
        r.freshAction = ok ? 'dom-clicked-new-chat' : 'fresh-selector-not-found';
        if (!ok) r.freshError = String(e).slice(0, 120);
      }
    } else if (site.newChatUrl) {
      try { await page.goto(site.newChatUrl, { timeout: 60000 }); await page.waitForLoadState(); r.freshAction = 'new-chat-url'; }
      catch (e) { r.freshError = String(e).slice(0, 120); }
    } else if (site.freshClick) {
      if (site.freshWaitText) {
        try { await page.waitForFunction((w) => !!(document.body && document.body.innerText.includes(w)), site.freshWaitText, { timeout: 15000, polling: 300 }); }
        catch (e) { r.freshWaitError = String(e).slice(0, 100); }
      }
      const fresh = await page.evaluate((cfg) => {
        const vis = e => e.getBoundingClientRect().width > 0;
        const cand = [...document.querySelectorAll('button,[role="button"],a,div')]
          .filter(vis)
          .filter(e => cfg.allowSidebar !== false || !e.closest('aside,nav,[class*="sidebar"]'))
          .find(e => {
            const t = (e.innerText || e.getAttribute('aria-label') || '').trim();
            return t.length > 0 && t.length < 20 && cfg.words.some(w => t.toLowerCase().includes(String(w).toLowerCase()));
          });
        if (!cand) return { found: null };
        cand.setAttribute('data-ego-fresh', '1');
        return { found: (cand.innerText || cand.getAttribute('aria-label') || '').trim().slice(0, 40) };
      }, { words: site.newChatText || ['新对话', '新建会话', '新聊天', 'New chat'], allowSidebar: site.freshInSidebar !== false });
      r.fresh = fresh;
      if (fresh.found) {
        try { await page.click('[data-ego-fresh="1"]', { label: 'start fresh chat' }); }
        catch (_) { await page.evaluate(() => document.querySelector('[data-ego-fresh]')?.click()); }
        await page.waitForTimeout(900);
        r.freshAction = 'clicked-new-chat';
      } else r.freshAction = 'not-found';
    } else r.freshAction = 'not-configured';

    r.composer = await page.evaluate(composer);
    const marked = await page.evaluate(markControls, CFG);
    r.controls = marked;
    let webDone = false;
    if (marked.web && !marked.webOn) {
      try { await page.click('[data-ego-web="1"]', { label: 'enable web search' }); r.webAction = 'toggle:' + marked.web; webDone = true; }
      catch (e) { r.webError = String(e).slice(0, 120); }
    } else if (marked.webOn) { r.webAction = 'already-on:' + marked.web; webDone = true; }
    if (!webDone && marked.tools) {
      try {
        await page.click('[data-ego-tools="1"]', { label: 'open tools menu' });
        await page.waitForTimeout(600);
        const menu = await page.evaluate(markMenuItem, { words: ['联网搜索', '搜索网页', '网页搜索', '联网', 'search the web', 'web search'] });
        r.menu = menu;
        if (menu.found) { await page.click('[data-ego-menu="1"]', { label: 'choose web search' }); r.webAction = 'menu:' + menu.found; webDone = true; }
        else { await page.keyboard.press('Escape'); r.webAction = 'menu-no-item'; }
      } catch (e) { r.webError = String(e).slice(0, 120); await page.keyboard.press('Escape').catch(() => { }); }
    }
    if (!webDone && !r.webAction) r.webAction = 'not-found';
    if (site.defaultWeb && /menu-no-item|not-found/.test(r.webAction || '')) r.webAction = 'default-web-on';

    if (site.forceWeb && !/toggle|menu:|already-on/.test(r.webAction || '')) {
      const f = await page.evaluate(forceWebMark, { words: site.forceWebText || ['联网', '网页搜索', '搜索网页', 'web search'] });
      r.forceWebMark = f;
      if (f.found) {
        try { await page.click('[data-ego-web-force="1"]', { label: 'enable web search manually' }); r.webAction = 'force-click:' + f.found; }
        catch (e) {
          try { await page.evaluate(() => document.querySelector('[data-ego-web-force]')?.click()); r.webAction = 'force-dom-click:' + f.found; }
          catch (_) { r.webError = String(e).slice(0, 120); }
        }
        r.webStateAfter = await page.evaluate(() => {
          const e = document.querySelector('[data-ego-web-force]');
          return e ? { cls: String(e.className || '').slice(0, 90), aria: e.getAttribute('aria-pressed'), html: e.outerHTML.slice(0, 220) } : null;
        });
        const popItem = await page.evaluate(() => {
          const boxes = [...document.querySelectorAll('[role="dialog"],[data-state="open"],[aria-haspopup="dialog"]')]
            .filter(e => e.getBoundingClientRect().width > 0);
          const el = boxes.flatMap(d => [...d.querySelectorAll('button,[role="menuitem"],[role="switch"],label,span,div')])
            .find(e => /联网|搜索|web search/i.test((e.innerText || e.getAttribute('aria-label') || '')) && (e.innerText || '').trim().length < 40);
          if (!el) return false;
          el.setAttribute('data-ego-force-item', '1');
          return true;
        });
        if (popItem) {
          try { await page.click('[data-ego-force-item="1"]', { label: 'confirm web toggle' }); r.webAction += ':confirmed'; }
          catch (_) { await page.evaluate(() => document.querySelector('[data-ego-force-item]')?.click()).catch(() => { }); }
        }
      } else r.webAction = 'force-not-found';
    }
    if (site.think && marked.think) {
      try { await page.click('[data-ego-think="1"]', { label: 'set thinking level' }); await page.waitForTimeout(350); await page.keyboard.press('Escape'); r.thinkAction = 'clicked:' + marked.think; }
      catch (e) { r.thinkError = String(e).slice(0, 100); }
    }

    if (site.clickSequence) {
      r.clickSequence = [];
      for (const raw of site.clickSequence) {
        const step = { ...raw, text: raw.text === '$thinkLevel' ? (site.thinkLevel || '标准') : raw.text };
        const item = { step, ok: false };
        try {
          if (step.sel) await page.click(step.sel, { label: 'model selector step' });
          else if (step.slider === 'low') {
            const box = await page.evaluate(() => {
              const el = document.querySelector('[data-slider-root]');
              if (!el) return null;
              const r = el.getBoundingClientRect();
              return { left: r.left, top: r.top, width: r.width, height: r.height };
            });
            if (box) await page.mouse.click(box.left + 4, box.top + box.height / 2, { label: 'set thinking low' });
            item.found = !!box;
          }
          else if (step.text) {
            const found = await page.evaluate((t) => {
              const el = [...document.querySelectorAll('button,[role="menuitem"],[role="option"],div,span')]
                .filter(e => e.getBoundingClientRect().width > 0)
                .find(e => (e.innerText || '').trim().includes(t) && (e.innerText || '').trim().length < 60);
              if (!el) return false;
              try { el.click(); } catch (_) { return false; }
              return true;
            }, step.text);
            item.found = found;
          }
          await page.waitForTimeout(450);
          item.ok = true;
        } catch (e) { item.error = String(e).slice(0, 100); }
        r.clickSequence.push(item);
      }
    }

    await page.evaluate(markControls, CFG);
    try { await page.click('[data-ego-editor="1"]', { label: 'focus prompt box' }); }
    catch (e) {
      r.focusFallback = String(e).slice(0, 110);
      await page.keyboard.press('Escape').catch(() => { });
      await page.evaluate(markControls, CFG);
      await page.focus('[data-ego-editor="1"]');
    }
    if (/menu:/.test(r.webAction || '')) {
      // Tool menus sometimes insert a label (e.g. "网页搜索 ") into the composer.
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Backspace');
    }
    await page.keyboard.paste(PROMPT);
    await page.waitForTimeout(400);
    r.typed = await page.evaluate(() => {
      const ed = document.querySelector('[data-ego-editor]');
      const t = ed ? (ed.innerText || ed.value || '').trim() : '';
      return { chars: t.length, head: t.slice(0, 50) };
    });
    if (r.typed.chars < 10) { r.status = 'typing-failed'; return r; }
    await page.keyboard.press('Enter');
    r.sent = true;
    if (site.sendRetry) {
      const before = await page.evaluate(() => ({ url: location.href, len: document.body ? document.body.innerText.length : 0 }));
      await page.waitForTimeout(1200);
      const after = await page.evaluate(() => ({
        url: location.href, len: document.body ? document.body.innerText.length : 0,
        stop: [...document.querySelectorAll('button,[role="button"]')].some(e => e.getBoundingClientRect().width > 0 && /停止|暂停生成|Stop generating/i.test((e.getAttribute('aria-label') || e.innerText || ''))),
      }));
      if (after.url === before.url && after.len <= before.len + 20 && !after.stop) {
        await page.keyboard.press('Enter');
        r.sendRetry = true;
        await page.waitForTimeout(900);
      }
    }
    await page.evaluate(initWait);
    const waitMs = site.waitMs || 150000;
    const runCfg = { prompt: PROMPT, from: site.answerFrom || 'after-last', minCleanChars: site.minCleanChars || 120, startMarks: site.answerStartMarks || [], maxMs: waitMs, stableMs: site.stableMs || 3000 };
    try { await page.waitForFunction(checkDone, runCfg, { timeout: waitMs, polling: 1000 }); r.waitStatus = 'finished'; }
    catch (e) { r.waitStatus = 'timeout:' + String(e).slice(0, 70); }
    r.answer = await page.evaluate(getAnswerFn, runCfg);
    const q = (r.answer && r.answer.quality) || {};
    r.cleaning = q.cleaning || null;
    r.answerQuality = {
      anchorFound: !!(q.anchor && q.anchor.found),
      scriptNoise: !!q.scriptNoise,
      chars: r.answer ? r.answer.chars : 0,
    };
    r.cfAction = r.cfAction || 'no-challenge';
    const aText = (r.answer && r.answer.text) || '';
    const aLinks = (r.answer && r.answer.links) || [];
    const hasAnswerSignal = /https?:\/\/|来源|Sources|参考\s*\d+\s*篇|版本|结论|安装|已读取|已核实|查证/i.test(aText) || aLinks.length > 0;
    r.answerQuality.hasAnswerSignal = hasAnswerSignal;
    r.webEvidence = (r.answer && r.answer.webEvidence) || null;
    const uiOnly = r.answerQuality.chars > 0 && r.answerQuality.chars < 80 && /输入消息|发送消息|继续问|选择项目|登录|注册|我知道了|去升级/.test(aText);
    const rateLimited = /使用人数较多|请稍后再试|rate limit|高峰时段|订阅.*优先|升级.*优先|too many requests/i.test(aText);
    if (r.answerQuality.chars === 0) r.status = 'blocked-no-answer';
    else if (rateLimited) r.status = 'blocked-rate-limited';
    else if (uiOnly) r.status = 'answer-suspect';
    else r.status = (!r.answerQuality.scriptNoise && r.answerQuality.chars >= 30 && (r.answerQuality.anchorFound || hasAnswerSignal))
      ? 'answered' : 'answered-unverified';
  } catch (e) {
    r.status = 'error';
    r.error = String(e).slice(0, 300);
  } finally {
    r.durationMs = Date.now() - t0;
    r.endedAt = new Date().toISOString();
  }
  return r;
}

export async function diagnose(page) {
  return {
    landing: await page.evaluate(landing),
    composer: await page.evaluate(composer),
    controls: await page.evaluate(markControls, CFG),
  };
}

export async function recoverAnswer(page, siteId, opts = {}) {
  const cfg = { prompt: PROMPT, from: opts.from || 'after-last', minCleanChars: opts.minCleanChars || 120,
    startMarks: opts.startMarks || [], maxMs: opts.waitMs || 150000, stableMs: opts.stableMs || 3000 };
  const a = await page.evaluate(getAnswerFn, cfg);
  return { site: siteId, label: page.label, answer: a };
}
