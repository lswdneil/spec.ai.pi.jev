import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { mergeUpdateInfo, parseUpdateInfo, refreshFromAssets, scalarValue } from "./merge-update-info.mjs";

const script = fileURLToPath(new URL("./merge-update-info.mjs", import.meta.url));

// As electron-builder 26.15 writes them (builder-util's serializeToYaml over app-builder-lib's update info): each
// macOS job lists its own zip and disk image, each Windows job its own installer.
const MAC_X64 = `version: 0.1.3
files:
  - url: mu-0.1.3-mac-x64.zip
    sha512: c6s4iIPC88tYH4Vd6U2n9zV1tagjgL2mB+t9UOYQgfH+S/UcqFiQ00a99ow0ROfd2uCMcPRFO9dSNm1Nd3RRJQ==
    size: 214523871
    blockMapSize: 226541
  - url: mu-0.1.3-mac-x64.dmg
    sha512: aturOfUor1zh0eldBrb39e+pnUkL7oi1Yuswkd5U87eXeN5InwEdmzRF4L1rX7atBjQg2jcUFdscETGCAa5BCw==
    size: 221839104
    blockMapSize: 233170
path: mu-0.1.3-mac-x64.zip
sha512: c6s4iIPC88tYH4Vd6U2n9zV1tagjgL2mB+t9UOYQgfH+S/UcqFiQ00a99ow0ROfd2uCMcPRFO9dSNm1Nd3RRJQ==
releaseDate: '2026-09-24T08:15:42.117Z'
`;

const MAC_ARM64 = `version: 0.1.3
files:
  - url: mu-0.1.3-mac-arm64.zip
    sha512: 1FITcbG7c0eQ/e5+LpocpHJFZFRyixNOMnc17YXtDa/JOxDgWSV32fe9G3NuMjg1qyFqWjjClW2dNSTWz+0tyQ==
    size: 206117345
    blockMapSize: 217552
  - url: mu-0.1.3-mac-arm64.dmg
    sha512: 3ajqNKMJgsUFTfvmLOE5TOIw4FkfDQo//CtLBQgn7Powe9mSN+dbfxUZz+nD8eNguHrkojOubZAtUNijb4QvCg==
    size: 213207011
    blockMapSize: 223953
path: mu-0.1.3-mac-arm64.zip
sha512: 1FITcbG7c0eQ/e5+LpocpHJFZFRyixNOMnc17YXtDa/JOxDgWSV32fe9G3NuMjg1qyFqWjjClW2dNSTWz+0tyQ==
releaseDate: '2026-09-24T08:17:03.542Z'
`;

const WIN_X64 = `version: 0.1.3
files:
  - url: mu-0.1.3-win-x64.exe
    sha512: Wz0nGXRcGKP6VDKEKtlUPqHvZHT0M4ddcetyOrz+N1OosutupUq/XgdYoZqiMGpFChqdXhxnKYPeXyrIjGmxBw==
path: mu-0.1.3-win-x64.exe
sha512: Wz0nGXRcGKP6VDKEKtlUPqHvZHT0M4ddcetyOrz+N1OosutupUq/XgdYoZqiMGpFChqdXhxnKYPeXyrIjGmxBw==
releaseDate: '2026-09-24T08:15:42.117Z'
`;

const WIN_ARM64 = `version: 0.1.3
files:
  - url: mu-0.1.3-win-arm64.exe
    sha512: T9G2PC3+/HFchbAX/yb2C8kD0yKfhP1bJTIg3aDBKFUoQzLbObMZAJE9u/GjybN4vdY/u/VTZYl6Oyddilo71w==
path: mu-0.1.3-win-arm64.exe
sha512: T9G2PC3+/HFchbAX/yb2C8kD0yKfhP1bJTIg3aDBKFUoQzLbObMZAJE9u/GjybN4vdY/u/VTZYl6Oyddilo71w==
releaseDate: '2026-09-24T08:21:19.006Z'
`;

