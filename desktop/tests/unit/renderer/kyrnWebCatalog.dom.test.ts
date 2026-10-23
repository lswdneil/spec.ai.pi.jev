import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Assistant } from '@/common/types/agent/assistantTypes';

const { httpRequest } = vi.hoisted(() => ({ httpRequest: vi.fn() }));

vi.mock('@/common/adapter/httpBridge', () => ({ httpRequest }));

import { kyrnBridge } from '@/common/kyrn/bridge';
import { installWebKyrnCatalog } from '@/renderer/utils/kyrnWebCatalog';

type BrowserWindow = Window & { electronAPI?: unknown };

const assistants = [{ id: 'assistant-1', name: 'spec.jev' }] as unknown as Assistant[];

describe('WebUI catalog provider', () => {
  beforeEach(() => {
    httpRequest.mockReset();
    delete (window as BrowserWindow).electronAPI;
  });

  it('stays out of Electron', () => {
    (window as BrowserWindow).electronAPI = {};
    const invoke = kyrnBridge.catalog.invoke;
    installWebKyrnCatalog();
    expect(kyrnBridge.catalog.invoke).toBe(invoke);
  });

  it('reads the catalogs the backend already holds, without registering anything', async () => {
    httpRequest.mockImplementation(async (_method: string, path: string) => {
      if (path === '/api/agents/management') {
        return [
          { id: 'other-agent', name: 'Other', enabled: true },
          { id: 'agent-1', name: 'spec.jev', enabled: true },
        ];
      }
      if (path === '/api/assistants') return assistants;
      throw new Error(`unexpected path ${path}`);
    });

    installWebKyrnCatalog();
    await expect(kyrnBridge.catalog.invoke()).resolves.toEqual({
      ok: true,
      data: { agentId: 'agent-1', assistants },
    });
    expect(httpRequest).toHaveBeenCalledWith('GET', '/api/agents/management');
    expect(httpRequest).toHaveBeenCalledWith('GET', '/api/assistants');
    expect(httpRequest).toHaveBeenCalledTimes(2);
  });
});
