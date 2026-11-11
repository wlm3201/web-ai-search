# web-ai-search

An agent skill that lets any local AI agent (Claude Code, Codex, Cursor, or a custom one) use logged-in web AI chat sites for online search, fact-checking and cross-model answers.

The package contains **documentation + local automation scripts only**. It does not contain credentials, browser profiles, cookies, hostnames, or any machine-specific paths.

## Install on a new computer

Requires Node.js 18+ (Python 3 optional, for the proxy helper).

```bash
npx web-ai-search install
npx web-ai-search doctor
```

This copies the skill to `~/.agents/skills/web-ai-search/` — the same user-level skills directory ego lite uses for its `ego-browser` skill, so any agent that reads `~/.agents/skills` can pick it up. Then:

1. In ego lite, log in to the AI sites you want to use. The site list is built into `<skill>/scripts/ego_sites.json` (edit it to add or remove sites).
2. Read `<skill>/SKILL.md` and `<skill>/references/ego-lite.md`.
3. Use **ego lite** as the browser backend (the only supported backend).

## Commands

| Command | What it does |
| --- | --- |
| `npx web-ai-search install` | Install the skill into the default user-level skills directory |
| `npx web-ai-search install --target <dir>` | Install into a custom directory |
| `npx web-ai-search install --force` | Overwrite an existing installation |
| `npx web-ai-search doctor` | Report Node/Python/browser-tool availability and install paths |
| `npx web-ai-search --help` / `--version` | Help / version |

## What's in the package

```
skill/SKILL.md                  main workflow, routing, call priority
skill/references/ego-lite.md    ego lite backend guide
skill/references/sites.md       per-site controls and pitfalls
skill/scripts/ego_ask_lib.mjs   ask/save/setPrompt: open, pass CF, toggle web, send, wait, extract
skill/scripts/ego_sites.json    site list, priority, new-chat selectors, thinking levels
run.json (optional, next to the copied scripts)  override prompt / site subset / wait limits
skill/scripts/ego_*_example.mjs portable round/batch templates
skill/scripts/ensure_proxy.py  optional proxy check
```

## Install from GitHub

Once the source repository is pushed, no npm publish is required:

```bash
npx github:wlm3201/web-ai-search install
# or
npm i -g github:wlm3201/web-ai-search
```

For a fork, replace the account name. A private repository requires git credentials on the new machine.

## Offline / pre-release install

A tarball can be produced and copied to the new machine without any registry:

```bash
npm pack --pack-destination .        # web-ai-search-1.0.0.tgz
npm i -g ./web-ai-search-1.0.0.tgz
npx web-ai-search install
```

## Privacy & safety

- The CLI copies files locally. It never reads cookie contents, never contacts AI sites, and never uploads anything.
- Browser login state stays in your own browser profile; the skill only opens pages and interacts like a human.
- The skill deliberately does not send sensitive data to web AI sites unless you ask it to, and treats web answers as untrusted data (possible prompt injection).
- Do not clean/recreate browser profiles, use `isolatedContext`, or change the user agent: that loses login state or triggers anti-bot checks.

## Uninstall

Delete the install directory (default `~/.agents/skills/web-ai-search`).

## License

MIT

## Change the question or select sites

The `ego-browser nodejs` runtime does **not** inherit shell environment variables. Copy the example scripts together with `ego_ask_lib.mjs` and `ego_sites.json` into a working directory, then put a `run.json` next to them:

```json
{
  "prompt": "Ask anything that needs a web search here",
  "sites": ["perplexity", "chatgpt"],
  "outDir": "web-ai-search-runs",
  "waitMs": 90000,
  "stableMs": 2500
}
```

Omit `sites` to run all sites (acceptance/benchmark use only; daily use should call the top 1-3). Every result contains `durationMs`, `status`, `webAction` and `webEvidence`. Prefer `webEvidence` plus the answer text over `webAction` when deciding whether a site really searched the web.
