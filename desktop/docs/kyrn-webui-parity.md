# KyRN bridge: WebUI parity

Status: loopback host + same-origin proxy implemented, 2026-10-24.

The WebUI boots with a read-only catalog provider and can call the desktop's KyRN providers over the same origin. The browser connects to `/kyrn`; web-host rewrites the token path and forwards to a loopback-only host. Remote pairing is not implemented yet.

## Current shape

```text
WebUI renderer
  -> AionCore for app data (HTTP/WS)
  -> /kyrn on its own origin
       -> web-host (Origin check, token rewrite)
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
- The token lives in the upstream request line and the advert file, never in the browser URL.
- `/kyrn` rejects an upgrade whose `Origin` does not equal `Host`, which blocks cross-site WebSocket hijacking from an arbitrary page in the user's browser.
- The host does not expose arbitrary bridge methods; only `kyrn.*` names are accepted.
- There is no app-level user auth on `/kyrn` yet. Until pairing lands, the reverse proxy must authenticate (Tailscale, Cloudflare Access, Caddy basic auth, or a VPN). See `webui-remote-access.md`.
- A browser page that can open `/kyrn` still controls the local desktop's settings and keys. Do not expose the service without an authenticating proxy.

## Still missing

1. Pairing: one-time code, device approval, scoped token, rotation, revocation.
2. A "show this on my phone" flow that displays the proxy URL rather than only the loopback URL.
3. Persisting the Remote access switch across app restarts (it is per-session today).
4. E2E coverage for every host-backed settings page, not just Providers and `kyrn.settings`.
5. A decision on whether desktop-only actions such as opening a file manager or local judge setup should be allowed from a remote browser.
6. Hosting extension-contributed WebUI static assets and API routes. `webui.start` serves the renderer, AionCore, and `/kyrn`; it does not yet load `contributes.webui` from extension manifests, so `tests/e2e/specs/ext-webui-contrib.e2e.ts` still fails once the service is actually running.
