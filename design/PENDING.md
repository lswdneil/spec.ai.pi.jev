# Pending work

## 0.1.x release scope (confirmed 2026-10-25)

- spec.jev is independent; MU 0.1.10-0.2.10 is not a release requirement.
- Platforms: Windows x64 and Linux x64, Linux ships `.deb` only.
- macOS and Android are deferred; no macOS build or signing.
- WebUI code and tests stay, but the Remote access panel is hidden and the
  listener does not start in 0.1.x.
- Laya stays as the local judge on Windows/Linux through ONNX.
- Remove the legacy UI and Arco compatibility layer before release.
- Canonical repository: `https://github.com/lswdneil/spec.ai.pi.jev`.

## Release readiness (checked 2026-10-27)

Passed locally on Windows x64:

- Desktop unit suite: 666 files, 6767 tests, 116 skipped.
- Classic conversation E2E (AionCore): 9/9.
- Native-host E2E: 72/72, 12 skipped (packaged-app-only cases).
- Visual regression: 4/4.
- `bunx tsc --noEmit`.
- 0.1.x Laya onboarding downloads the pinned ONNX files itself, checks every
  SHA-256 and starts the judge; the manual Hugging Face path remains.
- Real Laya model (681 MB) installed and run with ONNX on CPU. In a real native
  conversation it answered most `input.preflight`, `capability.disclosure` and
  `turn.continue` questions; the low-confidence remainder went to the next tier.
- Stopping Laya between turns made every decision report `unreachable` and fall
  to the next tier. The deterministic fallback tier was `mock`. OpenCode Zen's
  free Jev returned `rate_limited` in the same run, so a real Jev answer is not
  yet demonstrated.
- Windows installed-app first-run E2E: 3/3; install and uninstall succeeded.
- Linux x64 `.deb` install, executable check, remove and purge succeeded in WSL
  Ubuntu. The `.deb` carries the Linux x64 `onnxruntime-node` binary; its
  `localJudgeOnnx.js` loaded the real model, answered `/health` and returned a
  boolean verdict (`0.8777`) on CPU in 282 ms.
- `0.1.10 -> 0.1.11` Windows upgrade passed with the installed app: the data
  marker and database survived, the installed app.asar and bundled harness both
  report `0.1.11`, and the app starts.
- `0.1.10 -> 0.1.11` Linux `.deb` upgrade passed in WSL Ubuntu: `dpkg` reports
  `0.1.11`, the data marker survived, the bundled ONNX runtime is present, and
  the app starts under Xvfb.
- `0.1.11` desktop release published with Windows x64, Linux x64 `.deb`,
  `SHA256SUMS` and both update feeds. `spec.jev@0.1.11` is live on npm with
  provenance; Trusted Publishing worked through `npm.yml`.
- A local Windows 0.1.11 installer now carries the moli source build
  (`73928db11`, 1.1.19) under `resources/bundled-moli`; the packaged app sets
  `SPECJEV_MOLI` and starts it. The build hook verifies the binary; the release
  CI path downloads the pinned official 1.1.19 asset with a SHA-256 check.
- The same local installer carries Windows-MCP 0.8.8 (`cef52ec`) as a
  PyInstaller standalone `resources/bundled-mcp/windows-mcp.exe`. It is seeded
  once into the native host's `agent/mcp.json` (shown as "Windows desktop" on
  Settings → MCP servers) and into the classic MCP database. Its stdio
  handshake returned all 21 tools; `ControlStatus` answered `ready`. Removing
  the native entry is remembered, and an app move refreshes only its path. A
  published installer that includes moli and Windows-MCP still needs a new
  version.

Still external or undecided before a public release:

- Windows code signing certificate: CI signs when
  `WINDOWS_CERTIFICATE_BASE64` and `WINDOWS_CERTIFICATE_PASSWORD` exist;
  otherwise the release is unsigned and says so.
- npm Trusted Publishing is configured for `npm.yml`; it needs one real publish
  before the configured window closes.
