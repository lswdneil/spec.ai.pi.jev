/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';

export interface LayoutContextValue {
  isMobile: boolean;
  /** The sidebar's width as it is on screen: the rail when folded, the drawer's full width on a phone. */
  siderWidth: number;
  siderCollapsed: boolean;
  setSiderCollapsed: (value: boolean) => void;
}

export const LayoutContext = React.createContext<LayoutContextValue | null>(null);

export function useLayoutContext(): LayoutContextValue | null {
  return React.useContext(LayoutContext);
}
