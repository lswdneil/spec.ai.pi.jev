import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Part of the copy's name: a change to how templates are localized makes old copies unused. */
const FORMAT = 1;
const LANGUAGE_KEY = /^([A-Za-z]+(?:-[A-Za-z]+)*)-(zh|en):/;

/**
 * pi reads a prompt template's description and argument hint from its
 * frontmatter, in one language. spec.jev's templates carry their Chinese beside
 * the English (`description-zh`, `argument-hint-zh`). For a person who reads
 * spec.jev in Chinese, pi is given copies with the Chinese in place. The body,
 * which is what the model reads, is the same in both.
 *
 * Only one-line values are swapped. A block value (`|`, `>`, or indented
 * lines after the key) keeps its English: rewriting YAML line by line must
 * not change what pi's parser reads.
 */
export function localizeTemplate(text: string, wording: "zh"): string {
	const normalized = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
	if (!normalized.startsWith("---\n")) return normalized;
	const end = normalized.indexOf("\n---", 3);
	if (end < 0) return normalized;
	const lines = normalized.slice(4, end).split("\n");
	const oneLine = (index: number, value: string) =>
		!/^\s*[|>]/.test(value) && !/^\s/.test(lines[index + 1] ?? "") && value.trim() !== "";
	const localized = new Map<string, string>();
	lines.forEach((line, index) => {
		const match = LANGUAGE_KEY.exec(line);
		if (match && match[2] === wording && oneLine(index, line.slice(match[0].length)))
			localized.set(match[1], line.slice(match[0].length));
	});
	const english = new Set(lines.map((line) => line.slice(0, line.indexOf(":"))));
	// A language key goes, and so do the indented lines of its value.
	let dropping = false;
	const kept = lines
		.filter((line) => {
			if (LANGUAGE_KEY.test(line)) dropping = true;
			else if (!/^\s/.test(line)) dropping = false;
			return !dropping;
		})
		.map((line, index, all) => {
			const key = line.slice(0, line.indexOf(":"));
			const value = localized.get(key);
			// The English value is replaced only when it is one line itself.
			return value !== undefined && oneLineAt(all, index) ? `${key}:${value}` : line;
		});
	// A Chinese key with no English twin is still the key pi reads.
	for (const [key, value] of localized) if (!english.has(key)) kept.push(`${key}:${value}`);
	return `---\n${kept.join("\n")}${normalized.slice(end)}`;
}

const oneLineAt = (lines: readonly string[], index: number) => {
	const value = lines[index].slice(lines[index].indexOf(":") + 1);
	return !/^\s*[|>]/.test(value) && !/^\s/.test(lines[index + 1] ?? "");
};

/**
 * The folder to give pi for spec.jev's templates: the folder itself in English, a copy in Chinese kept under
 * `root` (spec.jev's own folder, which is the user's alone, since a template is text the model follows). The copy
 * is named by what it was made from, so an updated template is copied again and a stale copy is never read.
 * When it cannot be made, the English templates are used.
 */
export function promptsFor(dir: string, wording: "zh" | "en" | undefined, root: string): string {
	if (wording !== "zh") return dir;
	try {
		const sources = readdirSync(dir)
			.filter((name) => name.endsWith(".md"))
			.sort()
			.map((name) => [name, readFileSync(join(dir, name), "utf8")] as const);
		const hash = createHash("sha256")
			.update(JSON.stringify([FORMAT, wording, sources]))
			.digest("hex")
			.slice(0, 12);
		const target = join(root, `${wording}-${hash}`);
		if (existsSync(target)) return target;
		const temporary = `${target}.${process.pid}.tmp`;
		mkdirSync(temporary, { recursive: true, mode: 0o700 });
		for (const [name, text] of sources) writeFileSync(join(temporary, name), localizeTemplate(text, wording));
		try {
			renameSync(temporary, target);
		} catch {
			// Another spec.jev made the same copy first.
			rmSync(temporary, { recursive: true, force: true });
		}
		return existsSync(target) ? target : dir;
	} catch {
		return dir;
	}
}
