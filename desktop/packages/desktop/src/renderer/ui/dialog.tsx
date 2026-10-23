import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from './button';
import { cn } from './cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(function DialogContent({ className, children, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className='fixed inset-0 z-50 bg-[var(--sv-scrim)]' />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[min(92vw,var(--sv-modal-width,520px))] -translate-x-1/2 -translate-y-1/2 rounded-[var(--sv-r-dialog)] border border-sv-line bg-sv-popover p-5 text-sv-text outline-none',
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return <DialogPrimitive.Title ref={ref} className={cn('text-[15px] font-semibold', className)} {...props} />;
});

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return <DialogPrimitive.Description ref={ref} className={cn('mt-1 text-[12px] text-sv-muted', className)} {...props} />;
});

export interface ModalProps {
  visible?: boolean;
  open?: boolean;
  onCancel?: () => void;
  onOk?: () => void;
  onOpenChange?: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  width?: number;
  maskClosable?: boolean;
  className?: string;
  style?: React.CSSProperties;
  okText?: React.ReactNode;
  cancelText?: React.ReactNode;
  confirmLoading?: boolean;
  okButtonProps?: { disabled?: boolean; status?: 'normal' | 'success' | 'warning' | 'danger'; style?: React.CSSProperties; loading?: boolean };
  cancelButtonProps?: { disabled?: boolean; style?: React.CSSProperties; className?: string };
  /** Arco compatibility; the Dense dialog is always centred. */
  alignCenter?: boolean;
  closable?: boolean;
  getPopupContainer?: (node: HTMLElement) => HTMLElement;
  wrapClassName?: string;
  wrapStyle?: React.CSSProperties;
  maskStyle?: React.CSSProperties;
  afterClose?: () => void;
  escToExit?: boolean;
  unmountOnExit?: boolean;
  autoFocus?: boolean;
  focusLock?: boolean;
  'data-testid'?: string;
}

/** Arco-shaped modal: `visible`, `onCancel`, `onOk`, `footer`, `width`. */
const ModalBase: React.FC<ModalProps> = ({
  visible,
  open,
  onCancel,
  onOk,
  onOpenChange,
  title,
  description,
  footer,
  children,
  width = 520,
  maskClosable = true,
  className,
  style,
  okText,
  cancelText,
  confirmLoading = false,
  okButtonProps,
  cancelButtonProps,
  closable = true,
  afterClose,
  escToExit = true,
  'data-testid': testId,
}) => {
  const isOpen = visible ?? open ?? false;
  const wasOpen = React.useRef(isOpen);
  React.useEffect(() => {
    if (wasOpen.current && !isOpen) afterClose?.();
    wasOpen.current = isOpen;
  }, [afterClose, isOpen]);
  const defaultFooter =
    footer === undefined && (onOk || okText !== undefined || cancelText !== undefined) ? (
      <>
        <Button onClick={onCancel} disabled={cancelButtonProps?.disabled}>
          {cancelText ?? 'Cancel'}
        </Button>
        <Button
          type='primary'
          status={okButtonProps?.status}
          loading={confirmLoading}
          disabled={okButtonProps?.disabled}
          onClick={() => onOk?.()}
        >
          {okText ?? 'OK'}
        </Button>
      </>
    ) : (
      footer
    );
  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(next) => {
        onOpenChange?.(next);
        if (!next) onCancel?.();
      }}
    >
      <DialogContent
        style={{ '--sv-modal-width': `${width}px`, ...style } as React.CSSProperties}
        onInteractOutside={(event) => {
          if (!maskClosable) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (!escToExit) event.preventDefault();
        }}
        className={className}
        data-testid={testId}
      >
        <div className='flex items-start gap-4'>
          <div className='min-w-0 flex-1'>
            {title ? <DialogTitle>{title}</DialogTitle> : null}
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </div>
          {closable ? (
            <DialogPrimitive.Close
              aria-label='Close'
              className='-mr-1 -mt-1 rounded-[8px] bg-transparent p-1 text-sv-faint outline-none hover:bg-sv-surface hover:text-sv-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-sv-focus'
            >
              <X className='sv-icon-md' />
            </DialogPrimitive.Close>
          ) : null}
        </div>
        {children ? <div className='mt-4 text-[13px] leading-[1.65] text-sv-muted'>{children}</div> : null}
        {defaultFooter ? <div className='mt-5 flex items-center justify-end gap-2'>{defaultFooter}</div> : null}
      </DialogContent>
    </DialogPrimitive.Root>
  );
};

export interface ModalConfirmConfig {
  title?: React.ReactNode;
  content?: React.ReactNode | (() => React.ReactNode);
  icon?: React.ReactNode;
  okText?: React.ReactNode;
  cancelText?: React.ReactNode;
  okButtonProps?: { disabled?: boolean; status?: 'normal' | 'success' | 'warning' | 'danger'; style?: React.CSSProperties; loading?: boolean };
  cancelButtonProps?: { disabled?: boolean; style?: React.CSSProperties; className?: string };
  onOk?: () => void | boolean | Promise<unknown>;
  onCancel?: () => void;
  footer?: React.ReactNode;
  closable?: boolean;
  width?: number;
  className?: string;
  style?: React.CSSProperties;
  wrapClassName?: string;
  alignCenter?: boolean;
  getPopupContainer?: (node: HTMLElement) => HTMLElement;
  maskStyle?: React.CSSProperties;
  maskClosable?: boolean;
  mountOnEnter?: boolean;
  unmountOnExit?: boolean;
}

