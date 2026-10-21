---
title: Getting started
summary: Install the desktop app or the command line, connect a model and run a first task.
---

spec.jev comes in two forms: a **desktop app** that carries everything it needs, and the **`spec.jev` command line**. Both share accounts, settings, sessions and lessons, so you can start a task in one and pick it up in the other.

## The desktop app {#desktop-app}

1. Download the build for your system from [Releases](https://github.com/qybaihe/mu/releases/latest), or from the [home page](@home#install), which picks your system for you.

   | System | File |
   | --- | --- |
   | macOS, Apple silicon | `spec.jev-<version>-mac-arm64.dmg` |
   | macOS, Intel | `spec.jev-<version>-mac-x64.dmg` |
   | Windows x64 / Arm | `spec.jev-<version>-win-x64.exe` / `spec.jev-<version>-win-arm64.exe` |
   | Linux x64 / Arm (Debian, Ubuntu) | `spec.jev-<version>-linux-amd64.deb` / `spec.jev-<version>-linux-arm64.deb` |

   `SHA256SUMS` on the release page lists the checksum of every file. The macOS builds are signed and notarized by Apple. The Windows builds aren't code-signed yet, so SmartScreen warns the first time: choose **More info**, then **Run anyway**.
2. Open it. The first-run guide walks through four steps: a model, a permission mode, a judge and a start.
   - **Model.** Paste an API key, and spec.jev recognizes the service from its shape (DeepSeek, Kimi, Qwen, GLM, SiliconFlow, OpenRouter, OpenAI, Anthropic, Google Gemini, xAI and more) and checks it with one request. Or sign in with a ChatGPT, Claude, Grok or Google subscription. A wrong key, an empty balance, an unsupported region or no connection is each explained with what to do.
   - **Permissions.** *Jev approves* is preselected; see [Permissions and safety](@docs/permissions).
   - **Judge.** With no key, the free Jev answers. You can come back to this any time.
   - **Start.** If spec.jev finds Claude Code or Codex conversations, it offers to import them.
3. Pick a folder and start a conversation.

Nothing else needs installing: no Node.js, and nothing is downloaded at the first start. When a new release is out, the app tells you its version and size, downloads it only after you agree and installs it when you restart.

## The command line {#command-line}

```bash
npm i -g spec.jev      # Node.js 22.19 or newer
spec.jev setup               # connect a model and choose the judge
spec.jev                     # a session in the current directory
```

`spec.jev setup` asks step by step, in Chinese or English. If you skip it, the first `spec.jev` with no model asks once whether to set one up now. For scripts, `spec.jev setup --help` shows the non-interactive forms; a key is read from standard input, never from the command line.

Some things to try:

| Command | What it does |
| --- | --- |
| `spec.jev "fix the failing test in src/pager.test.ts"` | Start with a prompt |
| `spec.jev -p "summarize this repository"` | Answer once and exit |
| `spec.jev -c` / `spec.jev -r` | Continue the last session / pick one to resume |
| `spec.jev import --list` | Find Claude Code and Codex conversations to bring in |
| `spec.jev doctor` | Check the installation, the judges and the connections |
| `spec.jev ledger 3` | What the judge decided in the last three sessions |

Inside a session, `/status` shows the judge, each decision point's mode and the latest verdicts, and `/help` lists every command. The [command line page](@docs/cli) has the full list.

## Your first task {#first-task}

Open a project folder and say what you want done, in your own words. What happens next:

1. **Jev reads your message first** and shows a one-line verdict, such as *multi-step task · full effort*. This takes well under a second; press <kbd>Esc</kbd> to skip it.
2. **The model works.** Long tool output is filtered before it reaches the model; in *Jev approves* mode, anything Jev isn't sure the task needs waits for you.
3. **When it says it's done**, spec.jev checks whether anything verified the work and nudges it once if not.

To keep it going until a condition holds, use [goal mode](@docs/goal): `/goal all tests in packages/api pass`.

## The judge {#judge}

spec.jev asks a small, fast judge the routine questions of a session. You don't have to set one up: with no Jev key, the free Jev on OpenCode Zen answers, and spec.jev says so once a day. To use your own key, a local judge or another model, see [Judges](@docs/judges).

{points_active} of the {points} decision points act on their verdicts from the start (`context.compact` and `output.drift` are off until you turn them on), and each verdict is logged: `/status`, `spec.jev ledger` or the Judge tab in the app. To watch the judge before trusting it, put the decisions in shadow mode: they are still asked and logged, but change nothing.

```json
{ "modes": { "default": "shadow" } }
```

That goes in `~/.spec.jev/agent/spec.jev.json`; `/mu mode default shadow` does the same for the current session only.

## Where things live {#files}

| Path | What |
| --- | --- |
| `~/.spec.jev/agent/spec.jev.json` | spec.jev's settings: judges, modes, features |
| `~/.spec.jev/agent/auth.json`, `models.json`, `settings.json` | pi's sign-ins, providers and preferences |
| `~/.spec.jev/agent/sessions/` | Sessions, shared by the app and the command line |
| `~/.spec.jev/agent/mu/lessons.jsonl` | The lessons library |
| `~/.spec.jev/agent/mu/permissions.json` | The permission mode you last chose |
| `~/.spec.jev/backups/` | Copies `spec.jev setup` makes before it changes a file |

On Windows, `~` is your user folder (`%USERPROFILE%`).
