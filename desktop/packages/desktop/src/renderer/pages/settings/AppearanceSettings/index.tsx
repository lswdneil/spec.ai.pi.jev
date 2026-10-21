/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import AppearanceModalContent from '@/renderer/components/settings/SettingsModal/contents/AppearanceModalContent';
import { isUiV2Enabled } from '@renderer/utils/ui/uiV2';
import { SettingsPage } from '../components/SettingsPageHeader';
import AppearanceV2 from './AppearanceV2';

/** How spec.jev looks: the language, the theme, the type and the scale. */
const AppearanceSettings: React.FC = () => {
  const { t } = useTranslation();
  if (isUiV2Enabled()) return <AppearanceV2 />;
  return (
    <SettingsPage title={t('settings.appearancePanel')} description={t('settings.appearanceDescription')}>
      <AppearanceModalContent />
    </SettingsPage>
  );
};

export default AppearanceSettings;
