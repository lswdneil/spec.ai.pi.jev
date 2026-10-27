import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { mcpFile } from './mcp';

/**
 * The Windows desktop MCP is built into the app, but spec.jev's native host reads its servers from its own
 * `mcp.json`, not from the app's classic MCP database. This makes the bundled server part of that file once.
 *
 * A marker beside the file records that the default has been offered. Removing the server afterwards is
 * respected: the marker stays, so the next start does not put it back. If the server is still ours, only the
 * executable path is refreshed, so an app upgrade does not leave an old install path in the file.
 */
const MARKER = join('spec.jev', 'bundled-windows-mcp.json');
const SERVER_NAME = 'windows-mcp';

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isBundledCommand = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  const normalized = value.replace(/\\/g, '/').toLowerCase();
  return basename(normalized) === 'windows-mcp.exe' && normalized.includes('/bundled-mcp/');
};

export function seedBundledWindowsMcp(agentDir: string, command: string | undefined): void {
  if (!command || !existsSync(command)) return;

  const file = mcpFile({ agentDir });
  const marker = join(agentDir, MARKER);
  const seeded = existsSync(marker);

  let raw: string | undefined;
  try {
    raw = existsSync(file) ? readFileSync(file, 'utf8') : undefined;
  } catch (error) {
    console.warn(`[spec.jev] cannot read ${file}:`, error);
    return;
  }

  let document: Json = {};
  if (raw !== undefined) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) {
        console.warn(`[spec.jev] ${file}: expected a JSON object; not adding the bundled Windows MCP`);
        return;
      }
      document = parsed;
    } catch (error) {
      console.warn(`[spec.jev] ${file}: invalid JSON; not adding the bundled Windows MCP`, error);
      return;
    }
  }

  if (document.mcpServers !== undefined && !isRecord(document.mcpServers)) {
    console.warn(`[spec.jev] ${file}: "mcpServers" is not an object; not adding the bundled Windows MCP`);
    return;
  }

  const servers = isRecord(document.mcpServers) ? document.mcpServers : {};
  const entry = servers[SERVER_NAME];
  let changed = false;

  if (!seeded) {
    if (entry === undefined) {
      servers[SERVER_NAME] = { command, args: ['serve'], exposure: 'deferred' };
      changed = true;
    } else if (isRecord(entry) && isBundledCommand(entry.command) && entry.command !== command) {
      entry.command = command;
      changed = true;
    }
  } else if (isRecord(entry) && isBundledCommand(entry.command) && entry.command !== command) {
    // The app updated in place or moved: keep the person's switch and arguments, refresh only our path.
    entry.command = command;
    changed = true;
  }

  if (changed) {
    document.mcpServers = servers;
    try {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    } catch (error) {
      console.warn(`[spec.jev] cannot write ${file}:`, error);
      return;
    }
  }

  if (!seeded) {
    try {
      mkdirSync(dirname(marker), { recursive: true });
      writeFileSync(marker, `${JSON.stringify({ server: SERVER_NAME }, null, 2)}\n`, 'utf8');
    } catch (error) {
      console.warn(`[spec.jev] cannot write ${marker}:`, error);
    }
  }
}