export interface ModalController {
  destroy: () => void;
}

type ConfirmKind = 'confirm' | 'info' | 'success' | 'warning' | 'error';

const ConfirmDialog: React.FC<{
  config: ModalConfirmConfig;
  kind: ConfirmKind;
  onClosed: () => void;
}> = ({ config, kind, onClosed }) => {
  const [open, setOpen] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const close = () => {
    setOpen(false);
    onClosed();
  };
  const cancel = () => {
    config.onCancel?.();
    close();
  };
  const content = typeof config.content === 'function' ? config.content() : config.content;
  const notice = kind !== 'confirm';
  if (!open) return null;
  return (
    <div
      className='fixed inset-0 z-[80] flex items-center justify-center bg-[var(--sv-scrim)] p-4'
      onClick={(event) => {
        if (event.target === event.currentTarget && config.maskClosable !== false) cancel();
      }}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-label={typeof config.title === 'string' ? config.title : undefined}
        style={{ width: config.width ?? 420, ...config.style }}
        className={`rounded-[var(--sv-r-dialog)] border border-sv-line bg-sv-popover p-5 text-sv-text ${config.className ?? ''}`}
      >
        <div className='flex items-start gap-3'>
          {config.icon ? <div className='shrink-0 text-sv-warn'>{config.icon}</div> : null}
          <div className='min-w-0 flex-1'>
            {config.title ? <h2 className='m-0 text-[15px] font-semibold'>{config.title}</h2> : null}
            {content ? <div className='mt-2 text-[13px] leading-[1.65] text-sv-muted'>{content}</div> : null}
          </div>
          {config.closable !== false ? (
            <button
              type='button'
              aria-label='Close'
              className='-mr-1 -mt-1 rounded-[8px] bg-transparent p-1 text-sv-faint outline-none hover:bg-sv-surface hover:text-sv-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-sv-focus'
              onClick={cancel}
            >
              <X className='sv-icon-md' />
            </button>
          ) : null}
        </div>
        {config.footer === undefined || notice ? (
          <div className='mt-5 flex items-center justify-end gap-2'>
            {!notice ? (
              <Button onClick={cancel} disabled={config.cancelButtonProps?.disabled}>
                {config.cancelText ?? 'Cancel'}
              </Button>
            ) : null}
            <Button
              type='primary'
              status={config.okButtonProps?.status}
              disabled={config.okButtonProps?.disabled}
              loading={loading}
              onClick={async () => {
                try {
                  setLoading(true);
                  const result = await config.onOk?.();
                  if (result === false) return;
                  close();
                } catch {
                  // Keep the dialog open so the caller can show the reason.
                } finally {
                  setLoading(false);
                }
              }}
            >
              {config.okText ?? 'OK'}
            </Button>
          </div>
        ) : (
          <div className='mt-5'>{config.footer}</div>
        )}
      </div>
    </div>
  );
};

const liveRoots = new Map<ReturnType<typeof createRoot>, HTMLElement>();

const openConfirm = (config: ModalConfirmConfig, kind: ConfirmKind): ModalController => {
  if (typeof document === 'undefined') return { destroy: () => undefined };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  liveRoots.set(root, host);
  const destroy = () => {
    liveRoots.delete(root);
    root.unmount();
    host.remove();
  };
  root.render(<ConfirmDialog config={config} kind={kind} onClosed={destroy} />);
  return { destroy };
};

const confirm = (config: ModalConfirmConfig) => openConfirm(config, 'confirm');
const info = (config: ModalConfirmConfig) => openConfirm({ ...config, closable: config.closable ?? false }, 'info');
const success = (config: ModalConfirmConfig) => openConfirm({ ...config, closable: config.closable ?? false }, 'success');
const warning = (config: ModalConfirmConfig) => openConfirm({ ...config, closable: config.closable ?? false }, 'warning');
const error = (config: ModalConfirmConfig) => openConfirm({ ...config, closable: config.closable ?? false }, 'error');
const destroyAll = () => {
  for (const [root, host] of liveRoots) {
    root.unmount();
    host.remove();
  }
  liveRoots.clear();
};

const modalApi = { confirm, info, success, warning, error, destroyAll };

type ModalComponent = typeof ModalBase & typeof modalApi & {
  useModal: (config?: { maxCount?: number }) => [typeof modalApi, React.ReactNode];
};

export const Modal = Object.assign(ModalBase, {
  ...modalApi,
  useModal: (_config?: { maxCount?: number }): [typeof modalApi, React.ReactNode] => [modalApi, null],
}) as ModalComponent;
