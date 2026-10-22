import * as React from 'react';
import { Popover, type PopoverPosition } from './popover';

export interface TriggerProps {
  popup?: React.ReactNode | (() => React.ReactNode);
  trigger?: 'hover' | 'click' | 'focus' | 'contextMenu';
  position?: PopoverPosition;
  popupVisible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  mouseEnterDelay?: number;
  mouseLeaveDelay?: number;
  clickToClose?: boolean;
  popupAlign?: unknown;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Arco's `Trigger` shape over the Dense Popover. */
export const Trigger: React.FC<TriggerProps> = ({
  popup,
  trigger = 'hover',
  position = 'bottom',
  popupVisible,
  onVisibleChange,
  disabled,
  className,
  children,
}) => {
  const content = typeof popup === 'function' ? popup() : popup;
  if (disabled || !content) return <>{children}</>;
  return (
    <Popover
      content={<div className={className}>{content}</div>}
      position={position}
      trigger={trigger === 'hover' ? 'hover' : 'click'}
      popupVisible={popupVisible}
      onVisibleChange={onVisibleChange}
    >
      {children}
    </Popover>
  );
};
