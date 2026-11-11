/* Re-run the site list in PRIORITY ORDER, in batches of 5 pages.
 * Put this file next to ego_ask_lib.mjs and ego_sites.json, or set
 * WAS_LIB / WAS_SCRIPTS to absolute paths.
 * Run: ego-browser nodejs -e "await import('file:///<absolute-path>/round.mjs')"
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const libUrl = process.env.WAS_LIB || new URL('./ego_ask_lib.mjs', import.meta.url).href;
const scripts = process.env.WAS_SCRIPTS || here;
const { ask, save, setPrompt, setOutDir } = await import(libUrl);
const { readFile } = await import('node:fs/promises');

const GOAL = process.env.WAS_OUT_DIR || 'web-ai-search-runs';
const TASK = process.env.WAS_TASK || 'web-ai-search-batch';
const cfg = JSON.parse(await readFile(path.join(scripts, 'ego_sites.json'), 'utf8'));
setOutDir(GOAL);
setPrompt(cfg.prompt);

const task = await taskSpace(TASK);
console.log({ spaceId: task.spaceId, sites: cfg.sites.length });

const managed = await task.pages();
const byLabel = new Map(managed.map(p => [p.label, p]));
const pages = [];
for (let i = 0; i < 5; i++) {
  const label = 'p' + (i + 1);
  if (byLabel.has(label)) pages.push(byLabel.get(label));
  else { const p = await task.newPage(); pages.push(p); byLabel.set(p.label, p); }
}

for (let i = 0; i < cfg.sites.length; i += 5) {
  const batch = cfg.sites.slice(i, i + 5);
  const results = await Promise.all(batch.map((s, j) => ask(pages[j], s)));
  await save('batch-' + (i / 5 + 1), results);
  console.log(JSON.stringify(results.map(r => ({
    site: r.site, status: r.status, fresh: r.freshAction,
    web: r.webAction, cf: r.cfAction || 'no-challenge',
    chars: r.answer && r.answer.chars,
    anchor: r.answerQuality && r.answerQuality.anchorFound,
    noise: r.answerQuality && r.answerQuality.scriptNoise,
    error: r.error,
  })), null, 2));
}

// All results are already on disk; closing the space is safe even if a site failed.
await task.finish({ keep: [] });
