/**
 * MCP and skill activity for the kernel bar: the parts of a native view that show what capabilities are being
 * loaded or called right now. Plain data, so the bar can render it and tests can check it without a host.
 */
import type { NativeView, ViewToolCall } from '@/common/utils/nativeHost';

export type CapabilityCategory = 'mcp' | 'skills';
export type CapabilityStatus = 'active' | 'done' | 'error' | 'info';

export type CapabilityActivity = {
  id: string;
  at: number;
  category: CapabilityCategory;
  /** load, call, suggest or find. */
  kind: 'load' | 'call' | 'suggest' | 'find';
  /** The server, skill, or tool being used. */
  name: string;
  /** A tool name, a suggestion's description, or a failure reason. */
  detail?: string;
  status: CapabilityStatus;
};

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const countTools = (value: unknown): number | undefined =>
  Array.isArray(value) ? value.filter((entry) => typeof entry === 'string').length : undefined;

/** A tool call's MCP server and tool: `mcp__<server>__<tool>`. */
const MCP_TOOL = /^mcp__(.+?)__(.+)$/;

/** Only the tail of a long transcript can concern what is happening now. */
const MESSAGE_LIMIT = 200;

const statusOf = (tool: ViewToolCall): CapabilityStatus => {
  if (tool.status === 'error') return 'error';
  if (tool.status === 'streaming' || tool.status === 'pending' || tool.status === 'running') return 'active';
  return 'done';
};

/** The skills an extension suggested after classifying a message (`kyrn.skills`, one `- name: text` per line). */
function suggestedSkills(value: string): Array<{ name: string; detail?: string }> {
  const found: Array<{ name: string; detail?: string }> = [];
  for (const line of value.split('\n')) {
    const match = /^-\s*([^:]+):\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    const name = match[1].trim();
    if (!name) continue;
    const detail = match[2].trim();
    found.push({ name, ...(detail ? { detail } : {}) });
  }
  return found;
}

const SKILL_BLOCK = /<skill\s+name="([^"]+)"/g;
const SKILL_COMMAND = /^\/skill:([A-Za-z0-9_-]+)/;

/**
 * Everything in a native view that concerns MCP servers or skills, in time order: the host's `mcp.started` /
 * `mcp.failed` events, MCP tool calls (`mcp__server__tool`), skills suggested by the classifier, explicit
 * `/skill:name` or `<skill name="...">` invocations, and `find_skill` searches.
 */
export function capabilityActivity(view: NativeView | undefined): CapabilityActivity[] {
  if (!view) return [];
  const events: CapabilityActivity[] = [];

  for (const line of view.host.activity) {
    const payload = record(line.payload);
    if (line.kind === 'mcp.started') {
      const name = text(payload.name) || text(payload.id).replace(/^mcp:/, '');
      if (!name) continue;
      const tools = countTools(payload.tools);
      events.push({
        id: `mcp-load:${line.id}`,
        at: line.at,
        category: 'mcp',
        kind: 'load',
        name,
        ...(tools !== undefined ? { detail: `${tools}` } : {}),
        status: 'done',
      });
    } else if (line.kind === 'mcp.failed') {
      const name = text(payload.name) || text(payload.id).replace(/^mcp:/, '');
      if (!name) continue;
      events.push({
        id: `mcp-failed:${line.id}`,
        at: line.at,
        category: 'mcp',
        kind: 'load',
        name,
        ...(text(payload.reason) ? { detail: text(payload.reason) } : {}),
        status: 'error',
      });
    } else if (line.kind === 'mcp.tools_changed') {
      const name = text(payload.name) || text(payload.id).replace(/^mcp:/, '');
      if (!name) continue;
      const tools = countTools(payload.tools);
      events.push({
        id: `mcp-tools:${line.id}`,
        at: line.at,
        category: 'mcp',
        kind: 'load',
        name,
        ...(tools !== undefined ? { detail: `${tools}` } : {}),
        status: 'info',
      });
    }
  }

  for (const message of view.messages.slice(-MESSAGE_LIMIT)) {
    if (message.role === 'user') {
      const at = message.timestamp;
      const names = new Set<string>();
      for (const match of message.text.matchAll(SKILL_BLOCK)) {
        const name = match[1].trim();
        if (!name) continue;
        names.add(name);
        events.push({
          id: `skill:${message.id}:${name}`,
          at,
          category: 'skills',
          kind: 'call',
          name,
          status: 'done',
        });
      }
      const command = SKILL_COMMAND.exec(message.text.trim());
      if (command && !names.has(command[1])) {
        events.push({
          id: `skill:${message.id}:${command[1]}`,
          at,
          category: 'skills',
          kind: 'call',
          name: command[1],
          status: 'done',
        });
      }
      continue;
    }

    if (message.role === 'custom' && message.customType === 'kyrn.skills') {
      // A custom message has no timestamp: place it at the view's latest known time.
      const at = view.host.activity.at(-1)?.at ?? 0;
      for (const skill of suggestedSkills(message.text)) {
        events.push({
          id: `skill-suggest:${message.id}:${skill.name}`,
          at,
          category: 'skills',
          kind: 'suggest',
          name: skill.name,
          ...(skill.detail ? { detail: skill.detail } : {}),
          status: 'info',
        });
      }
      continue;
    }

    if (message.role !== 'assistant') continue;
    for (const block of message.blocks) {
      if (block.type !== 'tool') continue;
      const match = MCP_TOOL.exec(block.name);
      if (match) {
        events.push({
          id: `mcp-call:${block.id}`,
          at: message.timestamp,
          category: 'mcp',
          kind: 'call',
          name: match[1],
          detail: match[2],
          status: statusOf(block),
        });
      } else if (block.name === 'find_skill') {
        const query = text(block.args.query);
        events.push({
          id: `skill-find:${block.id}`,
          at: message.timestamp,
          category: 'skills',
          kind: 'find',
          name: 'find_skill',
          ...(query ? { detail: query } : {}),
          status: statusOf(block),
        });
      }
    }
  }

  return events.toSorted((left, right) => left.at - right.at);
}
