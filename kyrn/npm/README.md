# spec.jev

**A coding agent with a judgment kernel.** It hands its routine decisions to a small, fast judge model, so the main model can keep its attention on the work.

> **Early development.** The authors use spec.jev every day, but names, settings and file formats may still change. Source, docs and the desktop app: [github.com/lswdneil/spec.ai.pi.jev](https://github.com/lswdneil/spec.ai.pi.jev) (README in English, 简体中文, 繁體中文, 日本語 and 한국어).

## Install

```bash
npm i -g spec.jev
spec.jev
```

You need Node.js 22.19 or newer. The package is `spec.jev`; the command is `spec.jev`. It runs on macOS, Linux, Windows and WSL.

`spec.jev setup` connects a model from your shell. Paste an API key and spec.jev detects the service from the key's format (DeepSeek, Qwen, Kimi, GLM, SiliconFlow, StepFun, OpenRouter, OpenCode Zen, OpenAI, Anthropic, Google Gemini, xAI), or pick Ollama or your own endpoint. It checks the key with one request, picks a starting model and sets up the judge. If no model is set up yet, the first `spec.jev` run offers to start setup.

Inside spec.jev, `/login` signs in to a provider or a subscription and `/model` switches models. `/help` lists everything. `spec.jev doctor` checks your setup from the shell.

## What it adds to pi

spec.jev is built on [pi](https://github.com/earendil-works/pi). It hands the small questions a coding agent keeps asking to a **judge**: is this message a new task or a correction, does this command need your permission, which part of a long test log matters, which subagent fits a job, what should the browser click next. Code acts on the answers, and the main model only sees what it needs.

- **Every decision is visible.** Each decision point is `off`, `shadow` (asked and logged, but not acted on) or `active`. `/ledger` and `spec.jev ledger` show the verdicts.
- **Every decision has a fallback.** When the judge is unsure, slow or unreachable, a plain rule decides, or pi's default behavior runs. For approvals, the fallback is to ask you.
- **And more:** a task frame that keeps your constraints in your own words, three permission modes (`/permissions`), goal mode (`/goal`), a plain-language progress board (`/board`), checkpoints and `/rewind`, subagents that edit in their own git worktrees (`delegate`), read-only hives of investigators (`hive`), a judge-driven browser (`browse`), and the rules, skills and MCP servers you already set up in Claude Code, Cursor and Codex.

## Choose a judge

Out of the box, Jev 1.13 on OpenCode Zen answers for free (for a limited time) and needs no key. What it judges goes to OpenCode, which doesn't train on it, and spec.jev reminds you of that once a day. To send nothing anywhere, start spec.jev with `SPECJEV_JUDGE=off`, or use the local judge, Laya.

- **Jev** (hosted): set `TYPESAFE_API_KEY` (TypeSafe), `SPECJEV_JUDGE_OPENROUTER_API_KEY` (Jev on OpenRouter), `AI_GATEWAY_API_KEY` (Vercel AI Gateway), `OPENCODE_API_KEY` (OpenCode Zen) or `CLOUDFLARE_API_KEY` with `CLOUDFLARE_ACCOUNT_ID` (Cloudflare Workers AI) in your environment, or add it to `~/.spec.jev/.env` as `KEY=value`. `spec.jev setup` asks for a key and writes it there. spec.jev reads that file as data and never prints it, and starts using the key automatically.
- **Another classifier** from pi's catalog: `/mu judge classifier:<provider>/<model>`, for example Cloudflare's Clef (`clef`, `clef-flash`) or a System One model on OpenRouter, with that provider's key.
- **CLM** (self-hosted; its encoder needs a GPU): start `clm-serve` from [Contrastive-LM/CLM](https://github.com/Contrastive-LM/CLM), then run `/mu judge clm`. For a server on another machine, add `"judges": { "clm": { "type": "clm", "baseUrl": "http://<host>:8700" } }` to `~/.spec.jev/agent/spec.jev.json`. If the server was started with `CLM_API_KEY`, set the same value in `SPECJEV_JUDGE_CLM_API_KEY`. `spec.jev doctor` checks the server.
- **Laya** (local, macOS on Apple silicon): `spec.jev judge setup` installs it into `~/.spec.jev/local-judge`. It downloads about 930 MB, and only when you run that command.
- **Any model you already use:** `/mu judge llm:<provider>/<model>`.

38 of the 40 decision points act on their verdicts from the start (`active`); `context.compact` and `output.drift` belong to features that are off until you turn them on. To only record what the judge would do, run `/mu mode default shadow`, or put `"modes": { "default": "shadow" }` in `~/.spec.jev/agent/spec.jev.json`.

## Commands

```text
spec.jev                       start a session in the current directory
spec.jev "prompt"              start a session with this prompt
spec.jev -p "prompt"           run one prompt, print the answer and exit
spec.jev -c | -r               continue the last session | pick a session to resume
spec.jev setup                 connect a model and choose a judge (see spec.jev setup --help for scripting and services)
spec.jev judge <cmd>           manage the local judge, Laya (macOS on Apple silicon): setup | start | stop | status | run
spec.jev ledger [n] [--json]   print the judge's verdicts from the last n sessions
spec.jev import --list | <file>...   import Claude Code and Codex conversations (spec.jev import --help)
spec.jev doctor                check the installation, the judges and the connections
spec.jev auth <cmd>            sign-in helper for the desktop app: status | login | logout
spec.jev link | unlink         put the spec.jev command on your PATH | remove it
spec.jev help | version        show this help | print the version
```

Everything else goes to pi unchanged: `spec.jev --help` also shows pi's options. spec.jev keeps its files in `~/.spec.jev`, separate from a regular pi install in `~/.pi`.

## Themes

In the terminal, spec.jev starts in its own themes, `spec.jev-dark` or `spec.jev-light` to match your terminal, until you pick a theme in `/settings`. Choose `system` there to use your terminal's own palette.

## Update and remove

```bash
npm i -g spec.jev@latest
npm rm -g spec.jev
```

Removing the package keeps `~/.spec.jev` (your sessions, settings and sign-ins).

## License

MIT. pi is by Mario Zechner and contributors. Third-party code in the judgment kernel is listed in `judge/THIRD_PARTY_NOTICES.md`.
