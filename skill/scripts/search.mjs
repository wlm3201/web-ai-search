/* Web AI Search — single-entry API.
 *
 * Everything browser-specific (TaskSpace, pages, CF, web toggles, streaming
 * wait, answer extraction, saving, cleanup) stays inside this module, plus the
 * generic engine.mjs and per-site configs in sites/.
 *
 * Use from an ego-browser nodejs task file:
 *   import { search } from 'file:///<SKILL>/scripts/search.mjs';
 *   const out = await search({ prompt: '请联网搜索：...' });
 *
 * Options:
 *   prompt   (required) question to ask every site
 *   sites    'all' | ['perplexity','chatgpt'] | undefined (default: top 3)
 *   outDir   absolute results directory (default: os.tmpdir()/web-ai-search-runs/<stamp>)
 *   task     TaskSpace name (default: web-ai-search-<stamp>)
 *   waitMs / stableMs  overrides for every selected site
 *   batch    pages per batch, 1-5 (default: 5)
 *   finish   call task.finish after save (default: true)
 */
import os from 'node:os';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { ask, save, setPrompt, setOutDir } from './engine.mjs';
import { resolveSites, applyOverrides, siteIds } from './sites/index.mjs';

export { sites, siteIds } from './sites/index.mjs';
export { diagnose, recoverAnswer } from './engine.mjs';

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');

function summaryRow(r) {
  return {
    site: r.site,
    status: r.status,
    durationMs: r.durationMs,
    chars: r.answer && r.answer.chars || 0,
    sources: r.webEvidence ? r.webEvidence.sourceCards : 0,
    links: r.answer && r.answer.links ? r.answer.links.length : 0,
    answerHead: ((r.answer && r.answer.text) || '').slice(0, 160),
    warnings: r.warnings || [],
    error: r.error,
  };
}

export async function search(options = {}) {
  const prompt = options.prompt;
  if (!prompt || typeof prompt !== 'string') throw new Error('search() requires options.prompt');

  const selected = resolveSites(options.sites === undefined ? ['perplexity', 'chatgpt', 'gemini'] : options.sites);
  if (!selected.length) throw new Error(`no sites selected; valid ids: ${siteIds.join(', ')}`);
  const siteList = selected.map(s => applyOverrides(s, options));

  const runStamp = stamp();
  const defaultOut = path.join(os.tmpdir(), 'web-ai-search-runs', runStamp);
  const outDir = options.outDir
    ? (path.isAbsolute(options.outDir) ? options.outDir : path.join(os.tmpdir(), options.outDir))
    : defaultOut;
  await mkdir(outDir, { recursive: true });
  setOutDir(outDir);
  setPrompt(prompt);

  const taskName = options.task || `web-ai-search-${runStamp}`;
  const task = await taskSpace(taskName);
  const batchSize = Math.max(1, Math.min(5, options.batch || 5));
  const managed = await task.pages();
  const byLabel = new Map(managed.map(p => [p.label, p]));
  const pages = [];
  for (let i = 0; i < Math.min(batchSize, siteList.length); i++) {
    const label = 'p' + (i + 1);
    if (byLabel.has(label)) pages.push(byLabel.get(label));
    else { const p = await task.newPage(); pages.push(p); }
  }

  const startedAt = Date.now();
  const progress = { total: siteList.length, done: 0, outDir, sites: [] };
  const mark = async (row) => {
    progress.done++;
    progress.sites.push({ site: row.site, status: row.status, chars: row.answer && row.answer.chars || 0, durationMs: row.durationMs });
    console.error(`[web-ai-search] ${progress.done}/${progress.total} ${row.site} -> ${row.status} (${row.answer && row.answer.chars || 0} chars)`);
    await save('progress', progress, outDir);
  };
  console.error(`[web-ai-search] start: ${siteList.map(s => s.id).join(', ')} -> ${outDir}`);

  const results = [];
  for (let i = 0; i < siteList.length; i += batchSize) {
    const batchSites = siteList.slice(i, i + batchSize);
    console.error(`[web-ai-search] batch ${Math.floor(i / batchSize) + 1}: ${batchSites.map(s => s.id).join(', ')}`);
    const rows = await Promise.all(batchSites.map((s, j) => ask(pages[j], s)));
    for (const row of rows) { results.push(row); await mark(row); }
    await save(`batch-${Math.floor(i / batchSize) + 1}`, rows, outDir);
  }
  progress.elapsedMs = Date.now() - startedAt;
  await save('progress', progress, outDir);
  await save('answers', results, outDir);
  const summary = results.map(summaryRow);
  await save('summary', summary, outDir);

  const payload = {
    ok: true,
    spaceId: task.spaceId,
    prompt,
    outDir,
    sites: siteList.map(s => s.id),
    summary,
    resultFiles: ['answers.json', 'summary.json', 'progress.json', ...Array.from({ length: Math.ceil(siteList.length / batchSize) }, (_, k) => `batch-${k + 1}.json`)],
  };
  console.log(JSON.stringify(payload, null, 2));
  if (options.finish !== false) await task.finish({ keep: [] });

  return {
    ...payload,
    results,
  };
}

export default search;
