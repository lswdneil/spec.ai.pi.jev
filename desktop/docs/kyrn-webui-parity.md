# KyRN bridge: WebUI parity

Status: audit, 2026-10-23.

The WebUI now boots with a read-only catalog provider. It is not yet at parity with the desktop app: most other `kyrnBridge` providers are registered by the Electron main process and depend on local files, local credentials, or child processes.

The purpose of this page is to make that boundary explicit before more WebUI work starts.

## Classification

| Class | Meaning |
| --- | --- |
| **Web-ready** | Existing backend HTTP/WS data is enough; the renderer can implement it. |
| **Server-host** | Needs the desktop main process (or an equivalent local Node host) because it reads/writes local files, keys, or child processes. |
| **Hybrid** | Some read-only parts can be Web-ready; writes or secrets still need a host. |
| **Desktop-only** | No safe WebUI meaning without a new local service and an explicit security model. Hide or say so in the UI. |

## Provider matrix

| Provider | What it touches | Class | WebUI decision |
| --- | --- | --- | --- |
| `kyrn.catalog` | `/api/agents/management`, `/api/assistants` | Web-ready | Implemented read-only in `renderer/utils/kyrnWebCatalog.ts`. No registration, no agent disabling. |
| `kyrn.settings` | `mu.json`, pi `settings.json`, `models.json`, permissions and board files | Server-host | Needs a host that can read the agent folder; do not fake it in the browser. |
| `kyrn.save` | Same files; writes credentials and config | Server-host | Same; never expose file writes or keys without authentication. |
| `kyrn.defaultModel` / `kyrn.setDefaultModel` | Local settings files | Server-host | Needs the same host. |
| `kyrn.availableModels` | `/api/agents/management` + local registration lookup | Hybrid | Read-only model list can be done from the backend; registration lookup needs a host. |
| `kyrn.recheck` | Backend registration + health check | Hybrid | Can call the backend, but the host owns registration. |
| `kyrn.testProvider` | Local `.env` keys, external endpoint, system proxy | Server-host | Keys must not be handed to a browser; needs the desktop host. |
| `kyrn.loginStart` / `loginState` / `loginAnswer` / `loginCancel` / `loginStatus` / `loginLogout` | Local auth CLI and OAuth callback | Server-host | Needs the desktop host or a separate authenticated login service. |
| `kyrn.localJudgeState` / `kyrn.localJudgeRun` | Local judge process, model files, consent | Server-host | Desktop-only unless a local judge service is added. |
| `kyrn.clmCheck` | External CLM server over HTTP | Web-ready (read-only) | Could be implemented in the renderer, subject to network policy. |
| `kyrn.activity` | Local ACP/session store (`acp-sessions`) | Server-host | The work panel's judgments/board need a local host. |
| `kyrn.modelLevels` | Local session store | Server-host | Same. |
| `kyrn.lessons` / `kyrn.lessonsChange` | Local `lessons.jsonl` | Server-host | Same; writes also need a host. |
| `kyrnFolderBridge.lessons` / `files` | Local project folder and session store | Server-host | Native folder browsing is desktop-only. |
| `kyrn.importList` / `importRun` / `importHistory` | Local Claude/Codex transcripts and `spec.jev import` CLI | Server-host | Desktop-only or a host-side import service. |
| `kyrn.skills` / `skillAdd` / `skillRemove` / `capabilityReveal` | Local skill folders and file manager | Server-host | Desktop-only unless a host-side capability service exists. |
| `kyrn.mcpServers` / `mcpAdd` / `mcpRemove` / `mcpSwitch` | Local `mcp.json` and other tools' config | Server-host | Desktop-only unless a host-side capability service exists. |

## What this means

The WebUI is not a standalone replacement for the desktop app yet. It has two possible product shapes:

### A. Remote control of a running desktop host

- The desktop main process exposes authenticated KyRN bridge calls over localhost/LAN/remote transport.
- The WebUI connects to that host.
- Local files, keys, judge processes, and import commands stay on the desktop.
- This preserves the current security boundary, but needs pairing, authentication, lifecycle, and transport design.

### B. Standalone WebUI host

- The web host embeds a Node/Rust KyRN service with its own agent directory, credentials, judge processes, and session store.
- This is a much larger product: secret storage, auth, file access, process isolation, update lifecycle, and multi-user concerns.
- It must not reuse a browser session as a substitute for local file access.

### C. Limited WebUI

- Keep catalog/home/conversation read paths.
- Hide or clearly mark desktop-only settings: providers, judges, local judge, skills, MCP, import, work-panel activity/lessons.
- This is the safest short-term path, but it is not full WebUI parity.

## Recommendation

Do not implement `settings`, `save`, `skills`, `mcp`, `activity`, or `lessons` as browser-only stubs. They need local state and secrets.

Choose the product shape first:

1. **Remote control** if the WebUI is a companion to a running desktop app.
2. **Standalone host** if the WebUI must work without the desktop app.
3. **Limited WebUI** if the goal is only phone access to conversations.

The next implementation should follow that decision. The parity matrix is the input to it, not a substitute for it.