- OpenCode Zen's free Jev is rate-limited here; a real Jev fallback needs a key
  or a later retry.
- The `spec.jev-v0.1.11` publish job is red because npm took longer than the
  job's 60-second registry check; the package is live and its shasum matches.
  The workflow now waits five minutes and can verify an already-published
  tarball, so future releases and reruns do not fail this way.

## Deferred: remove the legacy MU UI and Arco compatibility layer

Status: the old shell, its CSS and its routes are gone; Dense is the only UI.
Some primitives still emit `arco-*` class names and a few E2E helpers still use
them as selectors. They are labels, not an Arco dependency. Do not reintroduce
the legacy shell.

Recorded: 2026-10-23. Updated: 2026-10-25.

The default UI is Dense, but the old MU/AionUi shell and its compatibility
layer are still shipped:

- `?ui=v1` fallback and the old `Sider` (replaces `DenseSider`).
- Legacy branches in `Layout`, `AppearanceSettings`, `WorkPanel`, and
  conversation layout.
- `legacy-overrides.css`, `themes/mu-scales.css`, and `themes/mu-shell.css`.
- `arco-*` class names emitted by the new primitives (`button`, `select`,
  `menu`, `tag`, `form`, `spinner`, dialogs).
- Remaining Arco-derived base components such as `MuModal`, `MuSearchInput`,
  `MuInlineSearchInput`, and `MuSteps`.

Scope if approved:

1. Decide whether the `?ui=v1` fallback is removed or kept for one more
   release.
2. Remove the old shell and page branches.
3. Audit tests, extensions, and stored preferences that depend on Arco class
   names or old storage keys.
4. Delete the compatibility CSS and class names in batches, with visual and
   unit regression checks.

## Deferred: WebUI remote-access gaps

Status: core remote flow works; remaining items are deferred.

Recorded: 2026-10-25.

- Native host screens are forced onto the classic path in a browser
  (`nativeClient.enabled()` is false without the desktop IPC). Decide whether
  native conversations/skills/MCP are in WebUI scope.
- Desktop-only actions still have no remote equivalent: folder picker,
  reveal/open in the OS file manager, in-app browser, Office watch preview,
  updates, tray/start-on-boot/GPU/DevTools.
- Skill add and other flows that call `dialog.showOpen` do not work from a
  remote browser. Replace with a path input or browser upload/selection.
- Source Control is not proxied: `kyrn.folder.git.status` and
  `kyrn.folder.git.diff` are missing from the WebUI KyRN method table.
- Read-only is coarse: GET/HEAD plus a narrow POST allowlist. Some pages will
  fail when they use an unlisted read-only POST.
- Real write flows need page-level E2E: provider save/test/login, judge
  save/run, skill add/remove, MCP add/remove/switch, import run.
- Activity/lessons E2E only covers empty states; add a fixture with real
  judge records and lessons.
- Mobile settings top chips still scroll horizontally; decide between two
  rows and a "more settings" entry.
- Remote TLS/tunnel remains user-provided. Add a guided Caddy/Tailscale/
  Cloudflare setup, or keep this explicitly as an operator responsibility.

## MU upstream parity: 0.1.9 → 0.2.6

Status: assessment only; do not merge the upstream branch wholesale.

Recorded: 2026-10-25.

The spec.jev fork started from MU `0.1.9` (`origin/main` at `4562529a7`).
The local MU checkout is `0.2.6` (`d98b85358`), with about 420 commits and eight
releases after that base. The desktop backend pin is the same (`aioncoreVersion`
v0.2.2), but the bundled harness is different: spec.jev ships `0.1.0` while MU
ships `muAgentVersion 0.2.6`.

Highest-value missing areas:

1. **Judge models.** MU 0.2.0–0.2.6 adds mude 1.0, resumable installs,
   Hugging Face decision models, and removes Laya. spec.jev still contains
   `process/services/localJudgeOnnx` and the Local Laya panel. This is the
   largest product and performance divergence.
