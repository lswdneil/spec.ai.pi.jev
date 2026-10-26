import { ArrowUp, Check, Paperclip } from 'lucide-react';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { SettingsPage } from '../components/SettingsPageHeader';
import { DARK_THEME_ID, LIGHT_THEME_ID, SYSTEM_THEME_ID } from '@/common/theme/constants';
import { useThemeContext } from '@renderer/hooks/context/ThemeContext';
import { cn } from '@renderer/ui/cn';
import styles from './AppearanceV2.module.css';

type Mode = 'dark' | 'light' | 'auto';

function Mini({ mode }: { mode: Mode }) {
  return (
    <div
      className={cn(
        styles.mini,
        mode === 'dark' ? styles.miniDark : mode === 'light' ? styles.miniLight : styles.miniAuto
      )}
      aria-hidden='true'
    >
      <div className={styles.miniSide}>
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className={styles.miniMain}>
        <div className={cn(styles.miniBar, styles.miniBarShort)} />
        <div className={styles.miniBar} />
        <div className={styles.miniBubble} />
        <div className={styles.miniComposer}>
          <span className={styles.miniSend} />
        </div>
      </div>
    </div>
  );
}

const ThemeCard: React.FC<{
  mode: Mode;
  title: string;
  description: string;
  active: boolean;
  onSelect: () => void;
}> = ({ mode, title, description, active, onSelect }) => (
  <button
    type='button'
    aria-pressed={active}
    onClick={onSelect}
    className={cn(
      'flex flex-col gap-2 rounded-[var(--sv-r-control)] border bg-sv-surface p-2 text-left outline-none transition-colors',
      active ? 'border-sv-brand' : 'border-sv-line hover:border-sv-line-strong',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sv-focus'
    )}
  >
    <Mini mode={mode} />
    <span className='flex items-start gap-2 px-0.5 pb-0.5'>
      <span className='min-w-0 flex-1'>
        <span className='block text-[12.5px] font-medium text-sv-text'>{title}</span>
        <span className='mt-0.5 block text-[10.5px] leading-[1.4] text-sv-faint'>{description}</span>
      </span>
      <Check className={cn('sv-icon-sm mt-0.5 text-sv-brand-ink', active ? 'opacity-100' : 'opacity-0')} />
    </span>
  </button>
);

/**
 * The Phase 1 Appearance page, behind `specjev.ui.v2`.
 * Three modes only. The palette is fixed; there is no accent picker.
 */
const AppearanceV2: React.FC = () => {
  const { t } = useTranslation();
  const { activeId, selectTheme, theme } = useThemeContext();

  const active: Mode | null =
    activeId === DARK_THEME_ID
      ? 'dark'
      : activeId === LIGHT_THEME_ID
        ? 'light'
        : activeId === SYSTEM_THEME_ID
          ? 'auto'
          : null;

  const select = (mode: Mode) => {
    void selectTheme(mode === 'dark' ? DARK_THEME_ID : mode === 'light' ? LIGHT_THEME_ID : SYSTEM_THEME_ID);
  };

  const modeLabel = t(theme === 'dark' ? 'settings.darkMode' : 'settings.lightMode');

  return (
    <SettingsPage title={t('settings.appearancePanel')} description={t('settings.appearanceDescription')}>
      <div className='flex flex-col gap-6' data-testid='appearance-v2'>
        <section aria-labelledby='appearance-theme'>
          <h2 id='appearance-theme' className='text-[13px] font-medium'>
            {t('settings.theme')}
          </h2>
          <p className='mt-1 text-[12px] text-sv-muted'>{t('settings.appearanceThemeHint')}</p>
          <div className='mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3'>
            <ThemeCard
              mode='dark'
              title={t('settings.darkMode')}
              description={t('settings.appearanceDarkDesc')}
              active={active === 'dark'}
              onSelect={() => select('dark')}
            />
            <ThemeCard
              mode='light'
              title={t('settings.lightMode')}
              description={t('settings.appearanceLightDesc')}
              active={active === 'light'}
              onSelect={() => select('light')}
            />
            <ThemeCard
              mode='auto'
              title={t('settings.cssTheme.followSystem')}
              description={t('settings.appearanceAutoDesc', { mode: modeLabel })}
              active={active === 'auto'}
              onSelect={() => select('auto')}
            />
          </div>
        </section>

        <section className='overflow-hidden rounded-[var(--sv-r-control)] border border-sv-line bg-sv-surface'>
          <div className='flex items-center gap-2 border-b border-sv-line px-3 py-2.5'>
            <h2 className='text-[12px] font-medium'>{t('settings.appearancePreview')}</h2>
            <span className='ml-auto font-mono text-[10px] text-sv-faint'>{t('settings.appearancePreviewLive')}</span>
          </div>
          <div className='flex flex-col gap-2.5 p-4'>
            <div className='self-end max-w-[70%] rounded-[12px_12px_4px_12px] border border-sv-line bg-sv-surface-2 px-3 py-2 text-[12px] leading-[1.65]'>
              {t('settings.appearancePreviewQuestion')}
            </div>
            <div className='flex items-start gap-2 text-[12px] leading-[1.65] text-sv-muted'>
              <span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-sv-line bg-sv-surface text-[9px] font-bold text-sv-brand-ink'>
                J
              </span>
              {t('settings.appearancePreviewAnswer')}
            </div>
            <div className='mt-1 flex items-center gap-2 rounded-[var(--sv-r-composer)] border border-sv-line bg-sv-bg px-3 py-2 text-[12px] text-sv-placeholder'>
              <Paperclip className='sv-icon-sm' />
              <span className='flex-1'>{t('settings.appearancePreviewPlaceholder')}</span>
              <span className='flex h-6 w-6 items-center justify-center rounded-full bg-sv-brand text-sv-on-brand'>
                <ArrowUp className='sv-icon-sm' />
              </span>
            </div>
          </div>
        </section>

        <div className='flex items-center gap-4'>
          <p className='text-[10.5px] text-sv-faint'>{t('settings.appearanceFixedPalette')}</p>
          <Link
            to='/design-system'
            className='ml-auto shrink-0 border-b border-sv-line-strong pb-px text-[10.5px] text-sv-muted hover:text-sv-text'
          >
            Component gallery
          </Link>
        </div>
      </div>
    </SettingsPage>
  );
};

export default AppearanceV2;
