# 站点清单与专属注意事项

站点 URL 以 `scripts/ego_sites.json` 为准（顺序即调用优先级）。下表是控件与坑的速查，DOM 改版时以当次诊断为准。

| 站点 | URL | 新会话 | 联网 / 档位 | 抓取与注意 |
| --- | --- | --- | --- | --- |
| Perplexity | `https://www.perplexity.ai/` | 首页即新会话 | 默认联网，无开关 | 来源卡片多，正文回退时按「个来源 / 提出后续问题 / Cookie 政策」截断 |
| ChatGPT | `https://chatgpt.com/` | 侧栏「新聊天」 | 工具菜单里选「网页搜索」 | 工具菜单可能往输入框插入标签，发送前清空编辑器；正文回退抓取 |
| Gemini | `https://gemini.google.com/app` | URL 直达 | 工具按钮 | 页脚/订阅 UI 可能混入，按尾部标记截断 |
| Grok | `https://grok.com/` | 首页即新会话 | 自动实时检索 | 首访可能有 CF 挑战，真点复选框；不要并发多标签 |
| Muse | `https://muse.ai/` | 侧栏「新旁聊」（异步渲染，需等待按钮出现） | 联网能力未确认 | 输入框 `textarea[placeholder="消息"]`；侧栏「搜索」是站内搜索，别当联网开关 |
| Claude | `https://claude.ai/new` | URL 直达 | 搜索网页 | 首次可能有 Cookie 同意菜单；答案含 Sources |
| 豆包 | `https://www.doubao.com/chat/` | `[data-testid="create_conversation_button"]`（新对话，Ctrl+Shift+K） | 参考多篇资料 | 不要用 `create_office_task_button`（新工作任务，Ctrl+J）；点击被遮挡时 `focus()` 回退 |
| Qwen | `https://chat.qwen.ai/` | 侧栏「新对话」 | 完成思考并附官方链接 | 尾部「自动生成」UI 需截断 |
| DeepSeek | `https://chat.deepseek.com/` | 侧栏「新对话」 | 深度思考 + 联网 | 答案可能带完整思考链，抓取会剥离明确标注的思考段 |
| 阶跃 AI | `https://www.stepfun.com/chats/new` | URL 直达 | composer「搜索」按钮 | 答案位于末尾输入框提示文本**之前**：`answerFrom=before-first` + `answerStartMarks`；等待可能超时但答案已生成 |
| Z.ai | `https://zchat.z.ai/` | 首页直达 | `GLM-5.3-Flash` + 思考强度「低」 | 「思考强度」是滑块 `[data-slider-root]`，点最左端设低；高峰时段可能限流 |
| 腾讯混元 | `https://aistudio.tencent.com/` | 侧栏新建会话 | 每次新会话都要点 `SPAN.online-tool-icon` 联网图标；档位 `No Think` | 不点联网会出现时间幻觉；联网工具会在答案前输出检索计划，按需截取结论 |
| MiMo | `https://aistudio.xiaomimimo.com/#/` | 门户里点「新对话」 | 默认联网，无开关 | 门户无输入框，按钮真实点击被拦截时用 DOM click；个别档位可能给推断式答案，如实标注 |
| Kimi | `https://kimi.moonshot.cn/` | `?chat_enter_method=new_chat` | 菜单「联网搜索」；思考强度「标准」 | 偶发新会话未跳转（`chars=0`）或站点限流，重试一轮；`thinkLevel` 可覆盖为「进阶」 |

## 通用坑

- 站点卡里的按钮名只是常见形态；一律以当次 `page.evaluate` 诊断或 `take_snapshot` 为准。
- 不要在汇总里声称已开启联网，除非开关点击成功或按钮状态可见变化；默认联网站点标注「默认联网」。
- 答案抓取先看 `answerQuality`：锚点未命中、脚本噪声、侧栏历史混入时按正文复核，不要整段引用。
- 复杂问题可在 round 脚本里覆盖 `site.thinkLevel` 或替换 `site.clickSequence`，不需要改 skill 文件。
