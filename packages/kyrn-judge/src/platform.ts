import { readFileSync } from "node:fs";

/**
 * What differs between macOS, Linux, WSL and Windows, as functions of facts that are passed in. There is no
 * Windows machine where spec.jev is developed: whatever is decided per platform is decided here or in a function
 * shaped like these, so that it can be tested on a Mac with win32 and WSL parameters.
 */
type Env = Readonly<Record<string, string | undefined>>;

export interface HostFacts {
	readonly platform: NodeJS.Platform;
	readonly env: Env;
	/** The text of /proc/version, where there is one. */
	readonly procVersion?: string;
}

/**
 * WSL is Linux with a Windows next to it. Its own variable says so, and so does its kernel (a shell started
 * without the variable, say by a service, still runs on it). kyrn/bin/mu.mjs has the same rule as `detectWsl`.
 */
export function isWsl({ platform, env, procVersion }: HostFacts): boolean {
	if (platform !== "linux") return false;
	return Boolean(env.WSL_DISTRO_NAME) || /microsoft/i.test(procVersion ?? "");
}

export function hostName(facts: HostFacts): string {
	if (facts.platform === "darwin") return "macOS";
	if (facts.platform === "win32") return "Windows";
	if (facts.platform === "linux") return isWsl(facts) ? "WSL" : "Linux";
	return facts.platform;
}

/** The facts of the machine this runs on. */
export function thisHost(env: Env = process.env): HostFacts {
	let procVersion: string | undefined;
	if (process.platform === "linux") {
		try {
			procVersion = readFileSync("/proc/version", "utf8");
		} catch {}
	}
	return { platform: process.platform, env, procVersion };
}

/** Where WSL mounts the Windows drives: `/mnt/` unless /etc/wsl.conf says otherwise under [automount]. */
export function wslMountRoot(wslConf: string | undefined): string {
	let section = "";
	for (const raw of (wslConf ?? "").split(/\r?\n/)) {
		const line = raw.trim();
		const header = /^\[(.+)\]$/.exec(line);
		if (header) section = header[1].trim().toLowerCase();
		const root = section === "automount" ? /^root\s*=\s*(.+)$/i.exec(line)?.[1].trim() : undefined;
		if (root?.startsWith("/")) return root.endsWith("/") ? root : `${root}/`;
	}
	return "/mnt/";
}

export interface WslPaths {
	/** `WSL_DISTRO_NAME`. Without it a path inside the Linux file system has no Windows spelling. */
	readonly distro?: string;
	readonly mountRoot?: string;
}

/**
 * What `wslpath -w` answers, without starting it: `/mnt/c/Users/x` is `C:\Users\x`, and a path inside the
 * Linux file system is reached from Windows as `\\wsl.localhost\<distro>\...`.
 */
export function wslToWindowsPath(path: string, { distro, mountRoot = "/mnt/" }: WslPaths = {}): string | undefined {
	if (!path.startsWith("/")) return undefined;
	if (path.startsWith(mountRoot)) {
		const [drive, ...rest] = path.slice(mountRoot.length).split("/");
		if (/^[a-z]$/i.test(drive)) return `${drive.toUpperCase()}:\\${rest.filter(Boolean).join("\\")}`;
	}
	if (!distro) return undefined;
	return `\\\\wsl.localhost\\${distro}${path.replace(/\/+$/, "").replaceAll("/", "\\")}`;
}

export type StopPlan =
	| { readonly kind: "signal"; readonly signal: "SIGTERM" | "SIGKILL" }
	| { readonly kind: "command"; readonly command: string; readonly args: string[] };

/**
 * How to stop a child and whatever it started. Windows has no signals: `kill` ends that one process at once
 * and leaves its children running, so the whole tree is taken down with taskkill. (The MCP client does the
 * same for its servers.)
 */
export function stopPlan(platform: NodeJS.Platform, pid: number | undefined, hard: boolean): StopPlan {
	if (platform === "win32" && pid !== undefined) {
		return { kind: "command", command: "taskkill", args: ["/pid", String(pid), "/T", "/F"] };
	}
	return { kind: "signal", signal: hard ? "SIGKILL" : "SIGTERM" };
}

/** What `wslpath -u` answers for a path on a drive: `C:\Users\x` is `/mnt/c/Users/x`. */
export function windowsToWslPath(path: string, { mountRoot = "/mnt/" }: WslPaths = {}): string | undefined {
	const match = /^([a-z]):[\\/]*(.*)$/i.exec(path);
	if (!match) return undefined;
	const rest = match[2].split(/[\\/]+/).filter(Boolean);
	return `${mountRoot}${[match[1].toLowerCase(), ...rest].join("/")}`;
}
