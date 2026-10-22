import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as React from 'react';
import { cn } from './cn';

export type TooltipPosition =
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

export interface TooltipProps {
  content?: React.ReactNode;
  children: React.ReactNode;
  position?: TooltipPosition;
  disabled?: boolean;
  className?: string;
  /** Arco compatibility; ignored unless it forces the tooltip open or closed. */
  mini?: boolean;
  trigger?: 'hover' | 'click' | 'focus' | 'contextMenu';
  popupVisible?: boolean;
  unmountOnExit?: boolean;
  popupHoverStay?: boolean;
  getPopupContainer?: (node: HTMLElement) => Element;
}

const sideFor = (position: TooltipPosition): 'top' | 'bottom' | 'left' | 'right' => {
  if (position === 'tl' || position === 'tr') return 'top';
  if (position === 'bl' || position === 'br') return 'bottom';
  if (position === 'lt' || position === 'lb') return 'left';
  if (position === 'rt' || position === 'rb') return 'right';
  return position;
};

/** Tooltip with Arco's `content` / `position` shape. */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  disabled,
  className,
  popupVisible,
}) => {
  const [hovered, setHovered] = React.useState(false);
  if (!content || disabled || !React.isValidElement(children)) return <>{children}</>;
  const child = React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
    onMouseEnter: (event: React.MouseEvent) => {
      (children.props as { onMouseEnter?: (event: React.MouseEvent) => void }).onMouseEnter?.(event);
      setHovered(true);
    },
    onMouseLeave: (event: React.MouseEvent) => {
      (children.props as { onMouseLeave?: (event: React.MouseEvent) => void }).onMouseLeave?.(event);
      setHovered(false);
    },
  });
  return (
    <TooltipPrimitive.Provider delayDuration={250} skipDelayDuration={100}>
      <TooltipPrimitive.Root open={popupVisible ?? hovered}>
        <TooltipPrimitive.Trigger asChild>{child}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={sideFor(position)}
            sideOffset={6}
            className={cn(
              'z-[60] max-w-[280px] rounded-[8px] border border-sv-line bg-sv-popover px-2 py-1 text-[11px] leading-[1.45] text-sv-text',
              className
            )}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
};

export const TooltipProvider = TooltipPrimitive.Provider;
