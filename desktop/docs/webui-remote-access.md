# WebUI remote access: pairing and transport

Status: design, 2026-10-24.

## What exists

- The WebUI can reach AionCore over HTTP/WebSocket.
- A loopback KyRN host now lets a local WebUI call the desktop's KyRN providers.
- The loopback host uses a 256-bit token in the WebSocket path and binds `127.0.0.1` only.
- The phone E2E passes that loopback link as `?kyrnHost=...`.

That is enough for a same-machine browser. It is **not** a remote-access design: a URL token over a LAN is a password in plain text, and there is no device approval or revocation.

## What remote access must guarantee

1. **Transport confidentiality.** A phone on a LAN or the internet must not send session cookies, KyRN tokens, settings, keys, activity, or files over plain `ws://`/`http://`.
2. **Server authentication.** The phone must know it is talking to the intended desktop, not a LAN impostor.
3. **User authorization.** Opening a link is not enough; the desktop must approve the device.
4. **Least privilege.** A paired device needs only the KyRN methods the UI uses; it must not become a general shell or file API.
5. **Revocation and rotation.** The desktop can list devices and revoke one; tokens expire and rotate.
6. **No secret delivery to the browser.** Provider keys and local judge credentials stay on the desktop. The browser receives results, never `.env` contents.
7. **Auditability.** Pairing, revocation, and sensitive calls are recorded.

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

## Pairing flow (for A or B)

1. Desktop opens "Remote access" and generates a short-lived code (for example six digits, five minutes, single use).
2. Phone opens the HTTPS WebUI, signs in to the existing WebUI session, and enters the code.
3. Desktop shows the device name, IP, and requested scope; the person approves or rejects it.
4. On approval, the desktop issues a device-bound, short-lived KyRN token. The token is stored in an HttpOnly/Secure cookie or a small signed session, never in a URL after pairing.
5. Web-host forwards `/api/kyrn/*` (or a dedicated WSS path) to the loopback KyRN host with the device token.
6. The desktop can list and revoke devices; revocation closes active sockets.

## Near-term order

1. **Wire the WebUI service into the app.** Today the app has no user-facing `webui.start`/`status`/`stop`; the E2E starts web-host itself. Without this, there is nothing for a phone to open.
2. **Add a single-origin KyRN proxy.** The WebUI should call `/api/kyrn` on its own origin; web-host forwards to the loopback host. Do not put the KyRN token in the browser URL.
3. **Add reverse-proxy/VPN support first.** Keep the KyRN host loopback-only. Document Caddy/Tailscale/Cloudflare setups; do not invent app TLS yet.
4. **Then pairing and device approval.** One-time code, scoped token, device list, revocation.
5. **Then cover host-backed pages in E2E:** providers, judges, skills, MCP, activity/lessons. A page that only renders a header is not parity.

## Non-goals for the first remote slice

- Public internet exposure without user setup.
- Passing provider keys to the browser.
- Letting a paired phone open the desktop's file manager or install MCP servers without an explicit permission scope.
- Treating the current `?kyrnHost=` link as a production remote link.
