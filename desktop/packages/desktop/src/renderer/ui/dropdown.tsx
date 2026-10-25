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
  position?: 'top' | 'bottom' | 'left' | 'right' | 'tl' | 'tr' | 'bl' | 'br';
  popupVisible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  getPopupContainer?: (node: HTMLElement) => HTMLElement;
  className?: string;
  /** Controlled open, for callers that keep the menu's state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  /** Keep the menu in the DOM while closed (tests and Arco-compatible markup). */
  renderClosed?: boolean;
  trigger?: 'click' | 'hover' | 'contextMenu' | ('click' | 'hover' | 'contextMenu')[];
  contentRef?: React.Ref<HTMLDivElement>;
  onContentKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  onContentKeyDownCapture?: React.KeyboardEventHandler<HTMLDivElement>;
}

export const Dropdown: React.FC<DropdownProps> = ({
  children,
  items,
  droplist,
  align,
  position,
  className,
  popupVisible,
  onVisibleChange,
  open,
  onOpenChange,
  contentRef,
  disabled,
  renderClosed,
  trigger = 'click',
  onContentKeyDown,
  onContentKeyDownCapture,
}) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = popupVisible ?? open ?? internalOpen;
  const pointerDownAt = React.useRef(0);
  const hoverOpenTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggers = Array.isArray(trigger) ? trigger : [trigger];
  const hover = triggers.includes('hover');
  const click = triggers.includes('click');
  const context = triggers.includes('contextMenu');
  const setOpen = (next: boolean) => {
    if (disabled) return;
    if (open === undefined && popupVisible === undefined) setInternalOpen(next);
    onOpenChange?.(next);
    onVisibleChange?.(next);
  };
  const clearHoverTimers = React.useCallback(() => {
    if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    hoverOpenTimer.current = null;
    hoverCloseTimer.current = null;
  }, []);

  React.useEffect(() => () => clearHoverTimers(), [clearHoverTimers]);

  if (disabled) return <>{children}</>;
  const openOnClick = (event: React.MouseEvent) => {
    if (!click) return;
    if (Date.now() - pointerDownAt.current < 500) return;
    setOpen(!isOpen);
  };
  const openOnKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setOpen(true);
  };
  const openOnContextMenu = (event: React.MouseEvent) => {
    if (!context) return;
    event.preventDefault();
    setOpen(!isOpen);
  };
  const scheduleHoverOpen = () => {
    if (!hover) return;
    if (hoverCloseTimer.current) {
      clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
    if (isOpen || hoverOpenTimer.current) return;
    hoverOpenTimer.current = setTimeout(() => {
      hoverOpenTimer.current = null;
      setOpen(true);
    }, 80);
  };

  const scheduleHoverClose = () => {
    if (!hover) return;
    if (hoverOpenTimer.current) {
      clearTimeout(hoverOpenTimer.current);
      hoverOpenTimer.current = null;
    }
    if (!isOpen || hoverCloseTimer.current) return;
    hoverCloseTimer.current = setTimeout(() => {
      hoverCloseTimer.current = null;
      setOpen(false);
    }, 180);
  };

  const triggerNode =
    React.isValidElement(children) && typeof children.type === 'string' ? (
      React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        onPointerDown: (event: React.PointerEvent) => {
          pointerDownAt.current = Date.now();
          // A context-menu-only dropdown must not open on a left click. Radix's trigger opens on pointerdown;
          // cancelling that event keeps the tree row's own click (select, expand) intact.
          if (context && !click) event.preventDefault();
        },
        onMouseEnter: scheduleHoverOpen,
        onMouseLeave: scheduleHoverClose,
        onClick: (event: React.MouseEvent) => {
          (children.props as { onClick?: (event: React.MouseEvent) => void }).onClick?.(event);
          if (!event.defaultPrevented) openOnClick(event);
        },
        onKeyDown: (event: React.KeyboardEvent) => {
          (children.props as { onKeyDown?: (event: React.KeyboardEvent) => void }).onKeyDown?.(event);
          if (!event.defaultPrevented) openOnKeyDown(event);
        },
        onContextMenu: (event: React.MouseEvent) => {
          (children.props as { onContextMenu?: (event: React.MouseEvent) => void }).onContextMenu?.(event);
          if (!event.defaultPrevented) openOnContextMenu(event);
        },
      })
    ) : (
      <span
        className='inline-flex'
        onPointerDown={(event) => {
          pointerDownAt.current = Date.now();
          if (context && !click) event.preventDefault();
        }}
        onMouseEnter={scheduleHoverOpen}
        onMouseLeave={scheduleHoverClose}
        onClick={openOnClick}
        onKeyDown={openOnKeyDown}
        onContextMenu={openOnContextMenu}
      >
        {children}
      </span>
    );
  return (
    <DropdownMenuPrimitive.Root open={isOpen} onOpenChange={setOpen}>
      <DropdownMenuPrimitive.Trigger asChild>{triggerNode}</DropdownMenuPrimitive.Trigger>
      {!isOpen && renderClosed && droplist ? (
        <div
          data-dropdown-closed=''
          style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}
        >
          {droplist}
        </div>
      ) : null}
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={contentRef}
          data-testid='dropdown-content'
          onMouseEnter={() => {
            if (!hover) return;
            if (hoverCloseTimer.current) {
              clearTimeout(hoverCloseTimer.current);
              hoverCloseTimer.current = null;
            }
          }}
          onMouseLeave={scheduleHoverClose}
          onKeyDown={onContentKeyDown}
          onKeyDownCapture={onContentKeyDownCapture}
          align={align ?? (position === 'br' || position === 'tr' ? 'end' : 'start')}
          side={position === 'tl' || position === 'tr' || position === 'top' ? 'top' : 'bottom'}
          sideOffset={6}
          collisionPadding={40}
          style={{ zIndex: 1000 }}
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
                'flex h-7 cursor-default select-none items-center gap-2 bg-transparent rounded-[6px] px-2 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
                item.danger ? 'text-sv-danger' : 'text-sv-text',
                'data-[highlighted]:bg-sv-surface'
              )}
            >
              <span className='flex-1'>{item.label}</span>
              {item.checked ? <Check className='sv-icon-sm text-sv-brand-ink' /> : null}
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
    className='flex h-7 cursor-default select-none items-center rounded-[6px] bg-transparent px-2 text-sv-text outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-sv-surface'
    {...props}
  >
    {children}
  </DropdownMenuPrimitive.Item>
);
