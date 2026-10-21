/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import useSWR from 'swr';
import { kyrnBridge, unwrap } from '@/common/kyrn/bridge';
import type { ModelThinkingLevels } from '@/common/kyrn/models';

const NONE: ModelThinkingLevels = {};

/**
 * The thinking levels each model of the conversation's session takes, as spec.jev last recorded them. `revision` changes
 * when the session's model list or current model does, which is when spec.jev records them again. Empty for an agent
 * other than spec.jev, and while nothing was recorded: the picker then offers those models without their levels.
 */
export function useModelLevels(conversationId: string, enabled: boolean, revision: string): ModelThinkingLevels {
  const { data } = useSWR(
    enabled && conversationId ? (['kyrn-model-levels', conversationId, revision] as const) : null,
    async ([, id]) => unwrap(await kyrnBridge.modelLevels.invoke({ conversationId: id })),
    { keepPreviousData: true, revalidateOnFocus: false, shouldRetryOnError: false }
  );
  return data ?? NONE;
}
