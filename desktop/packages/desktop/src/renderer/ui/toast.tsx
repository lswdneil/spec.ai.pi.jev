import * as React from 'react';
import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';
import { useThemeContext } from '@renderer/hooks/context/ThemeContext';

export const toast = {
  success: (content: React.ReactNode, duration = 3000) => sonnerToast.success(content, { duration }),
  error: (content: React.ReactNode, duration = 5000) => sonnerToast.error(content, { duration }),
  info: (content: React.ReactNode, duration = 3000) => sonnerToast.info(content, { duration }),
  warning: (content: React.ReactNode, duration = 4000) => sonnerToast.warning(content, { duration }),
  loading: (content: React.ReactNode) => sonnerToast.loading(content),
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
  promise: sonnerToast.promise,
};

/** Arco's `Message` shape, for the codemod. */
export const Message = {
  success: (content: React.ReactNode, duration?: number) => toast.success(content, duration),
  error: (content: React.ReactNode, duration?: number) => toast.error(content, duration),
  info: (content: React.ReactNode, duration?: number) => toast.info(content, duration),
  warning: (content: React.ReactNode, duration?: number) => toast.warning(content, duration),
  loading: (content: React.ReactNode) => toast.loading(content),
  clear: () => toast.dismiss(),
};

/** Arco's `Notification` shape. Same surface today; it can diverge later. */
export const Notification = Message;

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
          toast:
            'border border-sv-line bg-sv-popover text-sv-text rounded-[var(--sv-r-control)] text-[12px]',
          description: 'text-sv-muted',
          actionButton: 'bg-sv-brand text-sv-on-brand',
          cancelButton: 'bg-sv-surface text-sv-muted',
        },
      }}
    />
  );
};
