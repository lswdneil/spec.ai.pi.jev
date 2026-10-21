import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(join(here, "template.html"), "utf8");

const directions = [
	{
		slug: "freebuff",
		title: "Freebuff",
		tagline:
			"Flat sage surfaces, 1px matte edges, no shadows. The accent appears twice: the selected session and the send action.",
	},
	{
		slug: "editorial",
		title: "Editorial",
		tagline:
			"The same palette with a serif display, wider margins and fewer borders. Accent is punctuation, not a theme.",
	},
	{
		slug: "dense",
		title: "Dense",
		tagline:
			"The same palette at 13px: tighter rows, monospace metadata, and the judge rail always visible.",
	},
];

const links = (current) =>
	[
		'<a href="index.html">All directions</a>',
		...directions.map(
			(direction) =>
				`<a href="${direction.slug}.html"${direction.slug === current ? ' class="on"' : ""}>${direction.title}</a>`,
		),
	].join("\n        ");

for (const direction of directions) {
	const html = template
		.split("__DIRECTION__")
		.join(direction.slug)
		.split("__TITLE__")
		.join(direction.title)
		.split("__TAGLINE__")
		.join(direction.tagline)
		.split("__LINKS__")
		.join(links(direction.slug));
	writeFileSync(join(here, `${direction.slug}.html`), html);
	console.log(`wrote ${direction.slug}.html`);
}
