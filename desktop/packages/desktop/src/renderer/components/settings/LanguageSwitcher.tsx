import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '@/renderer/services/i18n';
import MuSelect from '@/renderer/components/base/MuSelect';
import { languageListOrder, nativeLanguageName } from './languageOrder';

const LanguageSwitcher: React.FC = () => {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = useCallback((value: string) => {
    const applyLanguage = () => {
      changeLanguage(value).catch((error: Error) => {
        console.error('Failed to change language:', error);
      });
    };

    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      // Defer to the next frame so the menu's closing animation finishes first.
      window.requestAnimationFrame(() => window.requestAnimationFrame(applyLanguage));
    } else {
      setTimeout(applyLanguage, 0);
    }
  }, []);

  return (
    <div className='flex items-center gap-8px'>
      <MuSelect
        className='w-160px'
        value={i18n.language}
        onChange={handleLanguageChange}
        aria-label={t('settings.language')}
        options={languageListOrder(i18n.language).map((language) => ({
          value: language,
          label: nativeLanguageName(language),
        }))}
      />
    </div>
  );
};

export default LanguageSwitcher;
