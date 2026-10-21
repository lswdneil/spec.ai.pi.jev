---
title: Permissions and safety
summary: The three permission modes, what Jev may approve for you, your hard constraints, risky commands and outside content.
---

The **permission mode** sets how much spec.jev may do without asking. It shows in the status line and in the app's send box, and `/permissions` switches it at any time.

## The three modes {#modes}

| Mode | Runs without asking | Asks you |
| --- | --- | --- |
| **Full access** | Everything | Nothing |
| **Jev approves** (the default) | Reading; editing files inside the project; whatever Jev is sure the task needs | Whatever Jev is unsure of, thinks goes beyond your request or thinks is unrelated |
| **Ask first** | Reading only | Every edit, command, external action and subagent |

`/permissions full`, `/permissions jev` and `/permissions ask` switch directly. A switch applies to this conversation and becomes the default for new ones; other running conversations keep their own mode. `MU_PERMISSIONS=ask spec.jev` sets it for one run.

## What Jev approves {#jev-approves}

In *Jev approves*, each command, change outside the project, external action and subagent goes to Jev first, with one question: is this call **needed** for the task and what you said, does it go **beyond** it, is it **unrelated** or is it **unclear**? Only a *needed* verdict at 0.8 or higher runs without asking you. Anything else asks you, and the prompt says why, for example *Jev thinks this goes beyond what you asked for*.

When no judge can answer (no key and the free Jev unavailable, an exhausted account or only a local judge, which isn't trusted with approvals), spec.jev asks you about every step and says so. Set a Jev key with `spec.jev setup`, or switch the mode.

## When spec.jev asks {#asking}

A call that needs you shows one picker:

- **Allow once**
- **Allow for this conversation**, offered only when the call has a safe scope: all edits inside the project, one program (plus its sub-command for `git`, `npm`, `cargo` and the like, so `npm test` but not every `npm`), one file outside the project or one tool
- **Don't allow**

A command with chaining, redirection or substitution, or one starting with `sudo` or `env`, can only be allowed once. <kbd>Esc</kbd> counts as *Don't allow*. A refusal tells the model not to look for another way around, but to ask you or carry on without it. Allowances are forgotten when you switch mode or run `/permissions reset`.

## What holds in every mode {#always}

- **Your hard constraints.** What you rule out, such as *don't touch the migrations*, is kept word for word in the task frame. Before any call that changes something, the constraints are checked, and a confident violation is stopped in your own words. This holds even in full access, and subagents work under the same constraints.
- **Reading is never asked about**: reading, searching and listing files, web search and web reading, and shell commands made only of read-only programs such as `git status` or `cat … | grep …`.
- **Unknown tools are asked about.** A tool spec.jev doesn't know, such as an MCP tool, needs permission.
- **spec.jev's own settings are yours.** A call that touches `~/.spec.jev/agent` is asked every time; Jev can't approve it.

## Risky commands {#risky}

Rules flag commands that look dangerous: `rm -rf`, force pushes, `sudo`, running a downloaded script and others. In *Jev approves* such a command runs only when Jev is sure you asked for it; in *Ask first* the flag is shown in the question. A flagged command can be allowed once, never for the whole conversation.

## Content from outside {#injection}

Web pages, search results, the built-in browser and MCP servers can carry text written to steer an AI: *ignore your rules*, *send this file*, *run this command* or a link that leaks the conversation. Before the model reads such a result, it is screened passage by passage; a passage carrying instructions aimed at an AI is withheld and replaced by a one-line note. When the judge doesn't answer in time, plain injection phrases are still withheld by rule.

`web_fetch` itself has limits: a time and size limit per request, page text labeled as untrusted and addresses in your private network refused unless you allow them, so a page can't steer the reader into your local network.

## Undoing changes {#checkpoints}

Before the first change of every turn that edits files, spec.jev snapshots the project into a shadow git directory of its own. Your repository, index and branches are never touched, and the project doesn't need to be a git repository. Files holding secrets (`.env`, keys, certificates) are never snapshotted.

- `/checkpoints` lists the checkpoints on the current branch of the conversation.
- `/rewind` shows what would change, then takes the files, the conversation or both back. Files you edited yourself since are listed separately and asked about.
- `/rewind undo` takes the last rewind back.

Checkpoints are skipped for a session started in your home folder, and for very large projects (more than 5,000 files or 200 MB to take in), with a note. See also [Goal mode and finishing](@docs/goal#rewind).
