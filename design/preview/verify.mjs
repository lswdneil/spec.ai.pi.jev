import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const require = createRequire(join(repo, "desktop", "package.json"));
const { chromium } = require("playwright");

/** The Chromium already installed for the desktop E2E tests, or PLAYWRIGHT_CHROMIUM. */
function chromiumPath() {
	if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
	const cache = join(process.env.LOCALAPPDATA ?? "", "ms-playwright");
	if (!existsSync(cache)) return undefined;
	const candidates = readdirSync(cache)
		.filter((name) => name.startsWith("chromium-"))
		.sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
	for (const name of candidates) {
		const exe = join(cache, name, "chrome-win64", "chrome.exe");
		if (existsSync(exe)) return exe;
	}
	return undefined;
}

const shots = join(here, "shots");
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ executablePath: chromiumPath() });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

const errors = [];
page.on("console", (message) => {
	if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(String(error)));

const directions = ["freebuff", "editorial", "dense"];
const screens = ["conversation", "appearance", "mobile"];
const themes = ["dark", "light"];

for (const direction of directions) {
	for (const screen of screens) {
		for (const theme of themes) {
			await page.goto(`file:///${here}/${direction}.html?screen=${screen}&mode=${theme}`, { waitUntil: "load" });
			await page.waitForTimeout(80);
			const applied = await page.evaluate(() => document.documentElement.dataset.theme);
			if (applied !== theme) errors.push(`${direction}/${screen}/${theme}: theme is ${applied}`);
			await page.screenshot({ path: join(shots, `${direction}-${screen}-${theme}.png`), fullPage: true });
		}
	}
}

await page.setViewportSize({ width: 390, height: 844 });
for (const direction of directions) {
	for (const screen of screens) {
		await page.goto(`file:///${here}/${direction}.html?screen=${screen}&mode=dark`, { waitUntil: "load" });
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
		if (overflow > 1) errors.push(`${direction}/${screen}: horizontal overflow ${overflow}px at 390`);
	}
}

await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`file:///${here}/index.html`, { waitUntil: "load" });
await page.waitForTimeout(500);
await page.screenshot({ path: join(shots, "index.png"), fullPage: true });

await browser.close();
console.log(errors.length === 0 ? "OK - screenshots written" : `ERRORS:\n${errors.join("\n")}`);
