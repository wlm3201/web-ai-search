/* Minimal single-site round for the ego lite backend.
 *
 * IMPORTANT: ego-browser's nodejs runtime does NOT inherit shell environment
 * variables. Put overrides in `run.json` next to this file (or edit the
 * constants below). `run.json` may contain:
 *   { "prompt": "...", "sites": ["perplexity"], "outDir": "...",
 *     "task": "...", "waitMs": 90000, "stableMs": 2500, "lib": "file:///..." }
 *
 * The library is resolved relative to this file by default, so copying this
 * script together with ego_ask_lib.mjs into a goal directory works.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const here = path.dirname(fileURLToPath(import.meta.url));
const load = async (name) => {
  try {
    const raw = await readFile(path.join(here, name), 'utf8');
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch { return {}; }
};
const cfg = await load('ego_sites.json');
const run = await load('run.json');
const libUrl = run.lib || new URL('./ego_ask_lib.mjs', import.meta.url).href;
const { ask, save, setPrompt, setOutDir } = await import(libUrl);

const PROMPT = run.prompt || cfg.prompt;
const GOAL = run.outDir || 'web-ai-search-runs';
const TASK = run.task || 'web-ai-search-single';
const wanted = (run.sites && run.sites[0]) || cfg.sites[0].id;
const base = cfg.sites.find(s => s.id === wanted) || cfg.sites[0];
const site = { ...base };
if (run.waitMs) site.waitMs = run.waitMs;
if (run.stableMs) site.stableMs = run.stableMs;

setOutDir(GOAL);
setPrompt(PROMPT);

const task = await taskSpace(TASK);
console.log({ spaceId: task.spaceId, taskName: TASK, site: site.id });
const page = task.page('p1');
const result = await ask(page, site);
await save('round-single', [result]);

console.log(JSON.stringify({
  site: result.site, status: result.status, durationMs: result.durationMs,
  wait: result.waitStatus, chars: result.answer && result.answer.chars,
  webAction: result.webAction, webEvidence: result.webEvidence,
  answerHead: ((result.answer && result.answer.text) || '').slice(0, 180),
  error: result.error,
}, null, 2));

// Results are already on disk: finishing is safe even when this site failed.
await task.finish({ keep: [] });
