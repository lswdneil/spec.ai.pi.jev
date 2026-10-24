# WebUI remote access: pairing and transport

Status: service, same-origin proxy, pairing with read/control scopes, persisted switch, public address, and in-place token rotation implemented, 2026-10-24.

## What exists

- Settings → System → Remote access starts/stops the WebUI service (`webui.start` / `status` / `stop`).
- The service binds `127.0.0.1` and uses a stable port (25808) when free, otherwise an ephemeral one.
- Every page, AionCore API request, `/ws` socket, and `/kyrn` socket requires a paired device cookie. The only public surfaces are `/pair` and `/api/pair/*`.
- The desktop shows a six-digit, single-use pairing code. A phone submits it, the desktop approves the device, and only then does the phone receive an HttpOnly device cookie.
- At approval, choose **Read only** or **Full access**. Read-only devices may use GET/HEAD, a narrow allowlist of read-only POST endpoints, and read-only KyRN methods; writes are refused before they reach AionCore or the KyRN host.
- Paired devices are listed with their scope and last-seen time and can be revoked; revocation invalidates the cookie and closes the device's live sockets.
- Device tokens are stored hashed and expire after 30 days. A paired device can rotate its token in place: the old cookie keeps working for a 10-minute grace window while the open WebUI claims the new cookie; an unclaimed rotation restores the old token.
- The public address is stored in `system.webuiPublicUrl` and shown as a copyable `<address>/pair` link.
- The Remote access switch is stored in `system.webuiEnabled`; a launch with it on starts the service after the backend is ready.
- Pairing requests, approvals, rejections, revocations, and expirations are appended to `<userData>/webui-audit.jsonl`.
- Web-host exposes **same-origin `/kyrn`** and forwards it to the loopback host. It rewrites the KyRN token path in-process, so the KyRN token never appears in the browser URL.
- `/kyrn` and `/ws` require the browser's `Origin` to equal `Host`, blocking cross-site WebSocket hijacking.
- Extension WebUI contributions are hosted at their root paths: static assets are public, `auth: true` API handlers require a paired device, and `auth: false` webhooks stay public. Read-only devices may only GET handlers.
- Extension static files are read per request, and a handler (plus the modules under its extension root) is re-required when its mtime changes, so editing an extension does not require restarting the app.
- The phone E2E pairs a real browser as read-only, verifies GET succeeds and POST and `kyrn.save` are refused, rotates the token and checks the old cookie is rejected, revokes it, and asserts that the cookie no longer opens the app. It also checks the persisted switch value and public link.

> **Security gate:** the desktop backend runs in local mode, so AionCore's own login page is not a reliable remote gate. Pairing is now the app-level gate, but the transport should still be HTTPS or a private network. Do not expose port 25808 directly to a LAN or the internet. Reverse-proxy authentication remains useful as defense in depth.

## What remote access must guarantee

1. **Transport confidentiality.** A phone on a LAN or the internet must not send session cookies, KyRN tokens, settings, keys, activity, or files over plain `ws://`/`http://`.
2. **Server authentication.** The phone must know it is talking to the intended desktop, not a LAN impostor.
3. **User authorization.** Opening a link is not enough; the desktop must approve the device.
4. **Least privilege.** A paired device needs only the KyRN methods the UI uses; it must not become a general shell or file API.
5. **Revocation and rotation.** The desktop can list devices and revoke one; tokens expire and rotate.
6. **No secret delivery to the browser.** Provider keys and local judge credentials stay on the desktop. The browser receives results, never `.env` contents.
7. **Auditability.** Pairing, revocation, and sensitive calls are recorded.

## How to use today

1. Open **Settings → System**, turn on **Remote access**, and copy the local URL (usually `http://127.0.0.1:25808`).
2. Put an HTTPS reverse proxy or private network in front of that loopback URL. The proxy must preserve `Host` and forward WebSocket upgrades.
3. Enter that public origin under **Public address**; the panel shows a copyable `<address>/pair` link.
4. Open the link on the phone, enter the pairing code, then approve the pending device in Settings.
5. Revoke the device when it is no longer trusted. **Rotate token** issues a new cookie without re-pairing; the phone claims it while its WebUI is open. Turning the switch off stops the listener and closes live connections.

Caddy, with a password gate in front of the local service:

```caddyfile
specjev.example.com {
  basic_auth {
    me <bcrypt-hash-from-caddy-hash-password>
  }
  reverse_proxy 127.0.0.1:25808
}
```

