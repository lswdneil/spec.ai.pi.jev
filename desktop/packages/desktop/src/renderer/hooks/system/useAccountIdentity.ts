/**
 * The account surface the sidebar shows.
 *
 * Today the desktop app runs in local identity mode: the backend attributes
 * every request to `system_default_user`, and there is no sign-in. Keep that
 * internal id out of the UI; expose a local workspace until a real account
 * session exists. A later auth provider can replace this hook without changing
 * the sidebar.
 */

import { useEffect, useState } from 'react';
import { ipcBridge } from '@/common';

export const LOCAL_USER_ID = 'system_default_user';

export type AccountIdentity =
  | { kind: 'local'; id: string }
  | { kind: 'remote'; id: string; displayName: string };

export function useAccountIdentity(): { identity: AccountIdentity | null } {
  const [identity, setIdentity] = useState<AccountIdentity | null>(null);

  useEffect(() => {
    let alive = true;
    void ipcBridge.auth?.currentUser
      ?.invoke?.()
      .then((user: { id: string; username: string }): void => {
        if (!alive || !user?.id) return;
        if (user.id === LOCAL_USER_ID) {
          setIdentity({ kind: 'local', id: user.id });
          return;
        }
        setIdentity({
          kind: 'remote',
          id: user.id,
          displayName: user.username?.trim() || user.id,
        });
      })
      .catch((): void => {
        // The footer is not the place to report an unavailable identity.
        // It falls back to the local workspace until the next mount.
        if (alive) setIdentity(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { identity };
}
