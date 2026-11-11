/* Re-run the site list in PRIORITY ORDER, in batches of 5 pages.
 *
 * IMPORTANT: ego-browser's nodejs runtime does NOT inherit shell environment
 * variables. Put overrides in `run.json` next to this file (or edit constants).
 *   { "prompt": "...", "sites": ["perplexity","chatgpt"], "outDir": "...",
 *     "task": "...", "waitMs": 90000, "stableMs": 2500, "lib": "file:///..." }
 * Omit "sites" to run all sites; this script is an acceptance/benchmark run,
 * while daily use should only call the top 1-3 sites.
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
const TASK = run.task || 'web-ai-search-batch';
let sites = cfg.sites.slice();
if (run.sites && run.sites.length) sites = cfg.sites.filter(s => run.sites.includes(s.id));
sites = sites.map(s => ({ ...s, ...(run.waitMs ? { waitMs: run.waitMs } : {}), ...(run.stableMs ? { stableMs: run.stableMs } : {}) }));

setOutDir(GOAL);
setPrompt(PROMPT);

const task = await taskSpace(TASK);
console.log({ spaceId: task.spaceId, sites: sites.map(s => s.id), prompt: PROMPT.slice(0, 60) });

const managed = await task.pages();
const byLabel = new Map(managed.map(p => [p.label, p]));
const pages = [];
for (let i = 0; i < 5; i++) {
  const label = 'p' + (i + 1);
  if (byLabel.has(label)) pages.push(byLabel.get(label));
  else { const p = await task.newPage(); pages.push(p); byLabel.set(p.label, p); }
}

for (let i = 0; i < sites.length; i += 5) {
  const batch = sites.slice(i, i + 5);
  const t0 = Date.now();
  const results = await Promise.all(batch.map((s, j) => ask(pages[j], s)));
  await save('batch-' + (i / 5 + 1), results);
  console.log(JSON.stringify({
    batch: i / 5 + 1, batchMs: Date.now() - t0,
    rows: results.map(r => ({
      site: r.site, status: r.status, durationMs: r.durationMs,
      wait: r.waitStatus, chars: r.answer && r.answer.chars,
      webAction: r.webAction, webEvidence: r.webEvidence && { sources: r.webEvidence.sourceCards, links: r.webEvidence.textLinks.length },
      error: r.error,
    })),
  }, null, 2));
}

// All results are already on disk: finishing is safe even if some sites failed.
await task.finish({ keep: [] });