Tailscale Serve on a private tailnet:

```powershell
tailscale serve --bg 25808
```

Cloudflare Tunnel: route the hostname to `http://127.0.0.1:25808` and add a Cloudflare Access policy. A quick tunnel without Access is a public URL; pairing gates the app, but TLS and network access control still belong in front of it.

## Transport options

### A. HTTPS reverse proxy or private network (recommended)

Examples: Caddy/nginx on the desktop, Tailscale Serve/Funnel, Cloudflare Tunnel, a private VPN.

```text
phone -> HTTPS/WSS reverse proxy -> web-host -> AionCore
                                      |
                                      +-> loopback KyRN host -> desktop providers
```

- The app keeps KyRN on loopback.
- TLS and hostname management belong to the proxy, which already has renewal and trust tooling.
- A paired device presents a WebUI session cookie; the proxy/web-host require it.
- The desktop still generates a one-time pairing code and keeps a device list.

Cost: the user must install/configure a proxy or join a private network. Benefit: no self-signed certificate warnings, no custom TLS lifecycle in the app.

### B. App-native self-signed HTTPS

The app generates a certificate, serves HTTPS on the LAN, and asks the phone to trust it.

- No extra proxy, but browsers show a warning until the certificate is trusted.
- Certificate rotation, SANs for changing LAN IPs, and trust-store instructions are app responsibilities.
- A self-signed cert still needs a pairing code and device approval; TLS alone does not authenticate the user.
- This is the most code and the worst first-run experience.

### C. Cloud relay

A hosted relay holds the WebSocket and forwards encrypted frames.

- Works across NAT without a local proxy.
- Requires an account/identity system, relay availability, abuse controls, and a clear data-retention policy.
- It is a separate product, not a small desktop feature.

## Pairing flow (implemented)

1. Desktop opens "Remote access" and generates a six-digit code, valid for five minutes and single use.
2. Phone opens the HTTPS WebUI and is redirected to `/pair`, a standalone page that requires no AionCore session.
3. Phone submits the code and a device name. The desktop shows the pending request with the device name and address.
4. The person at the desktop chooses Read only or Full access, then approves or rejects it. Five wrong codes rotate the code and lock that attempt.
5. On approval, the phone polls and receives an HttpOnly, SameSite=Strict device cookie. The raw token is delivered once; only its SHA-256 hash is stored.
6. Every page, API request, `/ws`, and `/kyrn` now needs that cookie. Web-host checks it before proxying to AionCore or the KyRN host. Read-only devices are limited to read endpoints and read-only KyRN methods.
7. The desktop lists paired devices with last-seen time. Revoking one deletes its hash, invalidates the next request, and closes its live sockets.
8. Device tokens expire after 30 days. Rotating one keeps the old cookie valid for ten minutes while the open WebUI claims the new cookie; if it is not claimed, the old token is restored.

## Near-term order

1. **Wire the WebUI service into the app.** Done: `webui.start` / `status` / `stop` and a System settings switch.
2. **Add a single-origin KyRN proxy.** Done: same-origin `/kyrn`, token rewritten server-side, `Origin` check in place.
3. **Add reverse-proxy/VPN support first.** Done for loopback-only service and setup notes above. App-native TLS is still out of scope.
4. **Pairing and device approval.** Done: one-time code, approval, HttpOnly device token, device list, revocation, expiry, audit.
5. **Scope the device token.** Done: read-only versus full access, enforced per KyRN method and at the AionCore HTTP boundary.
6. **Persist the Remote access switch.** Done: `system.webuiEnabled` and startup restore.
7. **Cover host-backed pages in E2E:** providers, judges, skills, MCP, activity/lessons. The pairing E2E covers `kyrn.settings` and a denied write; the rest still need page-level tests.
8. **Show the phone-facing proxy URL.** Done: `system.webuiPublicUrl` and a copyable `/pair` link.
9. **Rotate a device token in place.** Done: a 10-minute grace window and a WebUI claim poll.
10. **Reload extension handlers without an app restart.** Done: mtime-based reload clears the extension's modules from the require cache.

## Non-goals for the first remote slice

- Public internet exposure without user setup.
- Passing provider keys to the browser.
- Letting a paired phone open the desktop's file manager or install MCP servers without full access.
- A general-purpose per-endpoint policy editor. The read-only allowlist is intentionally narrow; full access is still all-or-nothing.
