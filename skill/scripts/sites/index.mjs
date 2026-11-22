// Site registry: array order is call priority. One file per site under sites/.
import perplexity from './perplexity.mjs';
import chatgpt from './chatgpt.mjs';
import gemini from './gemini.mjs';
import grok from './grok.mjs';
import muse from './muse.mjs';
import claude from './claude.mjs';
import doubao from './doubao.mjs';
import qwen from './qwen.mjs';
import deepseek from './deepseek.mjs';
import stepfun from './stepfun.mjs';
import zai from './zai.mjs';
import hunyuan from './hunyuan.mjs';
import mimo from './mimo.mjs';
import kimi from './kimi.mjs';

export const sites = [
  perplexity, chatgpt, gemini, grok, muse, claude, doubao, qwen,
  deepseek, stepfun, zai, hunyuan, mimo, kimi,
];

export const siteIds = sites.map(s => s.id);

export function resolveSites(selection) {
  if (!selection || selection === 'all' || (Array.isArray(selection) && !selection.length)) return sites.slice();
  const wanted = Array.isArray(selection) ? selection : [selection];
  return sites.filter(s => wanted.includes(s.id));
}

export function applyOverrides(site, run = {}) {
  const out = { ...site };
  if (run.waitMs) out.waitMs = run.waitMs;
  if (run.stableMs) out.stableMs = run.stableMs;
  return out;
}
