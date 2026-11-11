/* Minimal single-site round for the ego lite backend.
 * Copy this file AND ego_ask_lib.mjs into a goal directory, or set
 * WAS_LIB to an absolute file:/// URL pointing at the installed library.
 * Run: ego-browser nodejs -e "await import('file:///<absolute-path>/round.mjs')"
 * Do NOT finish() on failure: a failed round must stay recoverable.
 */
const libUrl = process.env.WAS_LIB || new URL('./ego_ask_lib.mjs', import.meta.url).href;
const { ask, save, setPrompt, setOutDir } = await import(libUrl);

const GOAL = process.env.WAS_OUT_DIR || 'web-ai-search-runs';
const TASK_NAME = process.env.WAS_TASK || 'web-ai-search-demo';
const PROMPT = process.env.WAS_PROMPT || '请联网搜索并用一句话说明 Node.js LTS 是什么，给出官方下载页链接。';
const SITE = { id: 'perplexity', url: 'https://www.perplexity.ai/' };

setOutDir(GOAL);
setPrompt(PROMPT);

const task = await taskSpace(TASK_NAME);
console.log({ spaceId: task.spaceId, taskName: TASK_NAME });

const page = task.page('p1');
const result = await ask(page, SITE);
await save('round-01', [result]);
console.log({
  site: result.site, status: result.status, webAction: result.webAction,
  answerHead: ((result.answer && result.answer.text) || '').slice(0, 220),
  error: result.error,
});

if (result.status === 'answered' && result.answer && result.answer.chars > 20) {
  await task.finish({ keep: [] });
  console.log('finished');
} else {
  console.log('NOT finished: inspect this page in a new round before finishing.');
}
