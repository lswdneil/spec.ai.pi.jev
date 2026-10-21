# Getting started

spec.jev comes in two forms: a desktop app that bundles everything it needs, and the `spec.jev` command line. They share accounts, settings, sessions and lessons, so you can use both.

## The desktop app

1. Download the build for your system from [Releases](https://github.com/lswdneil/ai.spec.pi.jev/releases/latest):

   | System | File |
   | --- | --- |
   | macOS, Apple silicon | `spec.jev-<version>-mac-arm64.dmg` |
   | macOS, Intel | `spec.jev-<version>-mac-x64.dmg` |
   | Windows x64 / Arm | `spec.jev-<version>-win-x64.exe` / `spec.jev-<version>-win-arm64.exe` |
   | Linux x64 / Arm (Debian, Ubuntu) | `spec.jev-<version>-linux-amd64.deb` / `spec.jev-<version>-linux-arm64.deb` |

   `SHA256SUMS` lists the checksum of every file. The macOS builds are signed and notarized by Apple. The Windows builds aren't code-signed yet, so SmartScreen shows a warning the first time ("More info" → "Run anyway").
2. Open the app. The first-run guide asks for a model: paste an API key (spec.jev detects the service from the key's format and checks the key with one request), or sign in with a ChatGPT, Claude, Grok or Google subscription.
3. Pick a folder and start a conversation.

There's nothing else to install: no Node.js, and no download on first launch. When a new release is out, the app offers it and downloads it only after you agree.

## The command line

```bash
npm i -g spec.jev      # Node.js 22.19 or newer
spec.jev setup               # connect a model and choose the judge
spec.jev                     # start a session in the current directory
```

`spec.jev setup` walks you through each step. `spec.jev setup --help` shows the non-interactive forms for scripts (the key is read from stdin, never from the command line). If you skip setup, the first `spec.jev` run without a model asks once.

Some things to try:

| Command | What it does |
| --- | --- |
| `spec.jev "fix the failing test in src/pager.test.ts"` | Start with a prompt |
| `spec.jev -p "summarize this repository"` | Answer once and exit |
| `spec.jev -c` / `spec.jev -r` | Continue the last session / pick one to resume |
| `spec.jev import --list` | Find Claude Code and Codex conversations to bring in |
| `spec.jev doctor` | Check the installation, the judges and the connections |
| `spec.jev ledger 3` | Show what the judge decided in the last three sessions |

Inside a session, `/status` shows the judge, each decision point's mode and the latest verdicts, and `/help` lists every command. The [README](../README.md#command-line) has the full list.

## The judge

spec.jev asks a small, fast judge the routine questions that come up in a session. You don't have to set one up: without a Jev key, the free Jev on OpenCode Zen answers, and spec.jev reminds you of this once a day. To use your own key, a local judge or another model, see [Judges](judges.md).

## Decisions and their modes

38 of the 40 decision points are **active** from the start: spec.jev asks the judge and acts on its verdicts. `context.compact` and `output.drift` are off until you turn them on. Every verdict is logged, so you can see what the judge decided (`/status`, `spec.jev ledger` or the Judge tab in the app).

To watch the judge before you trust it, set the default mode to **shadow**. The judge is still asked and its verdicts are logged, but they change nothing. In `~/.spec.jev/agent/spec.jev.json`:

```json
{ "modes": { "default": "shadow" } }
```

Or run `/mu mode default shadow` for the current session. In the app, Settings → Decision points has a switch for each point and for the default; a point in shadow mode shows as off there.

You can also put individual points in shadow or turn them off; see [Configuration](configuration.md). Two things work regardless of the mode: the permission mode you choose (*Jev approves* is how you opt in to `tool.approval`), and the `judge_items` tool when the model calls it.

## Permissions

The permission mode controls how much spec.jev may do without asking. It's shown in the status line and in the app's composer. Switch it with `/permissions`:

- **Full access**: everything runs.
- **Jev approves** (the default): reads and edits inside the project run. Anything else runs only when Jev is sure the task needs it; otherwise spec.jev asks you.
- **Ask first**: only reads run without asking.

Risky commands (`rm -rf`, force pushes, `sudo`, running a downloaded script…) can never be allowed for a whole conversation, and the constraints you state ("don't touch the migrations") hold in every mode. More in [the permissions design note](../kyrn/docs/features/permissions.md).

## Where things live

| Path | What |
| --- | --- |
| `~/.spec.jev/agent/spec.jev.json` | spec.jev's settings: judges, modes, features |
| `~/.spec.jev/agent/auth.json`, `models.json`, `settings.json` | pi's sign-ins, providers and preferences |
| `~/.spec.jev/agent/sessions/` | Sessions, shared by the app and the command line |
| `~/.spec.jev/agent/mu/lessons.jsonl` | The lessons library |
| `~/.spec.jev/agent/mu/permissions.json` | The permission mode you last chose |
| `~/.spec.jev/backups/` | Copies `spec.jev setup` makes before it changes a file |

On Windows, `~` is your user folder (`%USERPROFILE%`).

## Next steps

- [Configuration](configuration.md): settings, environment variables, and per-point modes and judges.
- [Judges](judges.md): which judge answers, and how to compare them.
- [Decision points](reference/decision-points.md): every question spec.jev asks.
- [Troubleshooting](troubleshooting.md): what to do when something doesn't work.
