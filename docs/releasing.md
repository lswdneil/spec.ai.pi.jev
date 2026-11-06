# Releasing

For maintainers. spec.jev ships two things, versioned separately:

- **The desktop app**: `vX.Y.Z` tags on this repository, published as GitHub pre-releases with installers for Windows x64 and Linux x64 (deb).
- **The `spec.jev` npm package**: the command line, which the app also bundles. Its version is in `kyrn/npm/package.template.json` and its changelog in [kyrn/npm/CHANGELOG.md](../kyrn/npm/CHANGELOG.md).

## What CI does

| Workflow | When | What |
| --- | --- | --- |
| `ci.yml` | Every push to `main` and every pull request | `npm run check` and the tests; the app's lint, format, i18n, type and unit checks; MCP conformance |
| `windows-tests.yml`, `windows-permission.yml` | Pushes and pull requests | The kernel's and the app's unit tests on Windows; the startup chain and a permission round trip |
| `npm.yml` | Pushes to `main` that touch the harness, and `spec.jev-v*` tags | Builds and packs `spec.jev`, installs the tarball and runs it on Linux (Node 22.19) and Windows x64; keeps the tarball as an artifact; on a tag, publishes it to npm |
| `desktop.yml` | Pull requests, pushes to `main`, and `v*` tags that touch the desktop app or the bundled harness inputs | Packs this commit's spec.jev, builds the app for Windows x64 and Linux x64 (deb), and holds a real conversation in each built app; on a tag, publishes the release |
| `npm-audit.yml` | Daily | Audits the dependencies |
| `model-catalog.yml` | Weekly | Regenerates the model catalog CI builds from and opens a pull request with the checks started on it |

CI builds every package with the model catalog in `packages/ai/model-catalog.json` (`npm run build:pinned`), not the live one `npm run build` generates, so a model that's added, renamed or dropped upstream can't fail an unrelated pull request. It reaches spec.jev in the weekly catalog pull request instead: the diff shows which models changed, and a failing test names the one to update. `npm run update:model-catalog` regenerates the snapshot by hand, with spec.jev's own generator (spec.jev's prices and model settings differ in places from the catalog pi publishes).

## Releasing the npm package

1. Add the release's section to `kyrn/npm/CHANGELOG.md` (move `[Unreleased]` under a version and date) and bump the version.
2. Push to `main` and wait for `npm.yml` to pass on both systems.
3. Tag that commit and push the tag: `git tag spec.jev-vX.Y.Z && git push origin spec.jev-vX.Y.Z` (a tag only, no GitHub release). The tag's `npm.yml` run builds and tests the package on both systems again, publishes that tarball to npm and checks that npm serves the same shasum. It refuses a tag whose version isn't the package's, or a version already on npm with a different tarball. A rerun of an already-published, matching tarball skips publishing and verifies the registry entry.

npm trusts the workflow through [trusted publishing](https://docs.npmjs.com/trusted-publishers), so no npm token is stored in the repository. It needs a one-time setup on npmjs.com by an owner of the package: spec.jev → Settings → Trusted publishing → GitHub Actions, with user `lswdneil`, repository `spec.ai.pi.jev` and workflow `npm.yml`. npm also attaches provenance to every version published this way.

Until that package exists on npm and its trusted publisher is configured, an owner can add a granular npm token as the repository secret `NPM_TOKEN`. The publish job uses it when present and still checks the tag, tarball version and registry for an existing version.

## Releasing the desktop app

0. From a clean checkout, run `npm run check:desktop-release`. It checks the version lockstep, the changelog section, the worktree, the tag, the GitHub publish target, the update feed and the signing configuration. It never pushes, tags or publishes. Add `--strict` when every warning must be resolved; with an unsigned release, set `ALLOW_UNSIGNED_WINDOWS_RELEASE=true` in the same shell so the missing certificate is reported as the explicit decision instead of a warning.
1. Make sure the app bundles the intended `spec.jev` (the build packs the spec.jev from the same commit), and that `desktop.yml` passed on `main`, including the conversations held in the built apps.
2. Update [CHANGELOG.md](../CHANGELOG.md): move `[Unreleased]` under the new version.
3. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`. The tag run builds every platform again, writes `SHA256SUMS` and the update feeds, and creates the pre-release. Push the command line's `spec.jev-vX.Y.Z` tag from the same commit as well when the release includes the npm package.
4. Check the release page for every installer, `SHA256SUMS`, `latest.yml` (Windows) and `latest-linux.yml` (Linux). Edit the notes so they say what changed for users.
5. An installed earlier version should offer the update and download it only after the user agrees; check that it does. On Windows the app updates on restart through electron-updater. On Linux, where replacing a `.deb` needs administrator rights, the app downloads the new `.deb` and opens it; the person completes the install in the system package installer.

Releases stay pre-releases while spec.jev is 0.x.

## Secrets

0.1.x has no macOS build, so there are no macOS signing or notarization secrets.

Tagged Windows builds are release/update inputs and require a valid Authenticode signature. The build fails closed, and the release is not published, unless these repository secrets contain a trusted Windows code-signing certificate:

- `WINDOWS_CERTIFICATE_BASE64`: the `.pfx` file, base64 encoded.
- `WINDOWS_CERTIFICATE_PASSWORD`: its password.

The certificate must include the Code Signing extended key usage and be trusted by Windows; the build checks both `spec.jev.exe` and the installer with `Get-AuthenticodeSignature`. Pull-request and branch builds may remain unsigned, but those packaged apps do not enable auto-update and use the manual installer path.

`npm run check:desktop-release` reports whether the signing variables are set in the current shell. The variables that matter for a tagged build are the repository secrets; the check does not read them.

There is no code-signing certificate: this is the decision as of 2026-11-06, so releases are unsigned. A `v*` tag therefore stops at the signing gate unless the repository variable `ALLOW_UNSIGNED_WINDOWS_RELEASE` is `true`. With it set, the Windows installer is built unsigned and published as a pre-release, and the release notes say so. SmartScreen warns on the first run, and because an unsigned build fails the signature check that auto-update relies on, it updates by downloading the new installer and asking the person to run it instead of restarting in place. Remove the variable once a certificate is configured.

Building an unsigned Windows installer locally needs the harness tarball, because `desktop/package.json`'s `muAgentVersion` is not published: run `node kyrn/npm/build.mjs --pack` and pass `MU_HARNESS_TARBALL=.artifacts/npm/spec.jev-<version>.tgz`. `MU_MOLI_BINARY` and `MU_WINDOWS_MCP_BINARY` avoid re-downloading the browser and the Windows MCP. `build-win:x64:fast` disables both signing and executable editing, so its `spec.jev.exe` keeps Electron's product name and file version; treat it as a packaging smoke test, not a release artifact. The tag build in CI sets neither flag, so the published unsigned installer keeps the app's metadata.

Linux deb packages are not Authenticode-signed. Linux never uses the restart updater: the app downloads the `.deb`, and the person installs it explicitly. `SHA256SUMS` is published with every desktop release.
