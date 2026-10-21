import { muEnv } from "./naming.ts";

/**
 * The language the person reads spec.jev in. The desktop app passes its interface
 * language as MU_LANG ("zh-CN", "en-US", "ja-JP", ...); a terminal user can set
 * it too. Unset means nobody said, and every caller keeps its own default.
 */
export interface AppLanguage {
	/** The tag as given, e.g. "zh-TW". */
	readonly code: string;
	/** spec.jev's own wording exists in Chinese and English; any other language reads the English one. */
	readonly wording: "zh" | "en";
	/** What a model is told to write in: "Traditional Chinese", "Japanese". */
	readonly name: string;
}

/** A BCP 47 tag and nothing else: the value ends up in a model's instructions. */
const TAG = /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8}){0,3}$/;

function nameOf(code: string): string {
	const [base, ...rest] = code.toLowerCase().split("-");
	if (base === "zh") {
		const region = rest.join("-");
		return /hant|tw|hk|mo/.test(region) ? "Traditional Chinese" : "Simplified Chinese";
	}
	try {
		return new Intl.DisplayNames(["en"], { type: "language" }).of(base) ?? code;
	} catch {
		return code;
	}
}

export function appLanguage(env: Record<string, string | undefined> = process.env): AppLanguage | undefined {
	const raw = muEnv("LANG", env)?.trim();
	if (!raw || !TAG.test(raw)) return undefined;
	const code = raw.replaceAll("_", "-");
	const base = code.split("-")[0].toLowerCase();
	return { code, wording: base === "zh" ? "zh" : "en", name: nameOf(code) };
}

/** The Chinese or the English of a message, by the app's language; English when none is set. */
export function say(texts: { readonly zh: string; readonly en: string }, language = appLanguage()): string {
	return language?.wording === "zh" ? texts.zh : texts.en;
}

/**
 * A line a person reads, as a stable code and what it names, for a client
 * that translates into a language spec.jev has no wording for. The English (or the
 * zh/en) text always stays beside it; see docs/features/presentation-codes.md.
 */
export interface Coded {
	readonly code: string;
	readonly params?: Readonly<Record<string, string | number>>;
}

/** An error that also says what it is as a code. `coded`, not `code`: Node's own errors use that for ENOENT. */
export function codedError(message: string, coded: Coded): Error & { coded: Coded } {
	return withCode(new Error(message), coded);
}

/** Gives an error of any class its code. */
export function withCode<E extends Error>(error: E, coded: Coded): E & { coded: Coded } {
	return Object.assign(error, { coded });
}

export function codeOf(error: unknown): Coded | undefined {
	const coded = (error as { coded?: Coded } | undefined)?.coded;
	return coded && typeof coded.code === "string" ? coded : undefined;
}

/** "1 commit", "3 commits": English needs the plural, Chinese does not. */
export function count(n: number, one: string, many = `${one}s`): string {
	return `${n} ${n === 1 ? one : many}`;
}
