import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedBundledWindowsMcp } from '@/process/agent/kyrn/capabilities/bundledWindowsMcp';

const created: string[] = [];
const makeAgentDir = () => {
  const root = mkdtempSync(join(tmpdir(), 'specjev-windows-mcp-'));
  created.push(root);
  return root;
};
const makeCommand = (root: string) => {
  const command = join(root, 'resources', 'bundled-mcp', 'windows-mcp.exe');
  mkdirSync(join(root, 'resources', 'bundled-mcp'), { recursive: true });
  writeFileSync(command, 'binary');
  return command;
};
const read = (agentDir: string) => JSON.parse(readFileSync(join(agentDir, 'mcp.json'), 'utf8'));

afterEach(() => {
  for (const root of created.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('seedBundledWindowsMcp', () => {
  it('adds the bundled server once and keeps other servers', () => {
    const agentDir = makeAgentDir();
    const command = makeCommand(agentDir);
    writeFileSync(join(agentDir, 'mcp.json'), JSON.stringify({ mcpServers: { github: { command: 'npx' } } }));

    seedBundledWindowsMcp(agentDir, command);

    const document = read(agentDir);
    expect(document.mcpServers.github).toEqual({ command: 'npx' });
    expect(document.mcpServers['windows-mcp']).toEqual({
      command,
      args: ['serve'],
      exposure: 'deferred',
    });
    expect(existsSync(join(agentDir, 'spec.jev', 'bundled-windows-mcp.json'))).toBe(true);

    // A second start does not add a duplicate or change the text.
    const before = readFileSync(join(agentDir, 'mcp.json'), 'utf8');
    seedBundledWindowsMcp(agentDir, command);
    expect(readFileSync(join(agentDir, 'mcp.json'), 'utf8')).toBe(before);
  });

  it('does not put back a server the person removed', () => {
    const agentDir = makeAgentDir();
    const command = makeCommand(agentDir);
    seedBundledWindowsMcp(agentDir, command);
    writeFileSync(join(agentDir, 'mcp.json'), JSON.stringify({ mcpServers: {} }));

    seedBundledWindowsMcp(agentDir, command);

    expect(read(agentDir).mcpServers).toEqual({});
  });

  it('leaves a custom server with the same name alone', () => {
    const agentDir = makeAgentDir();
    const command = makeCommand(agentDir);
    const custom = { command: 'uvx', args: ['windows-mcp', 'serve'] };
    writeFileSync(join(agentDir, 'mcp.json'), JSON.stringify({ mcpServers: { 'windows-mcp': custom } }));

    seedBundledWindowsMcp(agentDir, command);

    expect(read(agentDir).mcpServers['windows-mcp']).toEqual(custom);
    expect(existsSync(join(agentDir, 'spec.jev', 'bundled-windows-mcp.json'))).toBe(true);
  });

  it('refreshes an old bundled path without touching the switch', () => {
    const agentDir = makeAgentDir();
    const command = makeCommand(agentDir);
    seedBundledWindowsMcp(agentDir, command);
    const document = read(agentDir);
    document.mcpServers['windows-mcp'].command = '/old/install/resources/bundled-mcp/windows-mcp.exe';
    document.mcpServers['windows-mcp'].enabled = false;
    writeFileSync(join(agentDir, 'mcp.json'), JSON.stringify(document));

    seedBundledWindowsMcp(agentDir, command);

    expect(read(agentDir).mcpServers['windows-mcp']).toEqual({
      command,
      args: ['serve'],
      exposure: 'deferred',
      enabled: false,
    });
  });

  it('leaves invalid JSON alone', () => {
    const agentDir = makeAgentDir();
    const command = makeCommand(agentDir);
    writeFileSync(join(agentDir, 'mcp.json'), '{ not json');

    seedBundledWindowsMcp(agentDir, command);

    expect(readFileSync(join(agentDir, 'mcp.json'), 'utf8')).toBe('{ not json');
    expect(existsSync(join(agentDir, 'spec.jev', 'bundled-windows-mcp.json'))).toBe(false);
  });

  it('does nothing without a bundled executable', () => {
    const agentDir = makeAgentDir();

    seedBundledWindowsMcp(agentDir, join(agentDir, 'missing', 'windows-mcp.exe'));

    expect(existsSync(join(agentDir, 'mcp.json'))).toBe(false);
  });
});
