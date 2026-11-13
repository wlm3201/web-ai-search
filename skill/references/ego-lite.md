# ego lite 后端指南

## 1. 运行方式

1. 先运行 `ego-browser skill` 读当前版本的完整指南；输出很长时存成文件分段读，确认看到结束标记。
2. PowerShell 无 heredoc，且旧版会破坏双引号/非 ASCII：把整个任务写成 UTF-8 `.mjs` 文件，只执行一行 ASCII 入口：

   ```
   ego-browser nodejs -e "await import('file:///<绝对路径>/round.mjs')"
   ```

   若 `ego-browser` 不在 PATH，用安装目录里的可执行文件绝对路径调用。
3. 一个目标一个目录，**每轮写新的完整文件**（`round-01.mjs`、`round-02.mjs`…），不要编辑旧文件重放。共享库用相对 `import` 或绝对 `file:///` URL。
4. 每次 `nodejs` 是新进程：JS 变量不保留，TaskSpace / 页面标签保留。用一个 `taskSpace(name)` 并打印 `spaceId`，后续用 `taskSpace(name)` 或 `takeOverTaskSpace(id)` 恢复。
5. Page 预算约 5 个；复用 `goto()` 而不是无限 `newPage()`。
6. stdout 对中文/长文本会截断：结果写 JSON 文件，stdout 只打印精简摘要。

## 2. 页面内 JS 的硬性约束

- `page.evaluate(fn, arg)` 的 `fn` 在页面执行，序列化时不带 Node 侧闭包：所有辅助函数必须定义在 `fn` 内部，否则 `ReferenceError`。
- `arg` 只能是一个 JSON-serializable 值：正则、函数、DOM 节点都不能传；正则改传字符串，在页面内 `new RegExp(pattern,'i')`。
- `page.waitForFunction(fn, arg, {timeout, polling})` 用于长轮询；`page.evaluate` 无 timeout。
- 发送后新建会话常导航，window 重建：自定义等待状态要自愈初始化。

## 3. Cloudflare / Turnstile

1. 若标题是「请稍候…」、正文有「正在进行安全验证 / Just a moment」，`page.snapshot()` 会显示 iframe 内的 `checkbox "请验证您是真人" [ref=N]`。
2. `await page.click('@N')` 真实点击，不要 `element.click()`。
3. 等编辑器出现；通过后不要刷新，也不要再开同域挑战页。两次不过才交用户人工处理。

## 4. 权限弹窗与空间恢复

- 浏览器自有的通知/定位/剪贴板/粘贴类权限提示有时会把 TaskSpace 交还用户。先判断该提示是否**必须用户处理**：属于必须人工处理的，遵循运行时官方指南 `handOff()` 并停止，不要用 `takeOverTaskSpace` 绕过；只是无意义弹窗且已获用户授权的，才用 `takeOverTaskSpace(spaceId)` 恢复同一空间继续。
- 无论哪种情况都不新建空间、不盲目重试同一失败命令；登录、人工验证码、支付、显式接管一律停止。

## 5. 输入、开关与按钮

- 输入：`click(editor)` → `keyboard.paste(PROMPT)` → `keyboard.press('Enter')`。点击被遮挡时 `Escape` → `page.focus(editor)` 回退。
- 门户类按钮真实点击被拦截时，用 `page.evaluate(() => el.click())` 的 DOM click。
- 联网开关优先匹配 composer 附近文本（联网搜索 / 网页搜索 / web search），其次打开工具菜单；不要用泛化的「搜索」，会误点侧栏。
- 无文字图标开关按 class / `data-*` 定位；每个新会话都要重新点一次。
- 站点档位（模型、思考强度、滑块）用 `clickSequence` 按序点击；滑块用鼠标点最左端设低。

## 6. 等待、抓取与质量

- 判定：答案文本稳定 ≥3s + 停止按钮消失 + 文本含答案信号；单次上限约 150s，未完成下一轮继续。
- 不要只依赖消息容器选择器：部分站点抓不到答案，用清理后的正文回退。
- 正文清理：在活动 DOM 上临时隐藏左侧窄栏与 `script/style`，读 `body.innerText` 后恢复。**不要对 detached clone 取 `innerText`**（为空，回退 `textContent` 会把脚本/CSS 当答案）。
- 按 `answerFrom` 定位提示文本（`after-last` 默认，`before-first` 用于答案位于末尾输入框之前的站点）；锚点未命中时改用语义消息容器，不拿整页尾部兜底当答案。
- `stripThinking` 只在文本明确标注了思考/检索过程时剥离；站点未标注则保留全文。
- `answerQuality`（anchor / scriptNoise / cleaning）与 `status`（`answered` / `answered-unverified`）用于复核，不要只看状态。

## 7. 批量与收尾

- 每批最多 5 个站点并发，每站一个 Page；已过 CF 的页面可 `skipGoto:true` 复用。
- 结果文件命名 `round-XX.json` / `batch-N.json`，便于汇总回溯。
- 成功且结果已落盘后：`await task.finish({keep:[]})` 只调一次；失败时保留空间供下一轮恢复。

## 8. 后端说明

- 本 skill 只使用 ego lite，所有页面操作都通过 `ego-browser nodejs` 的 `page` API 完成。
- 不要清理 profile、不要 `isolatedContext`、不要改 UA，否则会丢登录态或触发风控。

## 10. 运行时约束与自检

- **`nodejs` 运行时不继承 shell 环境变量**：`process.env` 里的外部变量读不到。题目、站点子集、输出目录、等待上限一律写进 `run.json` 或脚本常量。
- 等待上限与稳定窗口可在站点配置里用 `waitMs` / `stableMs` 覆盖；`ask()` 会同时传给 `page.waitForFunction` 和页面内的 `checkDone`。
- 开始前自检：CLI 可用、指南读完、浏览器已登录目标站点、代理就绪（可选）、输出目录可写。
- `ask()` 会在 landing 阶段检测未登录页面并直接返回 `blocked-not-logged-in`，不会白等到超时；遇到该状态先在浏览器里登录再重跑。
- 结果里的 `durationMs` 可用于比较各站耗时；`batchMs` 是整批墙钟时间。
