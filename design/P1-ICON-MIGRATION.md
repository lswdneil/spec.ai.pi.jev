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

Third content batch:

- Settings business pages: appearance, archived chats, assistants, providers/models, skills, imports, and MCP tools.
- Preview chrome: browser navigation, step bar, preview tabs.
- Agent controls: runtime restart and mode selector.

Fourth content batch:

- Conversation history rows, search popover, sorting, and section toggles.
- Chat layout workspace controls and panel header.
- Media: file attach, preview, horizontal file list, image loading, upload progress, and webview chrome.
- Source control: panel, changes view, resource rows, and sections.
- Native host: header, notices, composer attachments/model/permission, sider, and source status.
- Scheduled tasks: list, create dialog, and detail actions.
- ACP/Aionrs composers and model selectors.

The literal `size` / `h-3.5` / `h-4` / `h-5` values were replaced by scale classes. `iconTokens.test.ts` now scans all four batches. Avatars, provider marks, logos, spinners, cron status marks, and 24/28px illustration marks are excluded because they are content-sized, not five-step icons.

## Remaining

Scan the renderer for literal icon sizes; remaining files are mostly small inline metadata icons and one-off panels outside the covered trees. The guard now covers the shell, composer, messages, settings, preview, agent, history, media, source control, native host, scheduled tasks, and platform composers.

Migrate one UI area per batch, extending the guard list in `iconTokens.test.ts` as each batch lands.
