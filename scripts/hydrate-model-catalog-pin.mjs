#!/usr/bin/env node

// Hydrate packages/ai's model data from the catalog pinned in nix/model-catalog.json, as the Nix build does.
// CI builds from the pin, so a model that disappears upstream can't fail an unrelated pull request;
// the weekly model-catalog workflow moves the pin in a pull request of its own.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchRevision, hydrateModelCatalogBytes } from "./update-model-catalog-pin.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { revision } = JSON.parse(readFileSync(join(root, "nix/model-catalog.json"), "utf8"));
hydrateModelCatalogBytes(root, await fetchRevision(revision));
console.log(`Hydrated model data from the pinned catalog ${revision}`);
