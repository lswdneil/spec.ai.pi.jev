# agent-desktop

Bundled from **vercel-labs/agent-desktop**, release `v1.2.0`, licence Apache-2.0 (`LICENSE` beside this file).

- Upstream: https://github.com/vercel-labs/agent-desktop
- Release archive: `agent-desktop-v1.2.0-<rust-target>.tar.gz`, SHA-256 checked against the release's
  `checksums.txt` by `scripts/prepareAgentDesktopResources.js`.
- Bundled executable: `resources/bundled-agent-desktop/<platform>-<arch>/agent-desktop[.exe]` (staged at build
  time, not committed). The app puts that folder on `PATH` and records `SPECJEV_AGENT_DESKTOP` before any agent
  shell starts.

Changes from upstream:

- `SKILL.md` is a trimmed edition of upstream `skills/agent-desktop/SKILL.md`: it says the binary ships with
  spec.jev (so no `npm install`), names `SPECJEV_AGENT_DESKTOP` as the fallback path, keeps the Windows
  first-contact notes, and adds the privacy note from upstream's README. Platform detail stays in the binary
  (`agent-desktop skills get platform`), so it can never drift from the executable.
