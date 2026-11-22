/* Back-compat batch example. New code should call search() directly:
 *   import { search } from 'file:///<SKILL>/scripts/search.mjs';
 *   await search({ prompt: '...', sites: 'all' });
 * This wrapper still honours run.json next to it.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { search } from './search.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
let run = {};
try {
  run = JSON.parse((await readFile(path.join(here, 'run.json'), 'utf8')).replace(/^\uFEFF/, ''));
} catch (_) { }

const DEFAULT_PROMPT = '请联网搜索：所用编程语言的最新稳定版本是什么？请给出官方来源链接，并写出一条安装命令。';

await search({
  prompt: run.prompt || DEFAULT_PROMPT,
  sites: run.sites || 'all',
  outDir: run.outDir,
  task: run.task,
  waitMs: run.waitMs,
  stableMs: run.stableMs,
  batch: run.batch,
});
