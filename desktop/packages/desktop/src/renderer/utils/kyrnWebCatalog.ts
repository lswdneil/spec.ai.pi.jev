import { httpRequest } from '@/common/adapter/httpBridge';
import { kyrnBridge } from '@/common/kyrn/bridge';
import type { KyrnResult } from '@/common/kyrn/errors';
import type { KyrnCatalog } from '@/common/kyrn/types';
import type { Assistant } from '@/common/types/agent/assistantTypes';

type AgentRow = {
  id: string;
  name?: string;
  enabled?: boolean;
};

let pending: Promise<KyrnResult<KyrnCatalog>> | undefined;

/**
 * The WebUI has no Electron main process, so the catalog provider is not
 * registered there. Read the same catalog the desktop main process reads:
 * the agent registration and the assistants the backend already holds.
 *
 * This is deliberately read-only: the desktop's initializeKyrn also registers
 * spec.jev and switches the other runtimes off. A browser must not mutate the
 * machine's agent registrations while someone merely opens a phone view.
 */
async function readCatalog(): Promise<KyrnResult<KyrnCatalog>> {
  try {
    const [agents, assistants] = await Promise.all([
      httpRequest<AgentRow[]>('GET', '/api/agents/management'),
      httpRequest<Assistant[]>('GET', '/api/assistants'),
    ]);
    const agent = agents.find((row) => row.name === 'spec.jev') ?? agents.find((row) => row.enabled) ?? agents[0];
    return {
      ok: true,
      data: {
        agentId: agent?.id ?? '',
        assistants,
      },
    };
  } catch (error) {
    return {
      ok: false,
      code: 'backend',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Install the read-only catalog provider only in a browser, never in Electron. */
export function installWebKyrnCatalog(): void {
  if (typeof window === 'undefined' || window.electronAPI) return;
  kyrnBridge.catalog.invoke = async () => {
    pending ??= readCatalog();
    return pending;
  };
}
