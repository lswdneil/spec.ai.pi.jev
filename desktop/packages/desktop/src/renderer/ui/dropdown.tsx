import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import * as React from 'react';
import { cn } from './cn';

export interface DropdownItem {
  key?: string;
  label?: React.ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  checked?: boolean;
  separator?: boolean;
  'data-testid'?: string;
  'data-tab'?: string;
}

export interface DropdownProps {
  children: React.ReactNode;
  items?: DropdownItem[];
  /** Arco compatibility: a Menu tree rendered inside the popup. */
  droplist?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
  /** Controlled open, for callers that keep the menu's state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  trigger?: 'click' | 'hover';
  contentRef?: React.Ref<HTMLDivElement>;
  onContentKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  onContentKeyDownCapture?: React.KeyboardEventHandler<HTMLDivElement>;
}

export const Dropdown: React.FC<DropdownProps> = ({
  children,
  items,
  droplist,
  align = 'start',
  className,
  open,
  onOpenChange,
  contentRef,
  disabled,
  trigger = 'click',
  onContentKeyDown,
  onContentKeyDownCapture,
}) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open ?? internalOpen;
  const pointerDownAt = React.useRef(0);
  const setOpen = (next: boolean) => {
    if (disabled) return;
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  if (disabled) return <>{children}</>;
  return (
    <DropdownMenuPrimitive.Root open={isOpen} onOpenChange={setOpen}>
      <DropdownMenuPrimitive.Trigger asChild>
        <span
          className='inline-flex'
          onPointerDown={() => {
            pointerDownAt.current = Date.now();
          }}
          onMouseEnter={() => {
            if (trigger === 'hover') setOpen(true);
          }}
          onMouseLeave={() => {
            if (trigger === 'hover') setOpen(false);
          }}
          onClick={() => {
            // Pointer-driven browsers already toggle on pointerdown; a bare
            // click (keyboard activation, tests) opens here.
            if (Date.now() - pointerDownAt.current < 500) return;
            setOpen(!isOpen);
          }}
        >
          {children}
        </span>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={contentRef}
          onKeyDown={onContentKeyDown}
          onKeyDownCapture={onContentKeyDownCapture}
          align={align}
          sideOffset={6}
          className={cn(
            'z-[60] min-w-[180px] rounded-[var(--sv-r-popup)] border border-sv-line bg-sv-popover p-1 text-[12px] text-sv-text outline-none',
            className
          )}
        >
        {droplist}
        {items?.map((item, index) =>
          item.separator ? (
            <DropdownMenuPrimitive.Separator key={item.key ?? `sep-${index}`} className='my-1 h-px bg-sv-line' />
          ) : (
            <DropdownMenuPrimitive.Item
              key={item.key ?? index}
              disabled={item.disabled}
              data-testid={item['data-testid']}
              data-tab={item['data-tab']}
              onSelect={item.onSelect}
              className={cn(
                'flex h-7 cursor-default select-none items-center gap-2 rounded-[6px] px-2 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
                item.danger ? 'text-sv-danger' : 'text-sv-text',
                'data-[highlighted]:bg-sv-surface'
              )}
            >
              <span className='flex-1'>{item.label}</span>
              {item.checked ? <Check className='h-3.5 w-3.5 text-sv-brand-ink' /> : null}
            </DropdownMenuPrimitive.Item>
          )
        )}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  </DropdownMenuPrimitive.Root>
  );
};

/** Arco compatibility aliases; put them inside `droplist`. */
export const Menu: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

export const MenuItem: React.FC<
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { onClick?: () => void }
> = ({ children, onClick, ...props }) => (
  <DropdownMenuPrimitive.Item
    onClick={() => onClick?.()}
    className='flex h-7 cursor-default select-none items-center rounded-[6px] px-2 text-sv-text outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-sv-surface'
    {...props}
  >
    {children}
  </DropdownMenuPrimitive.Item>
);