2. **Harness behavior and performance.** MU's newer agent includes usage
   accounting, long-thinking watchdog, run deadlines, lean unattended runs,
   judge screening admission, fewer board/swarm/hive judge calls, checkpoint
   and extension-load work, shorter interactive waits, and sign-in/model fixes.
   spec.jev does not carry these unless separately ported.
3. **Import and auth.** MU 0.1.10 adds ZCode import, full imported history and
   re-import updates, Sign in with ChatGPT, removal of Claude subscription
   sign-in, and the `judge` permission-mode name. spec.jev's import tools are
   still Claude Code and Codex only.
4. **Conversation UX.** MU 0.2.4 adds file references in replies, project
   grouping in the sidebar, and instant conversation opening from home; 0.2.3
   adds model-decided mid-run interjections. These need a file-level diff and
   port, not a merge.
5. **Provider compatibility.** MU adds Gemini 4 Argon through Antigravity and
   safer OpenAI-compatible requests. spec.jev has no corresponding code.
6. **UI polish and stability.** MU 0.2.5–0.2.6 includes first-message Laya
   migration notices, sidebar/file-link/model-chip polish, sign-in port
   handling, sign-out model refresh, and English copy fixes.

Do not fast-forward or cherry-pick the whole upstream branch: the Dense UI,
spec.jev naming, WebUI host, scopes, extension hosting, and tests are local
forks. Port by user-value batches, with a parity matrix and the existing
visual/unit/E2E gates after each batch.

## Desktop accounts (implemented 2026-11-06)

Status: implemented on `feat/auth-accounts` (`aa0777482`, `c09d53f7a`,
`4607768f8`); not released.

A packaged desktop build now starts at a spec.jev cloud-account sign-in. Each
cloud account maps to its own local aioncore user, so conversations, projects,
provider keys, skills, MCP servers and settings stay with the account that
created them on this installation. The first account claims the built-in
`admin` user and inherits pre-account data; later accounts use
`cloud_<cloudUserId>`. The main process keeps the cloud token, the generated
local password and the aioncore cookies; the renderer only sees the public
identity and role. See `docs/accounts.md`.

Still open:

- Cross-device sync is out of scope; isolation is per installation.
- Cloud operations still need a real check: mail/SMS delivery, SPF/DKIM/DMARC,
  login and code rate limits, account-enumeration protection, and the device
  limit policy.
- Windows code signing has no certificate: decided 2026-11-06 to ship unsigned
  builds. A `v*` tag still fails closed by default; the repository variable
  `ALLOW_UNSIGNED_WINDOWS_RELEASE=true` opts into an unsigned pre-release. The
  unsigned installer gets a SmartScreen warning and updates by downloading the
  new installer, not by restarting in place. `gh secret list` on 2026-11-06
  showed only `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, so the
  certificate secrets do not exist.
- The release channel stays GitHub pre-releases
  (`lswdneil/spec.ai.pi.jev`), confirmed 2026-11-06. Pushing the branch and tag
  still needs explicit authorization; a self-hosted or spec-ai.cn update feed
  is not implemented.
- The account UI was approved as high-fidelity HTML in the working session;
  no design file for it is committed.

Verified 2026-11-06:

- Forgot password is wired through the sign-in page for email accounts
  (`account:reset-password` -> `/api/auth/reset-password`).
- A provider, an MCP server and an imported skill created by account A were
  invisible to account B in `desktop/scripts/spike-auth-webui.mjs` (35/35
  checks, including the earlier conversation/settings/WebSocket checks).
- An unsigned Windows x64 build succeeds:
  `npm run build-win:x64:fast` wrote
  `desktop/out/spec.jev-0.1.11-win-x64.exe`, `Get-AuthenticodeSignature`
  returns `NotSigned` for it and for `win-unpacked/spec.jev.exe`, and
  `build-provenance.json` records `signed: false` / `signatureKind: none`.
  The fast script also skips executable metadata editing, so that build is a
  packaging smoke test, not a release artifact. The repository variable
  `ALLOW_UNSIGNED_WINDOWS_RELEASE=true` was set on the GitHub repository the
  same day.
