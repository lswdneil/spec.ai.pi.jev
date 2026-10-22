import { Button } from '@/renderer/ui/button';
import { Dropdown, MenuItem } from '@/renderer/ui/dropdown';
import { ChevronDown } from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '@/renderer/services/i18n';
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
      <Dropdown
        align='end'
        droplist={
          <>
            {languageListOrder(i18n.language).map((language) => (
              <MenuItem key={language} onClick={() => handleLanguageChange(language)}>
                {nativeLanguageName(language)}
              </MenuItem>
            ))}
          </>
        }
      >
        <Button
          variant='secondary'
          size='sm'
          className='w-160px justify-between'
          aria-label={t('settings.language')}
        >
          {nativeLanguageName(i18n.language)}
          <ChevronDown className='h-3.5 w-3.5 text-sv-faint' strokeWidth={1.75} />
        </Button>
      </Dropdown>
    </div>
  );
};

export default LanguageSwitcher;
