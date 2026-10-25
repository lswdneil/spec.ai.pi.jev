/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { SearchInput } from '@/renderer/ui/search-input';
import type { CSSProperties, InputHTMLAttributes, Ref } from 'react';
import React, { forwardRef } from 'react';

/** A compact search field at the top of a dropdown. Kept as a compatibility export. */
export type MuInlineSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  autoFocus?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
  wrapTestId?: string;
  inputProps?: Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'placeholder' | 'disabled' | 'autoFocus' | 'className'
  >;
};

const MuInlineSearchInput = forwardRef<HTMLInputElement, MuInlineSearchInputProps>((props, ref) => (
  <SearchInput
    ref={ref as Ref<HTMLInputElement>}
    variant='inline'
    value={props.value}
    onChange={props.onChange}
    placeholder={props.placeholder}
    className={props.className}
    style={props.style}
    autoFocus={props.autoFocus}
    disabled={props.disabled}
    data-testid={props['data-testid']}
    wrapTestId={props.wrapTestId}
    inputProps={props.inputProps}
  />
));

MuInlineSearchInput.displayName = 'MuInlineSearchInput';

export default MuInlineSearchInput;
