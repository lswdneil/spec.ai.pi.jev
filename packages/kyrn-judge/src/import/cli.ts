/**
 * `spec.jev import` (see command.ts). The launcher runs this file with Node's own type stripping in a checkout, and the
 * built judge/dist/import.js in the npm package: it needs nothing from node_modules either way.
 */
import { main, processIo } from "./command.ts";

main(process.argv.slice(2), processIo()).then(
	(code) => {
		process.exitCode = code;
	},
	(error: unknown) => {
		process.stderr.write(`mu import: ${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	},
);
