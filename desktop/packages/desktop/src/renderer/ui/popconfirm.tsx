import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as React from 'react';
import { cn } from './cn';

export type PopconfirmPosition = 'top' | 'bottom' | 'left' | 'right' | 'tl' | 'tr' | 'bl' | 'br';

export interface PopconfirmProps {
  title?: React.ReactNode;
  content?: React.ReactNode;
  okText?: React.ReactNode;
  cancelText?: React.ReactNode;
  onOk?: () => void;
  onCancel?: () => void;
  position?: PopconfirmPosition;
  disabled?: boolean;
  className?: string;
  children: React.ReactElement;
}

const sideFor = (position: PopconfirmPosition): 'top' | 'bottom' | 'left' | 'right' => {
  if (position === 'tl' || position === 'tr') return 'top';
  if (position === 'bl' || position === 'br') return 'bottom';
  return position;
};

/** A small confirmation bubble over the trigger, in Arco's `Popconfirm` shape. */
export const Popconfirm: React.FC<PopconfirmProps> = ({
  title,
  content,
  okText = 'OK',
  cancelText = 'Cancel',
  onOk,
  onCancel,
  position = 'top',
  disabled,
  className,
  children,
}) => {
  const [open, setOpen] = React.useState(false);
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        {children}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={sideFor(position)}
          sideOffset={8}
          className={cn(
            'z-[70] w-[240px] rounded-[var(--sv-r-popup)] border border-sv-line bg-sv-popover p-3 text-[12px] text-sv-text outline-none',
            className
          )}
        >
          {title ? <div className='font-medium text-sv-text'>{title}</div> : null}
          {content ? <div className='mt-1 leading-[1.6] text-sv-muted'>{content}</div> : null}
          <div className='mt-3 flex justify-end gap-1.5'>
            <button
              type='button'
              className='h-7 rounded-[5px] border border-sv-line px-2.5 text-[12px] text-sv-muted outline-none hover:text-sv-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sv-focus'
              onClick={() => {
                setOpen(false);
                onCancel?.();
              }}
            >
              {cancelText}
            </button>
            <button
              type='button'
              className='h-7 rounded-[5px] border border-sv-brand bg-sv-brand px-2.5 text-[12px] font-medium text-sv-on-brand outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sv-focus'
              onClick={() => {
                setOpen(false);
                onOk?.();
              }}
            >
              {okText}
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};
