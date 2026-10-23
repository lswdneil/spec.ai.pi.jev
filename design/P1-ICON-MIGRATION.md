# P1 icon migration

The shell now shares one icon scale. This document tracks the content-area migration.

## Scale

- `--sv-icon-xs` 12px
- `--sv-icon-sm` 14px
- `--sv-icon-md` 16px
- `--sv-icon-lg` 18px
- `--sv-icon-xl` 20px
- `--sv-icon-sider` 18px (taskbar, both states)
- `--sv-icon-titlebar` 18px

Classes: `sv-icon-xs/sm/md/lg/xl/sider/titlebar`. The class also sizes an icon-park wrapper's child SVG.

## Completed

Shell and chrome:

- Titlebar, window controls, sidebar (Dense and legacy), settings rail, mobile tab bar, work panel tabs, command palette search.

First content batch:

- SendBox and SendArrowIcon
- CommandQueuePanel
- Markdown CodeBlock, MermaidBlock, WavedromBlock
- home GuidActionRow

Second content batch:

- Conversation message surface: MessageThinking, MessageToolCall, MessageToolGroup, MessageToolGroupSummary, MessageTips, MessageMuNotice, PermissionRequestPanel, SelectionReplyButton, SkillSuggestCard, MessageText, MessageList, MessageQuestion, MessageCronBadge/Trigger, ToolKindIcon, TeammateMessageAvatar, ActionRail search.

The literal `size` / `h-3.5` / `h-4` / `h-5` values were replaced by scale classes. `iconTokens.test.ts` now scans the whole `pages/conversation/Messages` tree as well as the first batch.

## Remaining

Scan the renderer for literal icon sizes; remaining files are mostly:

1. Settings business pages
2. Preview auxiliary panels
3. Agent and mode selectors
4. Small inline metadata icons

Migrate one UI area per batch, extending the guard list in `iconTokens.test.ts` as each batch lands.