const LINUX_X64 = `version: 0.1.3
files:
  - url: mu-0.1.3-linux-amd64.deb
    sha512: swTv2q/UGqSsHEQpsyt8RnlnM7cC61hRxXEGGQnftMiYiH1Po1bXdRFYdW47RttAPyxtnT01W7pZrDBZi1KUrg==
    size: 118734512
path: mu-0.1.3-linux-amd64.deb
sha512: swTv2q/UGqSsHEQpsyt8RnlnM7cC61hRxXEGGQnftMiYiH1Po1bXdRFYdW47RttAPyxtnT01W7pZrDBZi1KUrg==
releaseName: mu v0.1.3
releaseNotes: |-
  Preview build.

  - The app updates itself.
releaseDate: '2026-09-24T08:15:42.117Z'
`;

function workspace(t) {
	const root = mkdtempSync(join(tmpdir(), "mu-update-info-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const write = (name, contents) => {
		const file = join(root, name);
		mkdirSync(join(file, ".."), { recursive: true });
		writeFileSync(file, contents);
		return file;
	};
	const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
	return { root, write, run };
}

const urls = (text) =>
	parseUpdateInfo(text)
		.find((field) => field.key === "files")
		.entries.map(urlOf);
const urlOf = (entry) => scalarValue(entry.find((item) => item.key === "url").raw);
const sha512 = (contents) => createHash("sha512").update(contents).digest("base64");
const portablePaths = (text) => text.replaceAll("\\", "/");

// How electron-updater 6.8 picks its file from a feed. macOS (MacUpdater.doDownloadUpdate): on an arm64 Mac the
// arm64 files if there are any, elsewhere the others, then the first zip. Windows (findFile): the installer whose name
// holds process.arch, else the first one.
const macZip = (text, arm64) => {
	const files = urls(text);
	const isArm64 = (url) => url.includes("arm64");
	const own = arm64 && files.some(isArm64) ? files.filter(isArm64) : files.filter((url) => !isArm64(url));
	return own.find((url) => url.endsWith(".zip"));
};
const windowsInstaller = (text, arch) => {
	const installers = urls(text).filter((url) => url.endsWith(".exe"));
	return installers.find((url) => url.includes(arch)) ?? installers[0];
};

test("merges the two macOS feeds into one that gives each Mac its own zip", (t) => {
	const { root, write, run } = workspace(t);
	const x64 = write("update-info-macos-x64/latest-mac.yml", MAC_X64);
	const arm64 = write("update-info-macos-arm64/latest-mac.yml", MAC_ARM64);

	const result = run("--out", "updates/latest-mac.yml", x64, arm64);
	assert.equal(result.status, 0, result.stderr);
	const merged = readFileSync(join(root, "updates/latest-mac.yml"), "utf8");

	// The x64 feed with the arm64 files added: its path, sha512 and releaseDate stay.
	const arm64Files = MAC_ARM64.slice(MAC_ARM64.indexOf("  - url"), MAC_ARM64.indexOf("path:"));
	assert.equal(merged, MAC_X64.replace("path:", `${arm64Files}path:`));
	assert.equal(macZip(merged, true), "mu-0.1.3-mac-arm64.zip");
	assert.equal(macZip(merged, false), "mu-0.1.3-mac-x64.zip");
	// Either feed alone would send the other architecture's Macs a build of the wrong architecture.
	assert.equal(macZip(MAC_X64, true), "mu-0.1.3-mac-x64.zip");
	assert.match(result.stdout, /updates\/latest-mac\.yml: mu-0\.1\.3-mac-x64\.zip, .*mu-0\.1\.3-mac-arm64\.zip/);
});

test("merges the two Windows feeds, which both write latest.yml", (t) => {
	const { root, write, run } = workspace(t);
	const x64 = write("x64/latest.yml", WIN_X64);
	const arm64 = write("arm64/latest.yml", WIN_ARM64);

	const result = run("--out", "updates/latest.yml", x64, arm64);
	assert.equal(result.status, 0, result.stderr);
	const merged = readFileSync(join(root, "updates/latest.yml"), "utf8");

	assert.deepEqual(urls(merged), ["mu-0.1.3-win-x64.exe", "mu-0.1.3-win-arm64.exe"]);
	assert.equal(windowsInstaller(merged, "x64"), "mu-0.1.3-win-x64.exe");
	assert.equal(windowsInstaller(merged, "arm64"), "mu-0.1.3-win-arm64.exe");
	assert.equal(windowsInstaller(WIN_X64, "arm64"), "mu-0.1.3-win-x64.exe");
	assert.match(merged, /^path: mu-0\.1\.3-win-x64\.exe$/m);
});

test("passes a single feed through byte for byte", (t) => {
	const { root, write, run } = workspace(t);
	const linux = write("update-info-linux-x64/latest-linux.yml", LINUX_X64);

	const result = run("--out", "updates/latest-linux.yml", linux);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(readFileSync(join(root, "updates/latest-linux.yml"), "utf8"), LINUX_X64);
});

test("keeps a file that two feeds list with the same checksum once", () => {
	const merged = mergeUpdateInfo([
		{ name: "a", fields: parseUpdateInfo(MAC_X64) },
		{ name: "b", fields: parseUpdateInfo(MAC_X64) },
	]);
	assert.deepEqual(merged.find((field) => field.key === "files").entries.map(urlOf), [
		"mu-0.1.3-mac-x64.zip",
		"mu-0.1.3-mac-x64.dmg",
	]);
});

test("refuses feeds of different versions, and writes nothing", (t) => {
	const { root, write, run } = workspace(t);
	const x64 = write("x64/latest-mac.yml", MAC_X64);
	const arm64 = write("arm64/latest-mac.yml", MAC_ARM64.replace("version: 0.1.3", "version: 0.1.4"));

	const result = run("--out", "updates/latest-mac.yml", x64, arm64);
	assert.equal(result.status, 1);
	assert.match(portablePaths(result.stderr), /arm64\/latest-mac\.yml is for version 0\.1\.4, .*x64\/latest-mac\.yml for 0\.1\.3/);
	assert.equal(existsSync(join(root, "updates/latest-mac.yml")), false);
});

test("refuses a file that two feeds list with different checksums", () => {
	const other = MAC_ARM64.replaceAll("mac-arm64", "mac-x64");
	assert.throws(
		() =>
			mergeUpdateInfo([
				{ name: "x64/latest-mac.yml", fields: parseUpdateInfo(MAC_X64) },
				{ name: "other/latest-mac.yml", fields: parseUpdateInfo(other) },
			]),
		/mu-0\.1\.3-mac-x64\.zip has different checksums in x64\/latest-mac\.yml and other\/latest-mac\.yml/,
	);
});

test("refuses YAML it does not know instead of guessing", () => {
	// A web installer's feed nests its packages inside the file entry.
	const web = WIN_X64.replace("path:", "    packages:\n      x64:\n        size: 1\npath:");
	assert.throws(() => parseUpdateInfo(web, "latest.yml"), /latest\.yml:5: unexpected line in files: +packages:/);
	assert.throws(
		() => parseUpdateInfo("version: 0.1.3\nversion: 0.1.4\n", "twice.yml"),
		/twice\.yml:2: "version" appears twice/,
	);
	assert.throws(
		() => mergeUpdateInfo([{ name: "empty.yml", fields: parseUpdateInfo("version: 0.1.3\nfiles: []\n") }]),
		/empty\.yml lists no files/,
	);
});

test("takes the checksum and size of a file changed after the feed was written, as the stapled disk image", (t) => {
	const { root, write, run } = workspace(t);
	const zip = "the zip electron-builder packed";
	const dmg = "the disk image, then signed and stapled";
	write("dist/mu-0.1.3-mac-x64.zip", zip);
	write("dist/mu-0.1.3-mac-x64.dmg", dmg);
	write("updates/mu-0.1.3-mac-x64.zip.blockmap", "zip blockmap");
	write("updates/mu-0.1.3-mac-x64.dmg.blockmap", "dmg blockmap, of the image before it was signed");
	const feed = write(
		"update-info-macos-x64/latest-mac.yml",
		`version: 0.1.3
files:
  - url: mu-0.1.3-mac-x64.zip
    sha512: ${sha512(zip)}
    size: ${zip.length}
    blockMapSize: 12
  - url: mu-0.1.3-mac-x64.dmg
    sha512: ${sha512("the disk image")}
    size: 14
    blockMapSize: 47
path: mu-0.1.3-mac-x64.zip
sha512: ${sha512(zip)}
releaseDate: '2026-09-24T08:15:42.117Z'
`,
	);

	const result = run("--out", "updates/latest-mac.yml", "--assets", "dist", feed);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(
		readFileSync(join(root, "updates/latest-mac.yml"), "utf8"),
		`version: 0.1.3
files:
  - url: mu-0.1.3-mac-x64.zip
    sha512: ${sha512(zip)}
    size: ${zip.length}
    blockMapSize: 12
  - url: mu-0.1.3-mac-x64.dmg
    sha512: ${sha512(dmg)}
    size: ${dmg.length}
path: mu-0.1.3-mac-x64.zip
sha512: ${sha512(zip)}
releaseDate: '2026-09-24T08:15:42.117Z'
`,
	);
	// The disk image's blockmap describes the image before it changed; the zip's still matches.
	assert.equal(existsSync(join(root, "updates/mu-0.1.3-mac-x64.dmg.blockmap")), false);
	assert.equal(existsSync(join(root, "updates/mu-0.1.3-mac-x64.zip.blockmap")), true);
	assert.match(result.stdout, /mu-0\.1\.3-mac-x64\.dmg changed after the feed was written/);
});

test("keeps the top-level path and sha512 in step with the file they name", async (t) => {
	const { root, write } = workspace(t);
	write("dist/mu-0.1.3-win-x64.exe", "the installer");
	const fields = parseUpdateInfo(WIN_X64);

	assert.deepEqual(await refreshFromAssets(fields, join(root, "dist")), ["mu-0.1.3-win-x64.exe"]);
	assert.equal(scalarValue(fields.find((field) => field.key === "sha512").raw), sha512("the installer"));
});

test("adds the size electron-builder leaves out of the Windows installer's entry", (t) => {
	const { root, write, run } = workspace(t);
	const exe = "the installer";
	write("dist/mu-0.1.3-win-x64.exe", exe);
	const fixture = scalarValue(parseUpdateInfo(WIN_X64).find((field) => field.key === "sha512").raw);
	const written = WIN_X64.replaceAll(fixture, sha512(exe));
	const feed = write("x64/latest.yml", written);

	const result = run("--out", "updates/latest.yml", "--assets", "dist", feed);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(
		readFileSync(join(root, "updates/latest.yml"), "utf8"),
		written.replace(`    sha512: ${sha512(exe)}\n`, `    sha512: ${sha512(exe)}\n    size: ${exe.length}\n`),
	);
	// Only the size was missing: the installer did not change after the feed was written.
	assert.doesNotMatch(result.stdout, /changed after the feed was written/);
});

test("refuses a feed that lists a file the release does not have", (t) => {
	const { root, write, run } = workspace(t);
	write("dist/mu-0.1.3-win-x64.exe", "the installer");
	const x64 = write("x64/latest.yml", WIN_X64);
	const arm64 = write("arm64/latest.yml", WIN_ARM64);

	const result = run("--out", "updates/latest.yml", "--assets", "dist", x64, arm64);
	assert.equal(result.status, 1);
	assert.match(result.stderr, /mu-0\.1\.3-win-arm64\.exe is in the feed but not among the release's files in dist/);
	assert.equal(existsSync(join(root, "updates/latest.yml")), false);
});

test("says how it is used", (t) => {
	const { write, run } = workspace(t);
	const feed = write("latest.yml", WIN_X64);
	assert.match(run(feed).stderr, /--out is required/);
	assert.match(run("--out", "x.yml").stderr, /no feed file given/);
	assert.match(run("--out", "x.yml", "--channel", "beta", feed).stderr, /unknown option --channel/);
});
