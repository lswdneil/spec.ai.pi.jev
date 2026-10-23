/**
 * What spec.jev may do without asking in this conversation (full access, Jev approves, minimal), as a pill at the left of
 * the send box, with the look of the permission pill in spec.jev's other conversations (AgentModeSelector, compact). The mode
 * in force is spec.jev's latest `permissions.mode` frame, else what the session file says, else spec.jev's default; a pick sends
 * spec.jev's own `/permissions <mode> --here`, which switches this conversation only (the mode new conversations start in is
 * set in the settings). It runs at once, during a run too: spec.jev checks the next call under the new mode.
 */
import { Dropdown } from '@/renderer/ui/dropdown';
import { Tooltip } from '@/renderer/ui/tooltip';
import { Down, Shield } from '@icon-park/react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NativeResult } from '@/common/kyrn/nativeBridge';
import type { PiCommand } from '@/common/utils/nativeHost';
import RuntimeSelectorPill from '@/renderer/components/agent/RuntimeSelectorPill';
import { useMuDefaultPermission } from '@/renderer/hooks/agent/useMuDefaultPermission';
import { iconColors } from '@/renderer/styles/colors';
import { permissionCommand, type PermissionState } from './composerModel';

const NativePermissionPill: React.FC<{
  state: PermissionState;
  /** A message is on its way to pi: the switch waits for it. */
  held: boolean;
  request: (command: PiCommand) => Promise<NativeResult<unknown>>;
}> = ({ state, held, request }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [switching, setSwitching] = useState(false);
  const { mode, modes } = state;
  // A conversation that has said no mode yet starts in spec.jev's default: the pill names it rather than "spec.jev's default".
  const fallback = useMuDefaultPermission();
  const shown = mode ?? fallback;
  const nameOf = (id: string, label?: string): string => t(`agentMode.${id}`, { defaultValue: label || id });
  const current = shown
    ? nameOf(shown, modes.find((each) => each.id === shown)?.label)
    : t('mu.native.new.defaultPermissions');

  const pick = async (next: string) => {
    setVisible(false);
    if (next === mode) return;
    setSwitching(true);
    try {
      await request({ type: 'prompt', message: permissionCommand(next) });
    } finally {
      setSwitching(false);
    }
  };

  const items = modes.map((each) => ({
    key: each.id,
    label: (
      <div className='flex items-center gap-2' data-testid='native-permission-option' data-mode={each.id}>
        <span aria-hidden='true' className='flex w-4 shrink-0 items-center text-t-primary'>
          {shown === each.id ? '✓' : ''}
        </span>
        <Tooltip
          content={t(`agentMode.descriptions.${each.id}`, { defaultValue: each.description || each.id })}
          position='right'
        >
          <span className='min-w-0 truncate'>{nameOf(each.id, each.label)}</span>
        </Tooltip>
      </div>
    ),
    onSelect: (): void => {
      void pick(each.id);
    },
  }));

  const disabled = held || switching;
  return (
    <Dropdown
      trigger='click'
      popupVisible={visible && !disabled}
      onVisibleChange={(open) => setVisible(open)}
      items={items}
    >
      <span data-testid='native-permission-pill' data-mode={mode ?? ''} className='inline-flex'>
        <RuntimeSelectorPill
          testId='native-permission'
          className='sendbox-model-btn agent-mode-compact-pill'
          label={`${t('agentMode.permission')} · ${current}`}
          leading={<Shield theme='outline' className='sv-icon-sm shrink-0' fill={iconColors.secondary} />}
          trailing={<Down className='sv-icon-xs text-t-tertiary shrink-0' />}
          loading={switching}
          disabled={disabled}
          onClick={() => setVisible((open) => !open)}
        />
      </span>
    </Dropdown>
  );
};

export default NativePermissionPill;
