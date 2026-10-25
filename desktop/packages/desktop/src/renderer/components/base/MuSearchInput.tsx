/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { SearchInput } from '@/renderer/ui/search-input';
import type { CSSProperties, InputHTMLAttributes, Ref } from 'react';
import React, { forwardRef } from 'react';

/** A standing search field. Kept as a compatibility export for existing callers. */
export type MuSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  onClear?: () => void;
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

const MuSearchInput = forwardRef<HTMLInputElement, MuSearchInputProps>((props, ref) => (
  <SearchInput
    ref={ref as Ref<HTMLInputElement>}
    variant='bar'
    value={props.value}
    onChange={props.onChange}
    placeholder={props.placeholder}
    allowClear={props.allowClear}
    onClear={props.onClear}
    className={props.className}
    style={props.style}
    autoFocus={props.autoFocus}
    disabled={props.disabled}
    data-testid={props['data-testid']}
    wrapTestId={props.wrapTestId}
    inputProps={props.inputProps}
  />
));

MuSearchInput.displayName = 'MuSearchInput';

export default MuSearchInput;
