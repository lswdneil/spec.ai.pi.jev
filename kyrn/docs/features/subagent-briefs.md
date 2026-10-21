# Sub-agents that work to a checklist

This is the task frame applied to sub-agents. In pi's subagent example, a child gets one line of instructions and hands back its last words. In spec.jev, the child gets its part of the task frame and hands back its checklist, so the parent can see what was done and on what evidence, not only what the child says.

## The brief

`delegate` takes two optional fields per task:

- `done`: what must be true when this part is finished. At most 8 items, each one checkable.
- `serves`: the id of the item on the parent's todo list that this part is for, for example `a2`. An id the parent's list does not have is ignored.

From these, each task gets a brief (`src/swarm/brief.ts`) with:

- the part itself (`title: instructions`),
- the parent's goal,
- the item it serves,
- its done criteria,
- and, in a chain, the report of the step before.

The brief reaches the child in two ways:

- **Its first message.** This keeps the task, then adds "This is one part of a larger piece of work: …", the item it serves, the previous step's report inside `<previous-step>` (marked as data, not instructions), the criteria as `a1. …`, and "End with a short report".
- **Its environment.** `KYRN_SWARM_BRIEF` is set, which drives the child's task frame. The goal is the part rather than the whole message. The criteria become its acceptance items and are marked as the user's, so the child's writer cannot drop them. The child's `todo` tool and its completion check then work on exactly those items.

## The checklist coming back

The child writes its acceptance list to `KYRN_SWARM_FRAME_OUT` after every tool step and at `agent_settled`. The write goes through a temp file and a rename, so a stopped child leaves either the whole list or nothing.

Extensions hear `agent_settled` before the parent does, so the list is on disk by the time the parent reads it.

The delegate result adds this to each task's report:

```
Acceptance list: 1 of 2 met.
  [x] The query is named (EXPLAIN shows a seq scan on orders)
  [ ] An index is proposed
Open questions: Is orders partitioned?
It serves your item a1 (The slow query is found), which is not done yet.
```

When everything is met, the last line becomes "if the evidence holds for you, tick a1 with todo". The parent decides; nothing is ticked for it.

The result's `details.frames` holds `FrameOut | null` per task (`{goal, acceptance: [{id, text, done, evidence?}], openQuestions}`) for the desktop.

## Chains

`delegate` with `chain: true` runs the tasks one at a time, in order (`chainRunner` in `swarm.ts`):

- Each step's brief carries the report of the step before, capped at 6000 characters.
- A step that does not finish (failed, or stopped by the watchdog) ends the chain. The steps after it are reported as "not started: the step before it (…) did not finish".
- A step that was asked to wrap up and did so still counts as finished.
- Steps edit in place unless a step asks for `isolation: "worktree"`, because each step has to see the edits of the step before.
- The result numbers the steps (`## 1. scout`, `## 2. plan`).

## Workflow commands

These are prompt templates in `packages/kyrn-judge/prompts/`, adapted from pi's subagent example to the task frame:

- `/implement <task>`: a chain of scout → planner → worker.
- `/scout-and-plan <task>`: scout → planner. Nothing is changed, and it waits for you.
- `/implement-and-review <task>`: worker → reviewer → worker.

Each command tells the main model to do three things:

1. Put the task's criteria on its todo list first.
2. Give every step `done` criteria and `serves`.
3. Afterwards, read each step's acceptance list, not only its report, and tick its own items only as far as the evidence goes.

## Where this interacts

- **Permissions.** A sub-agent runs in its parent's current permission mode (`MU_PERMISSIONS`). It has no UI, so whatever would ask the user is refused, with a reason it reports back.
- **Constraints.** The user's hard constraints still reach every sub-agent through `KYRN_SWARM_CONSTRAINTS`.
