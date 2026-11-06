#!/usr/bin/env node

/**
 * Desktop release preflight.
 *
 * Checks what a machine can check before a `vX.Y.Z` tag: version lockstep,
 * changelog, worktree, tag, publish target, update feed and signing setup.
 * It never pushes, tags or publishes. Warnings are decisions for a person;
 * `--strict` turns them into failures for a release job.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const strict = process.argv.includes("--strict");
const results = [];

function record(level, name, detail = "") {
	results.push({ level, name, detail });
}

function pass(name, detail) {
	record("pass", name, detail);
}

function warn(name, detail) {
	record("warn", name, detail);
}

function fail(name, detail) {
	record("fail", name, detail);
}

function readText(relativePath) {
	return readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(relativePath) {
	return JSON.parse(readText(relativePath));
}

function git(args, timeout = 10_000) {
	return execFileSync("git", args, {
		cwd: root,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		timeout,
	}).trim();
}

function tryGit(args, timeout) {
	try {
		return { ok: true, value: git(args, timeout) };
	} catch (error) {
		const stderr = typeof error === "object" && error !== null && "stderr" in error ? error.stderr : "";
		const message = stderr && String(stderr).trim() ? String(stderr).trim() : String(error?.message ?? error);
		return { ok: false, error: message.split("\n").map((line) => line.trim()).find(Boolean) ?? "unknown error" };
	}
}

function changelogSection(text, heading) {
	const start = text.indexOf(heading);
	if (start < 0) return "";
	const next = text.indexOf("\n## ", start + heading.length);
	return text.slice(start, next < 0 ? undefined : next);
}

const manifests = [
	["package.json", readJson("package.json")],
	["desktop/package.json", readJson("desktop/package.json")],
	["desktop/packages/desktop/package.json", readJson("desktop/packages/desktop/package.json")],
	["desktop/resources/harness/spec.jev/package.json", readJson("desktop/resources/harness/spec.jev/package.json")],
	["kyrn/npm/package.template.json", readJson("kyrn/npm/package.template.json")],
];
const versions = [...new Set(manifests.map(([, manifest]) => manifest.version))];
if (versions.length === 1) {
	pass("version lockstep", versions[0]);
} else {
	fail("version lockstep", manifests.map(([file, manifest]) => `${file}=${manifest.version}`).join(", "));
}

const desktopManifest = readJson("desktop/package.json");
const version = desktopManifest.version;
const lockVersion = readJson("package-lock.json").packages?.[""]?.version;
if (lockVersion === version) {
	pass("package-lock root version", lockVersion);
} else {
	fail("package-lock root version", `lock=${lockVersion ?? "missing"}, desktop=${version}`);
}

const changelog = readText("CHANGELOG.md");
if (changelog.includes(`## [${version}]`)) {
	pass(`CHANGELOG has ${version}`);
} else {
	fail(`CHANGELOG has ${version}`, "add the release section before tagging");
}
const unreleased = changelogSection(changelog, "## [Unreleased]");
if (unreleased.trim().length > "## [Unreleased]".length) {
	pass("[Unreleased] has entries");
} else {
	warn("[Unreleased] is empty", "nothing to release?");
}

const tag = process.env.RELEASE_TAG || `v${version}`;
const gitProbe = tryGit(["rev-parse", "--show-toplevel"]);
if (!gitProbe.ok) {
	fail("git is usable", `git could not run here: ${gitProbe.error}`);
} else {
	const status = tryGit(["status", "--porcelain=v1", "-uall"]);
	if (!status.ok) {
		fail("worktree clean", `git status failed: ${status.error}`);
	} else if (status.value) {
		fail("worktree clean", status.value.split("\n").slice(0, 5).join(" | "));
	} else {
		pass("worktree clean");
	}

	const branch = tryGit(["rev-parse", "--abbrev-ref", "HEAD"]);
	if (!branch.ok) {
		fail("branch", `git rev-parse failed: ${branch.error}`);
	} else if (branch.value === "main") {
		pass("branch is main");
	} else {
		warn("branch is not main", branch.value || "unknown");
	}

	const upstream = tryGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
	if (!upstream.ok) {
		warn("branch has no upstream", "the release commit must be pushed before tagging");
	} else {
		pass("branch has upstream", upstream.value);
	}

	const localTag = tryGit(["tag", "--list", tag]);
	if (!localTag.ok) {
		fail(`tag ${tag} exists locally`, `git tag failed: ${localTag.error}`);
	} else if (localTag.value === tag) {
		pass(`tag ${tag} exists locally`);
	} else {
		warn(`tag ${tag} is not created`, "expected before the tag step");
	}

	const remoteTag = tryGit(["ls-remote", "--tags", "origin", `refs/tags/${tag}`], 20_000);
	if (!remoteTag.ok) {
		warn(`tag ${tag} is not on origin`, `could not ask origin: ${remoteTag.error}`);
	} else if (remoteTag.value) {
		pass(`tag ${tag} is on origin`);
	} else {
		warn(`tag ${tag} is not on origin`, "push the tag only when authorized");
	}
}

const builder = readText("desktop/packages/desktop/electron-builder.yml");
if (
	/provider:\s*github/.test(builder) &&
	/owner:\s*lswdneil/.test(builder) &&
	/repo:\s*spec\.ai\.pi\.jev/.test(builder)
) {
	pass("publish target is GitHub lswdneil/spec.ai.pi.jev");
} else {
	fail("publish target", "expected provider github, owner lswdneil, repo spec.ai.pi.jev");
}
if (/signAndEditExecutable:\s*false/.test(builder)) {
	fail("packaging does not disable signing", "electron-builder.yml must not set signAndEditExecutable: false");
} else {
	pass("packaging does not disable signing");
}

const updater = readText("desktop/packages/desktop/src/process/services/update/autoUpdaterService.ts");
if (
	updater.includes("provider: 'github'") &&
	updater.includes("owner: 'lswdneil'") &&
	updater.includes("repo: 'spec.ai.pi.jev'")
) {
	pass("update feed matches the publish target");
} else {
	fail("update feed matches the publish target", "autoUpdaterService.ts must use the same GitHub repository");
}

const workflowPath = ".github/workflows/desktop.yml";
if (existsSync(path.join(root, workflowPath))) {
	const workflow = readText(workflowPath);
	if (
		workflow.includes("WINDOWS_CERTIFICATE_BASE64") &&
		workflow.includes("Tagged Windows builds require") &&
		/MU_REQUIRE_SIGNED_BUILD:[^\n]*startsWith\(github\.ref, 'refs\/tags\/v'\)/.test(workflow)
	) {
		pass("tagged Windows builds require signing by default");
	} else {
		fail("tagged Windows builds require signing by default", "desktop.yml lost the tagged-build signing gate");
	}
	if (/MU_REQUIRE_SIGNED_BUILD:[^\n]*vars\.ALLOW_UNSIGNED_WINDOWS_RELEASE != 'true'/.test(workflow)) {
		pass("unsigned releases need the explicit repository variable");
	} else {
		fail(
			"unsigned releases need the explicit repository variable",
			"MU_REQUIRE_SIGNED_BUILD must only relax for vars.ALLOW_UNSIGNED_WINDOWS_RELEASE",
		);
	}
} else {
	fail("CI workflow exists", workflowPath);
}

if (process.env.WINDOWS_CERTIFICATE_BASE64 && process.env.WINDOWS_CERTIFICATE_PASSWORD) {
	pass("local signing secrets are set");
} else if (process.env.ALLOW_UNSIGNED_WINDOWS_RELEASE === "true") {
	pass(
		"unsigned Windows release is explicit",
		"ALLOW_UNSIGNED_WINDOWS_RELEASE=true: SmartScreen warns and updates use the installer",
	);
} else {
	warn(
		"no Windows code-signing certificate",
		"tagged CI builds stop at the signing gate; set ALLOW_UNSIGNED_WINDOWS_RELEASE=true to publish an unsigned pre-release",
	);
}

const localBuild = desktopManifest.scripts?.["build-win:x64:fast"] ?? "";
if (localBuild.includes("signAndEditExecutable=false")) {
	pass("local unsigned smoke build is explicit", "build-win:x64:fast skips signing and executable metadata");
} else {
	warn("local unsigned smoke build is not explicit", "build-win:x64:fast should keep signAndEditExecutable=false");
}

const releasing = readText("docs/releasing.md");
if (
	releasing.includes("WINDOWS_CERTIFICATE_BASE64") &&
	releasing.includes("GitHub pre-releases") &&
	releasing.includes("SHA256SUMS")
) {
	pass("release docs cover signing, channel and checksums");
} else {
	warn("release docs are missing a release detail", "check docs/releasing.md");
}

for (const result of results) {
	const detail = result.detail ? `: ${result.detail}` : "";
	console.log(`${result.level.toUpperCase().padEnd(4)} ${result.name}${detail}`);
}

const counts = results.reduce(
	(total, result) => {
		total[result.level] += 1;
		return total;
	},
	{ pass: 0, warn: 0, fail: 0 },
);
console.log(
	`\nDesktop release preflight (${tag}): ${counts.pass} pass, ${counts.warn} warn, ${counts.fail} fail`,
);
if (counts.fail > 0 || (strict && counts.warn > 0)) process.exitCode = 1;
