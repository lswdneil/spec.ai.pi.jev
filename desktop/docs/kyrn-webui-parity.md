# KyRN bridge: WebUI parity

Status: **deferred for 0.1.x.** The loopback host, same-origin proxy, device
pairing, scopes, persisted switch, extension WebUI hosting with hot reload,
public address and token rotation are implemented and kept in the codebase, but
the 0.1.x release hides the Remote access panel and does not start the listener.

The WebUI boots with a read-only catalog provider and can call the desktop's KyRN providers over the same origin. The browser connects to `/kyrn`; web-host first checks the paired-device cookie, then rewrites the token path and forwards to a loopback-only host.

## Current shape

```text
Phone browser
  -> /pair (public) -> desktop approval -> HttpOnly device cookie
  -> WebUI + AionCore API/WS (cookie required)
  -> /kyrn on its own origin (cookie + Origin check)
       -> web-host (token rewrite)
            -> KyRN host (127.0.0.1, token in the upstream path)
                 -> Electron main provider handlers
```

The host is `desktop/packages/desktop/src/process/bridge/kyrnHost.ts`:

- binds `127.0.0.1` only;
- uses a 256-bit random token in the WebSocket path;
- answers only `kyrn.*` requests;
- invokes the providers already registered by `initKyrnBridge` through `invokeLocal`;
- writes `~/.spec.jev/kyrn-host.json` for a local client and exposes the URL to the test harness.

The renderer client is `renderer/utils/kyrnHostClient.ts`:

- in a browser, defaults to same-origin `/kyrn` (`wss:` under HTTPS), so no token is in the address bar;
- still accepts an explicit `?kyrnHost=ws://127.0.0.1:<port>/<token>` for local diagnostics, and `wss://` for a future remote host;
- does nothing in the Electron renderer, which already owns the providers;
- overrides the KyRN providers, leaving `kyrn.catalog` on its read-only web implementation;
- gives up after 30 seconds with a visible failure result.

The phone E2E now opens Settings → Providers through this same-origin path, not through a stub or a query token: `phone-390-providers.png`. It also sends a raw `kyrn.settings` request through `/kyrn` and asserts the provider result, so a page that only paints a header cannot pass.

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

- The KyRN host is loopback-only. Web-host is loopback-only too; a reverse proxy is the only listener that may cross the machine boundary.
- Every page, API request, `/ws` and `/kyrn` requires a paired-device cookie. `/pair` and `/api/pair/*` are the only public routes.
- The pairing code is six digits, valid for five minutes, single use, and rotates after five wrong attempts.
- The device token is 256 bits, stored only as a SHA-256 hash, delivered once in an HttpOnly/SameSite=Strict cookie, and expires after 30 days.
- The KyRN token lives in the upstream request line and is rewritten in-process; it never appears in the browser URL.
- `/kyrn` and `/ws` reject an upgrade whose `Origin` does not equal `Host`, which blocks cross-site WebSocket hijacking.
- The host does not expose arbitrary bridge methods; only `kyrn.*` names are accepted.
- Revoking a device deletes its hash and closes its live sockets.
- A device is approved as `read` or `control`. The web-host injects that scope into the `/kyrn` upgrade, and the host allows a read device only the methods in `common/kyrn/remoteScope.ts`; writes are refused with `permissionDenied`.
- Read devices are also limited at the AionCore HTTP boundary: GET/HEAD plus a narrow read-only POST allowlist.
- The Remote access switch writes `system.webuiEnabled`; the service starts after backend readiness on the next launch.
- A public address (`system.webuiPublicUrl`) is shown as a copyable `/pair` link for the phone.
- A device token can be rotated in place. The old cookie stays valid for a ten-minute grace window while the open WebUI claims the new cookie; an unclaimed rotation restores the old token.
- Extension handlers reload on mtime changes; the require cache is cleared for modules under the extension root.

## Still missing

1. A full per-endpoint AionCore policy. Read-only is intentionally a GET/narrow-POST allowlist; full access remains all-or-nothing.
2. Richer activity fixtures. The phone E2E opens the judge/board/lessons panel and verifies it renders from the host; the test conversation has no judge records or lessons yet.
