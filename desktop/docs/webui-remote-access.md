# WebUI remote access: pairing and transport

Status: service and same-origin proxy implemented, 2026-10-24. Pairing is still design.

## What exists

- Settings → System → Remote access starts/stops the WebUI service (`webui.start` / `status` / `stop`).
- The service binds `127.0.0.1` and uses a stable port (25808) when free, otherwise an ephemeral one.
- The WebUI reaches AionCore over HTTP/WebSocket through web-host.
- A loopback KyRN host lets the WebUI call the desktop's KyRN providers.
- Web-host exposes **same-origin `/kyrn`** and forwards it to the loopback host. It rewrites the token path in-process, so the KyRN token never appears in the browser URL.
- `/kyrn` requires the browser's `Origin` to equal `Host`, blocking cross-site WebSocket hijacking from a malicious page in the user's browser.
- The phone E2E opens the plain web-host URL (no `?kyrnHost=`), calls a real KyRN provider through `/kyrn`, and asserts the result.

This is enough for a same-machine browser and for a reverse proxy in front of the loopback service. It is **not** a complete remote-access design: there is no device approval, scoped token, revocation, or app-level user auth for `/kyrn` yet.

> **Security gate:** the desktop backend runs in local mode, so the WebUI's login page is not a reliable gate for remote access. Until pairing lands, the reverse proxy **must** authenticate the user (Tailscale/Cloudflare Access, Caddy `basic_auth`, a VPN, or equivalent). Do not expose port 25808 directly to a LAN or the internet.

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
2. Put an authenticating proxy in front of that loopback URL. The proxy must preserve `Host` and forward WebSocket upgrades.
3. Open the proxy's HTTPS URL on the phone. The same-origin `/kyrn` path is proxied automatically; do not append a token.
4. Turn the switch off to stop the listener. Stopping destroys live connections immediately.

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

Cloudflare Tunnel: route the hostname to `http://127.0.0.1:25808` and add a Cloudflare Access policy. A quick tunnel without Access is a public URL and is not acceptable while `/kyrn` has no app-level user auth.

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
5. Web-host forwards `/kyrn` to the loopback KyRN host with the device token, after verifying the device session.
6. The desktop can list and revoke devices; revocation closes active sockets.

## Near-term order

1. **Wire the WebUI service into the app.** Done: `webui.start` / `status` / `stop` and a System settings switch.
2. **Add a single-origin KyRN proxy.** Done: same-origin `/kyrn`, token rewritten server-side, `Origin` check in place.
3. **Add reverse-proxy/VPN support first.** In progress: loopback-only service and setup notes above. Do not invent app TLS yet.
4. **Then pairing and device approval.** One-time code, scoped token, device list, revocation. This is the next security milestone.
5. **Then cover host-backed pages in E2E:** providers, judges, skills, MCP, activity/lessons. A page that only renders a header is not parity.

## Non-goals for the first remote slice

- Public internet exposure without user setup.
- Passing provider keys to the browser.
- Letting a paired phone open the desktop's file manager or install MCP servers without an explicit permission scope.
- Treating the current `?kyrnHost=` link as a production remote link.
