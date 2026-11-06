import React from 'react';
import { useTranslation } from 'react-i18next';
import AccountPanel from '@renderer/components/account/AccountPanel';
import { SettingsPage } from '../components/SettingsPageHeader';

/** The cloud account, its linked identities and the ways to secure it. */
const AccountSettings: React.FC = () => {
  const { t } = useTranslation();
  return (
    <SettingsPage title={t('login.account.title')} description={t('login.account.description')}>
      <AccountPanel />
    </SettingsPage>
  );
};

export default AccountSettings;
