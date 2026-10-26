import * as React from 'react';
import { Toaster as SonnerToaster } from 'sonner';
import { useThemeContext } from '@renderer/hooks/context/ThemeContext';

/** Mount once inside the theme provider. */
export const AppToaster: React.FC = () => {
  const { theme } = useThemeContext();
  return (
    <SonnerToaster
      theme={theme}
      position='bottom-right'
      closeButton
      toastOptions={{
        classNames: {
          toast: 'border border-sv-line bg-sv-popover text-sv-text rounded-[var(--sv-r-control)] text-[12px]',
          description: 'text-sv-muted',
          actionButton: 'bg-sv-brand text-sv-on-brand',
          cancelButton: 'bg-sv-surface text-sv-muted',
        },
      }}
    />
  );
};
