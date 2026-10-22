import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as React from 'react';
import { cn } from './cn';

export type PopoverPosition =
  | 'top'
  | 'tl'
  | 'tr'
  | 'bottom'
  | 'bl'
  | 'br'
  | 'left'
  | 'lt'
  | 'lb'
  | 'right'
  | 'rt'
  | 'rb';

export interface PopoverProps {
  content?: React.ReactNode;
  children: React.ReactNode;
  position?: PopoverPosition;
  trigger?: 'click' | 'hover' | 'focus';
  popupVisible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  unmountOnExit?: boolean;
  className?: string;
}

const sideFor = (position: PopoverPosition): 'top' | 'bottom' | 'left' | 'right' => {
  if (position === 'tl' || position === 'tr') return 'top';
  if (position === 'bl' || position === 'br') return 'bottom';
  if (position === 'lt' || position === 'lb') return 'left';
  if (position === 'rt' || position === 'rb') return 'right';
  return position;
};

/** Arco's `content` / `position` / `trigger` shape over Radix Popover. */
export const Popover: React.FC<PopoverProps> = ({
  content,
  children,
  position = 'bottom',
  trigger = 'click',
  popupVisible,
  onVisibleChange,
  className,
}) => {
  const [hoverOpen, setHoverOpen] = React.useState(false);
  const hover = trigger === 'hover';
  const child = React.isValidElement(children) ? children : <span>{children}</span>;
  const triggerNode = hover
    ? React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
        onMouseEnter: (event: React.MouseEvent) => {
          (child.props as { onMouseEnter?: (event: React.MouseEvent) => void }).onMouseEnter?.(event);
          setHoverOpen(true);
        },
        onMouseLeave: (event: React.MouseEvent) => {
          (child.props as { onMouseLeave?: (event: React.MouseEvent) => void }).onMouseLeave?.(event);
          setHoverOpen(false);
        },
      })
    : child;
  return (
    <PopoverPrimitive.Root
      open={popupVisible ?? (hover ? hoverOpen : undefined)}
      onOpenChange={(next) => {
        if (hover) setHoverOpen(next);
        onVisibleChange?.(next);
      }}
    >
      <PopoverPrimitive.Trigger asChild>{triggerNode}</PopoverPrimitive.Trigger>
      {content ? (
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            side={sideFor(position)}
            sideOffset={8}
            className={cn(
              'z-[70] max-w-[min(360px,calc(100vw-24px))] rounded-[var(--sv-r-popup)] border border-sv-line bg-sv-popover p-3 text-[12px] text-sv-text outline-none',
              className
            )}
          >
            {content}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      ) : null}
    </PopoverPrimitive.Root>
  );
};
