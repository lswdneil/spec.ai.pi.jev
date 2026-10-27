import { describe, expect, it } from 'vitest';
import { emptyView, type NativeView } from '@/common/utils/nativeHost';
import { capabilityActivity } from '@/renderer/components/kernel/capabilityActivity';

const base = (): NativeView => ({
  ...emptyView(),
  host: {
    activity: [],
    notices: [],
    queue: { steering: [], followUp: [] },
  },
});

describe('capabilityActivity', () => {
  it('turns MCP loading and calls into activity, newest view first', () => {
    const view: NativeView = {
      ...base(),
      host: {
        ...base().host,
        activity: [{ id: 'a1', kind: 'mcp.started', at: 10, payload: { name: 'windows-mcp', tools: ['A', 'B'] } }],
      },
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          streaming: false,
          timestamp: 20,
          blocks: [
            {
              type: 'tool',
              id: 't1',
              name: 'mcp__windows_mcp__ControlStatus',
              args: {},
              status: 'running',
            },
          ],
        },
      ],
    };

    expect(capabilityActivity(view)).toEqual([
      { id: 'mcp-load:a1', at: 10, category: 'mcp', kind: 'load', name: 'windows-mcp', detail: '2', status: 'done' },
      {
        id: 'mcp-call:t1',
        at: 20,
        category: 'mcp',
        kind: 'call',
        name: 'windows_mcp',
        detail: 'ControlStatus',
        status: 'active',
      },
    ]);
  });

  it('shows an MCP failure as an error', () => {
    const view: NativeView = {
      ...base(),
      host: {
        ...base().host,
        activity: [{ id: 'a1', kind: 'mcp.failed', at: 10, payload: { name: 'docs', reason: 'connection refused' } }],
      },
    };

    expect(capabilityActivity(view)).toEqual([
      {
        id: 'mcp-failed:a1',
        at: 10,
        category: 'mcp',
        kind: 'load',
        name: 'docs',
        detail: 'connection refused',
        status: 'error',
      },
    ]);
  });

  it('reads an explicit skill, suggestions and find_skill', () => {
    const view: NativeView = {
      ...base(),
      host: {
        ...base().host,
        activity: [{ id: 'a1', kind: 'agent_start', at: 10, payload: {} }],
      },
      messages: [
        {
          id: 'm1',
          role: 'user',
          text: '<skill name="review" location="/tmp/review">\nBody\n</skill>',
          images: [],
          timestamp: 10,
        },
        {
          id: 'm2',
          role: 'custom',
          customType: 'kyrn.skills',
          text: '- frontend: Check the UI\n- tests: Run the suite',
        },
        {
          id: 'm3',
          role: 'assistant',
          streaming: false,
          timestamp: 30,
          blocks: [
            {
              type: 'tool',
              id: 't1',
              name: 'find_skill',
              args: { query: 'browser' },
              status: 'done',
            },
          ],
        },
      ],
    };

    const events = capabilityActivity(view);
    expect(events.filter((event) => event.category === 'skills')).toEqual([
      { id: 'skill:m1:review', at: 10, category: 'skills', kind: 'call', name: 'review', status: 'done' },
      {
        id: 'skill-suggest:m2:frontend',
        at: 10,
        category: 'skills',
        kind: 'suggest',
        name: 'frontend',
        detail: 'Check the UI',
        status: 'info',
      },
      {
        id: 'skill-suggest:m2:tests',
        at: 10,
        category: 'skills',
        kind: 'suggest',
        name: 'tests',
        detail: 'Run the suite',
        status: 'info',
      },
      {
        id: 'skill-find:t1',
        at: 30,
        category: 'skills',
        kind: 'find',
        name: 'find_skill',
        detail: 'browser',
        status: 'done',
      },
    ]);
  });

  it('reads a slash skill command when no block came back', () => {
    const view: NativeView = {
      ...base(),
      messages: [
        {
          id: 'm1',
          role: 'user',
          text: '/skill:review the diff',
          images: [],
          timestamp: 5,
        },
      ],
    };

    expect(capabilityActivity(view)[0]).toMatchObject({ category: 'skills', kind: 'call', name: 'review' });
  });
});
