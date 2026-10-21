# Releasing

For maintainers. mu ships two things, versioned separately:

- **The desktop app**: `vX.Y.Z` tags on this repository, published as GitHub pre-releases with installers for six platforms.
- **The `mu-agent` npm package**: the command line, which the app also bundles. Its version is in `kyrn/npm/package.template.json` and its changelog in [kyrn/npm/CHANGELOG.md](../kyrn/npm/CHANGELOG.md).

## What CI does

| Workflow | When | What |
| --- | --- | --- |
| `ci.yml` | Every push to `main` and every pull request | `npm run check` and the tests; the app's lint, format, i18n, type and unit checks; MCP conformance |
| `windows-tests.yml`, `windows-permission.yml` | Pushes and pull requests | The kernel's and the app's unit tests on Windows; the startup chain and a permission round trip |
| `npm.yml` | Pushes to `main` that touch the harness | Builds and packs `mu-agent`, installs the tarball and runs it on Linux (Node 22.19), macOS and Windows; keeps the tarball as an artifact |
| `desktop.yml` | Pushes to `main` that touch `desktop/`, and `v*` tags | Packs this commit's mu, builds the app for macOS, Windows and Linux (x64 and arm64), signs and notarizes the macOS builds, and holds a real conversation in each built app; on a tag, publishes the release |
| `npm-audit.yml` | Daily | Audits the dependencies |
| `model-catalog.yml` | Weekly | Pins the newest model catalog published on pi.dev and opens a pull request with the checks started on it |

CI builds every package with the model catalog pinned in `nix/model-catalog.json` (`npm run build:pinned`), not the live one `npm run build` generates, so a model that's added, renamed or dropped upstream can't fail an unrelated pull request. It reaches mu in the weekly catalog pull request instead, where a failing test names the model to update.

## Releasing the npm package

1. Add the release's section to `kyrn/npm/CHANGELOG.md` (move `[Unreleased]` under a version and date) and bump the version.
2. Push to `main` and wait for `npm.yml` to pass on all three systems.
3. From an account with publish rights, publish the tarball that CI built and tested (the `mu-agent-tarball` artifact), not one built locally: `npm publish mu-agent-X.Y.Z.tgz`.
4. Check the registry's shasum against the tarball's, and tag the commit `mu-agent-vX.Y.Z` (a tag only, no GitHub release).

## Releasing the desktop app

1. Make sure the app bundles the intended `mu-agent` (the build packs the mu from the same commit), and that `desktop.yml` passed on `main`, including the conversations held in the built apps.
2. Update [CHANGELOG.md](../CHANGELOG.md): move `[Unreleased]` under the new version.
3. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`. The tag run builds every platform again, writes `SHA256SUMS` and the update feeds, and creates the pre-release.
4. Check the release page for every installer, `SHA256SUMS` and the four `latest*.yml` update feeds. Edit the notes so they say what changed for users.
5. An installed earlier version should offer the update and download it only after the user agrees; check that it does.

Releases stay pre-releases while mu is 0.x.

## Secrets

macOS signing and notarization use the repository secrets `BUILD_CERTIFICATE_BASE64`, `P12_PASSWORD` and `KEYCHAIN_PASSWORD`, plus the notarization credentials. Workflows from forks never see them: pull requests from forks are built and tested, but not signed or published.
