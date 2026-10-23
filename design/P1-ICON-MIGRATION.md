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

Fifth content batch:

- Settings dialogs: about, developer tools, tool settings, and directory input.
- Workspace folder selector and Guid workspace footnote.
- Guid model and assistant selection controls.
- Markdown diagram zoom and local file link.
- Kyrn hive, judge, and board.
- Base dialogs, search inputs, file changes, and Butler controls.
- Explorer container, files, and search panels.
- Design-system shell preview.

Sixth content batch:

- Chat chrome: collapsible content, thought display, mobile action sheet, attachments, and BTW overlay.
- Conversation title minimap, workspace collapse, plan bar, and history button.
- Design-system shell chevrons.
- Icon-bearing UI primitives: alert, button loader, checkbox mark, collapse, dialog, dropdown, empty, image, input, pagination, steps, select, and tree.
- Settings update notice and the cron job manager header.

The literal `h-3` / `h-3.5` / `h-4` / `h-5` / `size` values were replaced by scale classes. `iconTokens.test.ts` now scans all six batches. Avatars, provider marks, logos, spinners, cron status marks, control boxes, and 24/28px illustration marks are excluded because they are content-sized, not five-step icons.

## Remaining

The remaining scan hits (29 files / 36 lines at the time of writing) are content-sized avatars, provider logos, MuMark, spinners, 24/28px illustration marks, cron status marks, and control-box dimensions in UI primitives. They are intentionally outside the five-step icon scale.

The guard covers the shell, composer, messages, settings and settings dialogs, preview, agent, history, media, source control, native host, scheduled tasks, platform composers, workspace, Guid, Markdown, Kyrn, base components, explorer, design-system preview, chat chrome, conversation panels, and icon-bearing UI primitives.

## Visual regression

`desktop/tests/e2e/features/visual/icon-scale.e2e.ts` launches the real app, skips onboarding, opens the home page at 1280×800, toggles dark and light, and measures every visible `sv-icon-*` element. It asserts:

- taskbar icons (`sv-icon-sider`) and titlebar icons (`sv-icon-titlebar`) are present;
- every visible icon class paints at its token size, including icon-park wrappers;
- both themes pass.

It writes `icon-scale-dark.png` and `icon-scale-light.png` to the Playwright test output for visual inspection. Run it against a dev server with `E2E_DEV=1`; CI uses the freshly packaged app.

Migrate one UI area per batch, extending the guard list in `iconTokens.test.ts` as each batch lands.
