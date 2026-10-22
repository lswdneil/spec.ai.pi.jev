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

type MessageConfig = {
  content?: React.ReactNode;
  title?: React.ReactNode;
  duration?: number;
  [key: string]: unknown;
};

/**
 * Arco accepts either a node or a config object. The facade does the same; a config's
 * `title` (a Notification) is kept above its content.
 */
const messageOf = (value: unknown): { content: React.ReactNode; duration?: number } => {
  if (value !== null && typeof value === 'object' && 'content' in value) {
    const config = value as MessageConfig;
    const title = config.title;
    return {
      content: title ? (
        <div className='flex flex-col gap-0.5'>
          <strong className='font-medium'>{title}</strong>
          <div>{config.content}</div>
        </div>
      ) : (
        config.content
      ),
      duration: config.duration,
    };
  }
  return { content: value as React.ReactNode };
};

const notify =
  (kind: 'success' | 'error' | 'info' | 'warning' | 'loading') =>
  (value: unknown, fallbackDuration?: number) => {
    const { content, duration } = messageOf(value);
    const id = toast[kind](content, duration ?? fallbackDuration);
    return () => toast.dismiss(id);
  };

/** Arco's `Message` shape, for the codemod. */
const messageApi = {
  success: notify('success'),
  error: notify('error'),
  info: notify('info'),
  warning: notify('warning'),
  loading: notify('loading'),
  clear: () => toast.dismiss(),
};

export const Message = {
  ...messageApi,
  /** Arco's hook; the toaster is mounted once at the app root, so there is no holder to render. */
  useMessage: (_config?: { maxCount?: number }): [typeof messageApi, React.ReactNode] => [messageApi, null],
};

/** Arco's `Notification` shape; it shares the same surface and adds a title above the content. */
export const Notification = {
  ...messageApi,
  /** A notice that can keep its own action buttons; returns the id `remove` dismisses. */
  open: (config: MessageConfig) => {
    const { content } = messageOf(config);
    return toast.info(
      <div className='flex flex-col gap-1'>
        {config.title ? <strong className='font-medium'>{config.title}</strong> : null}
        <div>{content}</div>
        {config.btn ? <div>{config.btn as React.ReactNode}</div> : null}
      </div>,
      config.duration ?? 4500
    );
  },
  remove: (id?: string | number) => toast.dismiss(id),
};

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
