# KyRN bridge: WebUI parity

Status: loopback host implemented, 2026-10-23.

The WebUI now boots with a read-only catalog provider and, on the same machine, can call the desktop's KyRN providers over a token-gated loopback socket. Remote pairing/TLS is not implemented yet.

## Current shape

```text
WebUI renderer
  -> AionCore for app data (HTTP/WS)
  -> KyRN host for local KyRN providers (loopback WebSocket, token in the path)
       -> Electron main provider handlers
```

The host is `desktop/packages/desktop/src/process/bridge/kyrnHost.ts`:

- binds `127.0.0.1` only;
- uses a 256-bit random token in the WebSocket path;
- answers only `kyrn.*` requests;
- invokes the providers already registered by `initKyrnBridge` through `invokeLocal`;
- writes `~/.spec.jev/kyrn-host.json` for a local client and exposes the URL to the test harness.

The renderer client is `renderer/utils/kyrnHostClient.ts`:

- accepts `?kyrnHost=ws://127.0.0.1:<port>/<token>` (loopback) and `wss://` for a future remote host;
- stores the pairing link in `sessionStorage` for the tab;
- overrides the KyRN providers, leaving `kyrn.catalog` on its read-only web implementation;
- gives up after 30 seconds with a visible failure result.

The phone E2E now opens Settings → Providers through this host, not through a stub: `phone-390-providers.png`.

## Classification

| Class | Meaning |
| --- | --- |
| **Web-ready** | Existing backend HTTP/WS data is enough. |
| **Host-ready** | Needs local files, keys, or child processes, but the loopback KyRN host can answer it. |
| **Desktop-only** | No safe WebUI meaning without a new local service and an explicit security model. Hide or say so in the UI. |

## Provider matrix

| Provider | What it touches | Class | WebUI decision |
| --- | --- | --- | --- |
| `kyrn.catalog` | `/api/agents/management`, `/api/assistants` | Web-ready | Read-only in `renderer/utils/kyrnWebCatalog.ts`. No registration or agent disabling. |
| `kyrn.settings` | `mu.json`, pi `settings.json`, `models.json`, permissions and board files | Host-ready | Proxied to the desktop host. |
| `kyrn.save` | Same files; writes credentials and config | Host-ready | Proxied to the desktop host; keys never enter the browser. |
| `kyrn.defaultModel` / `kyrn.setDefaultModel` | Local settings files | Host-ready | Proxied. |
| `kyrn.availableModels` | Backend + local registration lookup | Host-ready | Proxied. |
| `kyrn.recheck` | Backend registration + health check | Host-ready | Proxied. |
| `kyrn.testProvider` | Local `.env` keys, external endpoint, system proxy | Host-ready | Proxied; the browser never receives the key. |
| `kyrn.loginStart` / `loginState` / `loginAnswer` / `loginCancel` / `loginStatus` / `loginLogout` | Local auth CLI and OAuth callback | Host-ready | Proxied. |
| `kyrn.localJudgeState` / `kyrn.localJudgeRun` | Local judge process, model files, consent | Host-ready | Proxied. |
| `kyrn.clmCheck` | External CLM server over HTTP | Web-ready (read-only) | Can be proxied; currently host-ready. |
| `kyrn.activity` | Local ACP/session store | Host-ready | Proxied; the work panel can read it. |
| `kyrn.modelLevels` | Local session store | Host-ready | Proxied. |
| `kyrn.lessons` / `kyrn.lessonsChange` | Local `lessons.jsonl` | Host-ready | Proxied. |
| `kyrnFolderBridge.lessons` / `files` | Local project folder and session store | Host-ready | Proxied. |
| `kyrn.importList` / `importRun` / `importHistory` | Local Claude/Codex transcripts and `spec.jev import` CLI | Host-ready | Proxied. |
| `kyrn.skills` / `skillAdd` / `skillRemove` / `capabilityReveal` | Local skill folders and file manager | Host-ready | Proxied. |
| `kyrn.mcpServers` / `mcpAdd` / `mcpRemove` / `mcpSwitch` | Local `mcp.json` and other tools' config | Host-ready | Proxied. |

## Security boundary

- The host is loopback-only. It is not reachable from a phone on the LAN yet.
- The token is the whole secret; it is in the URL and the advert file, never logged.
- A remote host must use `wss://` and a pairing flow. A bare `ws://` is accepted only for loopback.
- The host does not expose arbitrary bridge methods; only `kyrn.*` names are accepted.
- A WebUI page with the pairing link still controls the local desktop's settings and keys. Treat the link like a password, not like a normal URL.

## Still missing

1. LAN/remote pairing: TLS, device approval, token rotation, revocation.
2. A user-facing "open on phone" flow that generates the pairing link.
3. E2E coverage for every host-backed settings page, not just Providers.
4. A decision on whether desktop-only actions such as opening a file manager or local judge setup should be allowed from a remote browser.
