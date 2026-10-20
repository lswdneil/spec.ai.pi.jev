# mu

**A coding agent that thinks before it acts.** A small, fast judge makes the routine calls, so the main model can keep its attention on the work.

> **Early development.** The authors use mu every day, but names, settings and file formats may still change. Source, docs and the desktop app: [github.com/qybaihe/mu](https://github.com/qybaihe/mu) (README in English, 简体中文, 繁體中文, 日本語 and 한국어).

## Install

```bash
npm i -g mu-agent
mu
```

You need Node.js 22.19 or newer. The package is `mu-agent`; the command is `mu`. It runs on macOS, Linux, Windows and WSL.

`mu setup` connects a model from your shell. Paste an API key and mu detects the service from the key's format (DeepSeek, Qwen, Kimi, GLM, SiliconFlow, StepFun, OpenRouter, OpenCode Zen, OpenAI, Anthropic, Google Gemini, xAI), or pick Ollama or your own endpoint. It checks the key with one request, picks a starting model and sets up the judge. If no model is set up yet, the first `mu` offers to run it for you.

Inside mu, `/login` signs in to a provider or a subscription and `/model` switches models. `/help` lists everything. `mu doctor` checks your setup from the shell.

## What it adds to pi

mu is built on [pi](https://github.com/earendil-works/pi). It hands the small questions a coding agent keeps asking to a **judge**: is this message a new task or a correction, does this command need your permission, which part of a long test log matters, which subagent fits a job, what should the browser click next. Code acts on the answers, and the main model only sees what it needs.

- **Every decision is visible.** Each decision point is `off`, `shadow` (asked and logged, but not acted on) or `active`. `/ledger` and `mu ledger` show the verdicts.
- **Every decision fails open.** When the judge is unsure, slow or unreachable, a plain rule decides, or pi's default behavior runs.
- **And more:** a task frame that keeps your constraints in your own words, three permission modes (`/permissions`), goal mode (`/goal`), a plain-language progress board (`/board`), checkpoints and `/rewind`, subagents in their own git worktrees (`delegate`, `hive`), a judge-driven browser (`browse`), and the rules, skills and MCP servers you already set up in Claude Code, Cursor and Codex.

## Choose a judge

Out of the box, Jev 1.13 on OpenCode Zen answers for free (for a limited time) and needs no key. What it judges goes to OpenCode, which doesn't train on it, and mu reminds you of that once a day. To send nothing anywhere, start mu with `MU_JUDGE=off`, or use the local judge, Laya.

- **Jev** (hosted): set `TYPESAFE_API_KEY` (TypeSafe), `MU_JUDGE_OPENROUTER_API_KEY` (Jev on OpenRouter), `AI_GATEWAY_API_KEY` (Vercel AI Gateway) or `OPENCODE_API_KEY` (OpenCode Zen) in your environment, or add it to `~/.mu/.env` as `KEY=value`. `mu setup` asks for a key and writes it there. mu reads that file as data and never prints it, and switches to the key on its own.
- **Another classifier** from pi's catalog: `/mu judge classifier:<provider>/<model>`, for example Cloudflare's Clef (`clef`, `clef-flash`) or a System One model on OpenRouter, with that provider's key.
- **CLM** (self-hosted; its encoder needs a GPU): start `clm-serve` from [Contrastive-LM/CLM](https://github.com/Contrastive-LM/CLM), then run `/mu judge clm`. For a server on another machine, add `"judges": { "clm": { "type": "clm", "baseUrl": "http://<host>:8700" } }` to `~/.mu/agent/mu.json`. If the server was started with `CLM_API_KEY`, set the same value in `MU_JUDGE_CLM_API_KEY`. `mu doctor` checks the server.
- **Laya** (local, macOS on Apple silicon): `mu judge setup` installs it into `~/.mu/local-judge`. It downloads about 930 MB, and only when you run that command.
- **Any model you already use:** `/mu judge llm:<provider>/<model>`.

Verdicts take effect from the start (`active`). To only record what the judge would do, run `/mu mode default shadow`, or put `"modes": { "default": "shadow" }` in `~/.mu/agent/mu.json`.

## Commands

```text
mu                       interactive session in the current directory
mu "prompt"              interactive session, starting with this prompt
mu -p "prompt"           one-shot: print the answer and exit
mu -c | -r               continue the last session | pick one to resume
mu setup                 connect a model and choose a judge (mu setup --help for scripts and services)
mu judge <cmd>           the local judge (Laya): setup | start | stop | status | run
mu ledger [n] [--json]   the judge's verdicts from the last n sessions
mu import --list | <file>...   import Claude Code and Codex conversations (mu import --help)
mu doctor                check the installation
mu auth <cmd>            subscription sign-in for the desktop app: status | login | logout
mu link | unlink         put the mu command on your PATH | remove it
mu help | version
```

Everything else goes to the agent unchanged: `mu --help` lists every flag. mu keeps its files in `~/.mu`, separate from a regular pi install in `~/.pi`.

## Themes

In the terminal, mu starts in its own themes, `mu-dark` or `mu-light` to match your terminal, until you pick a theme in `/settings`. Choose `system` there to use your terminal's own palette.

## Update and remove

```bash
npm i -g mu-agent@latest
npm rm -g mu-agent
```

Removing the package keeps `~/.mu` (your sessions, settings and sign-ins).

## License

MIT. pi is by Mario Zechner and contributors. Third-party code in the judgment layer is listed in `judge/THIRD_PARTY_NOTICES.md`.
