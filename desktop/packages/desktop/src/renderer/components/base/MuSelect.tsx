/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useImperativeHandle, useRef } from 'react';
import { Select, SelectOption, SelectOptGroup, type SelectProps } from '@/renderer/ui/select';
import { cn } from '@/renderer/ui/cn';

/**
 * The old AionUI name for the app's select. It stays as the one import the
 * settings pages use, now backed by the Dense Select rather than Arco.
 */
export type MuSelectHandle = {
  /** The trigger element, for callers that need to inspect or measure it. */
  readonly dom: HTMLButtonElement | null;
  focus: () => void;
  blur: () => void;
};

export interface MuSelectProps extends Omit<SelectProps, 'size'> {
  className?: string;
  /** "middle" is the old 32px size; Dense calls it "default". */
  size?: SelectProps['size'] | 'middle';
}

const InternalSelect = React.forwardRef<MuSelectHandle, MuSelectProps>(
  ({ className, size = 'middle', ...rest }, ref) => {
    const trigger = useRef<HTMLButtonElement>(null);
    useImperativeHandle(
      ref,
      () => ({
        get dom() {
          return trigger.current;
        },
        focus: () => trigger.current?.focus(),
        blur: () => trigger.current?.blur(),
      }),
      []
    );
    return (
      <Select
        ref={trigger}
        size={size === 'middle' ? 'default' : size}
        className={cn('mu-select', className)}
        {...rest}
      />
    );
  }
);

type MuSelectComponent = typeof InternalSelect & {
  Option: typeof SelectOption;
  OptGroup: typeof SelectOptGroup;
};

const MuSelect = InternalSelect as MuSelectComponent;

MuSelect.displayName = 'MuSelect';
MuSelect.Option = SelectOption;
MuSelect.OptGroup = SelectOptGroup;

export default MuSelect;
