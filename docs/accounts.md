# Desktop accounts

A packaged desktop build requires a spec.jev cloud account before the app opens. A development build keeps the old local mode unless `SPECJEV_IDENTITY_MODE=webui` is set.

## What an account controls

- The first screen of a packaged install is sign-in or registration. It accepts an email address with a password or a phone number with a one-time code. Administrator accounts also authenticate against the cloud; their role is decided in the main process.
- Each cloud account maps to one local aioncore user. Conversations, projects, provider keys, skills, MCP servers and settings belong to that local user.
- The first account on an installation takes over the built-in `admin` user and inherits the data from a pre-account installation. Later accounts get `cloud_<cloudUserId>`.
- `account-claim.json` records which cloud account owns the built-in `admin` user. Signing out keeps the claim, so the old data cannot silently move to a different account; only an explicit account reset clears it.
- Isolation is per installation. There is no cross-device sync yet.

## Secrets

- The main process keeps the cloud token, the generated local aioncore password and the aioncore session cookies. The renderer receives only the public identity and role.
- `account-session.bin` lives in Electron's `app.getPath('userData')`. It is encrypted with Electron `safeStorage` when the OS keyring is available (`enc:v1:`).
- On Linux without a keyring, the file is written with mode `0600` and prefixed `plain:v1:`, and the account panel says so instead of claiming encryption.
- Writes use a temporary file and rename. Windows may refuse the atomic replace while another process holds the destination open; that case falls back to an in-place overwrite.

## Transport

- The local session uses the cookies `aionui-session`, `aionui-refresh` and `aionui-csrf-token`, with a double-submit CSRF token.
- Main-process services reach aioncore through `httpBridge`, which injects the Cookie and `x-csrf-token` headers.
- The packaged renderer loads from `file://`, where Chromium does not attach a `SameSite=Lax` cookie to the loopback requests. The main process installs a `webRequest.onBeforeSendHeaders` hook for `http://127.0.0.1:<port>/*` and `ws://127.0.0.1:<port>/*`.
- The cloud client calls `https://spec-ai.cn` (APP-API v0.5.0): `/api/auth/send-code`, `/api/auth/register`, `/api/auth/login`, `/api/auth/reset-password`, `/api/auth/change-password`, `/api/auth/revoke-all`, `/api/auth/bind`, `/api/auth/deactivate` and `/api/me`.

## Environment variables

| Variable | Effect |
| --- | --- |
| `SPECJEV_IDENTITY_MODE` | `local` or `webui`. Default: `webui` when packaged, `local` in development. |
| `SPECJEV_CLOUD_BASE_URL` | Override the account API base URL. Default: `https://spec-ai.cn`. |
| `SPECJEV_ADMIN_EMAILS` | Comma-separated extra administrator emails. `devneil@spec-ai.cn` is built in. |
| `SPECJEV_ADMIN_CLOUD_IDS` | Comma-separated extra administrator cloud user IDs. |

## Startup and recovery

- On launch the main process restores `account-session.bin`, refreshes the cloud user, and re-establishes the local aioncore session if its cookie expired.
- A `401` or `403` from the cloud clears the stored session and returns to sign-in. A network failure keeps the local data usable and marks the account offline.
- Startup migrations wait until the renderer has loaded and the account is authenticated, because they read per-user configuration. The login page does not initialize the user config.

## Known gaps

- The cloud client has `resetCloudPassword`, but there is no IPC bridge or UI for it, so "forgot password" is not available in the app yet.
- Provider, skill and MCP isolation uses the same per-user aioncore data directory as conversations and settings, but those three areas have not been verified directly.
