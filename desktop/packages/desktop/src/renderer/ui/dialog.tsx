import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';
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
  okButtonProps?: { disabled?: boolean; status?: 'normal' | 'success' | 'warning' | 'danger' };
  cancelButtonProps?: { disabled?: boolean };
  /** Arco compatibility; the Dense dialog is always centred. */
  alignCenter?: boolean;
  closable?: boolean;
  getPopupContainer?: (node: HTMLElement) => HTMLElement;
  wrapClassName?: string;
  wrapStyle?: React.CSSProperties;
  maskStyle?: React.CSSProperties;
  afterClose?: () => void;
  escToExit?: boolean;
  'data-testid'?: string;
}

/** Arco-shaped modal: `visible`, `onCancel`, `onOk`, `footer`, `width`. */
export const Modal: React.FC<ModalProps> = ({
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
              className='-mr-1 -mt-1 rounded-[8px] p-1 text-sv-faint outline-none hover:bg-sv-surface hover:text-sv-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-sv-focus'
            >
              <X className='h-4 w-4' />
            </DialogPrimitive.Close>
          ) : null}
        </div>
        {children ? <div className='mt-4 text-[13px] leading-[1.65] text-sv-muted'>{children}</div> : null}
        {defaultFooter ? <div className='mt-5 flex items-center justify-end gap-2'>{defaultFooter}</div> : null}
      </DialogContent>
    </DialogPrimitive.Root>
  );
};
