import { afterEach, describe, expect, it } from 'vitest';
import { buildProvider, invokeLocal, provideLocal } from '@/common/platform/bridge';

const disposers: Array<() => void> = [];

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
});

describe('in-process bridge providers', () => {
  it('invokes a provider without an IPC or WebSocket adapter', async () => {
    disposers.push(provideLocal('test.local', async (data) => ({ ok: true, data })));

    await expect(invokeLocal('test.local', { answer: 42 })).resolves.toEqual({
      ok: true,
      data: { answer: 42 },
    });
  });

  it('registers buildProvider handlers for local callers and removes them on dispose', async () => {
    const provider = buildProvider<{ ok: true; data: number }, { value: number }>('test.provider');
    const dispose = provider.provider(async ({ value }) => ({ ok: true, data: value }));
    disposers.push(dispose);

    await expect(invokeLocal('test.provider', { value: 7 })).resolves.toEqual({ ok: true, data: 7 });
    dispose();
    await expect(invokeLocal('test.provider', { value: 7 })).rejects.toThrow('No local provider');
  });

  it('rejects a name no provider registered', async () => {
    await expect(invokeLocal('test.missing')).rejects.toThrow('No local provider');
  });
});
