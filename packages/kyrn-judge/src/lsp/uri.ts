/**
 * File paths to `file://` URIs and back, for the machine the language server
 * runs on. The style is a parameter so that Windows and WSL are tested on any
 * machine, and because `node:url` only knows the platform it is running on.
 *
 * URIs are never compared as strings: servers re-encode them (`c%3A`, another
 * drive-letter case). Every incoming URI is turned back into a path, and
 * `pathKey` is what maps are keyed by.
 */
export type UriStyle =
	| { readonly kind: "posix" }
	| { readonly kind: "win32" }
	/** spec.jev runs inside WSL and the server is a Windows executable, which wants Windows paths. */
	| { readonly kind: "wsl-windows"; readonly distro: string };

type Env = Readonly<Record<string, string | undefined>>;

const DRIVE = /^([A-Za-z]):(?:\/|$)/;
const WSL_MOUNT = /^\/mnt\/([A-Za-z])(?:\/|$)/;
const WSL_HOSTS = ["wsl.localhost", "wsl$"];

/** The style for one server: a Windows `.exe` started from inside WSL is the only case that is not the host's own. */
export function uriStyleFor(options: { platform: string; env?: Env; executable?: string }): UriStyle {
	if (options.platform === "win32") return { kind: "win32" };
	const distro = options.env?.WSL_DISTRO_NAME;
	if (options.platform === "linux" && distro && /\.exe$/i.test(options.executable ?? "")) {
		return { kind: "wsl-windows", distro };
	}
	return { kind: "posix" };
}

function encodePath(path: string): string {
	return path
		.split("/")
		.map((segment, index) =>
			// The drive letter keeps its colon: `file:///C:/` is what Node and most editors send.
			index === 1 && /^[A-Za-z]:$/.test(segment) ? segment : encodeURIComponent(segment),
		)
		.join("/");
}

export function pathToUri(path: string, style: UriStyle): string {
	if (style.kind === "posix") return `file://${encodePath(path)}`;
	if (style.kind === "wsl-windows") {
		const mount = WSL_MOUNT.exec(path);
		if (mount) return `file://${encodePath(`/${mount[1].toLowerCase()}:/${path.slice(mount[0].length)}`)}`;
		return `file://wsl.localhost/${encodeURIComponent(style.distro)}${encodePath(path)}`;
	}
	const forward = path.replaceAll("\\", "/");
	// \\server\share\file is a UNC path: the server becomes the authority.
	if (forward.startsWith("//")) {
		const [host, ...rest] = forward.slice(2).split("/");
		return `file://${host}${encodePath(`/${rest.join("/")}`)}`;
	}
	return `file://${encodePath(forward.startsWith("/") ? forward : `/${forward}`)}`;
}

/** The local path of a `file://` URI, or undefined for any other scheme and for text that is no URI. */
export function uriToPath(uri: string, style: UriStyle): string | undefined {
	const match = /^file:\/\/([^/]*)(\/.*)?$/i.exec(uri);
	if (!match) return undefined;
	let host: string;
	let path: string;
	try {
		host = decodeURIComponent(match[1]).toLowerCase();
		path = (match[2] ?? "/").split("/").map(decodeURIComponent).join("/");
	} catch {
		return undefined;
	}
	if (host === "localhost") host = "";
	const drive = DRIVE.exec(path.slice(1));

	if (style.kind === "posix") return path;
	if (style.kind === "wsl-windows") {
		if (WSL_HOSTS.includes(host)) return `/${path.split("/").slice(2).join("/")}`;
		if (!host && drive) return `/mnt/${drive[1].toLowerCase()}/${path.slice(1 + drive[0].length)}`.replace(/\/$/, "");
		return undefined;
	}
	if (host) return `\\\\${host}${path.replaceAll("/", "\\")}`;
	return (drive ? path.slice(1) : path).replaceAll("/", "\\");
}

/** What documents are keyed by. Windows paths compare without case and with either slash. */
export function pathKey(path: string, style: UriStyle): string {
	return style.kind === "win32" ? path.replaceAll("/", "\\").toLowerCase() : path;
}
