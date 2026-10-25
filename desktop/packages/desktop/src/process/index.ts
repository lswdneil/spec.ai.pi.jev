/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import '@/common/platform/register-electron';
// configureChromium sets app name (dev isolation) and Chromium flags — must run before other modules
import '@process/utils/configureChromium';

import { app } from 'electron';

// Force node-gyp-build to skip build/ directory and use prebuilds/ only in production
// This prevents loading wrong architecture binaries from development environment
// Only apply in packaged app to allow development builds to use build/Release/
if (app.isPackaged) {
  process.env.PREBUILDS_ONLY = '1';
}
import initStorage from './utils/initStorage';
import './utils/initBridge';
import './services/i18n'; // Initialize i18n for main process

// spec.jev's launcher owns the agent folder. AionCore starts the registered adapter from the app's environment, so put
// the same choice into pi's own variable here as well; otherwise pi falls back to ~/.spec.jev/agent beside the real home
// instead of the folder the app was given (profiles, tests, and a moved agent directory).
if (process.env.SPECJEV_AGENT_DIR) {
  process.env.SPECJEV_CODING_AGENT_DIR ??= process.env.SPECJEV_AGENT_DIR;
  // pi derives this name from package.json's piConfig.name, which is "spec.jev", dot included.
  process.env['SPEC.JEV_CODING_AGENT_DIR'] ??= process.env.SPECJEV_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR ??= process.env.SPECJEV_AGENT_DIR;
}

export const initializeProcess = async () => {
  const t0 = performance.now();
  const mark = (label: string) => console.log(`[mu:process] ${label} +${Math.round(performance.now() - t0)}ms`);

  await initStorage();
  mark('initStorage');
};
