import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as React from 'react';
import { cn } from './cn';

export interface TooltipProps {
  content?: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  disabled?: boolean;
  className?: string;
}

/** Tooltip with Arco's `content` / `position` shape. */
export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top', disabled, className }) => {
  if (!content || disabled) return <>{children}</>;
  return (
    <TooltipPrimitive.Provider delayDuration={250} skipDelayDuration={100}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={position}
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
