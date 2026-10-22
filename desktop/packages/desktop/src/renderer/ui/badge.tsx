import * as React from 'react';
import { cn } from './cn';

export type BadgeStatus = 'default' | 'success' | 'error' | 'processing' | 'warning';

export interface BadgeProps {
  status?: BadgeStatus;
  text?: React.ReactNode;
  className?: string;
}

const dot: Record<BadgeStatus, string> = {
  default: 'bg-sv-faint',
  success: 'bg-sv-ok',
  error: 'bg-sv-danger',
  processing: 'bg-sv-brand-1',
  warning: 'bg-sv-warn',
};

/** A status dot and its word. */
export const Badge: React.FC<BadgeProps> = ({ status = 'default', text, className }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 text-[12px] text-sv-muted',
      `arco-badge arco-badge-status arco-badge-status-${status}`,
      className
    )}
  >
    <span className={cn('h-1.5 w-1.5 rounded-full', dot[status])} aria-hidden='true' />
    {text}
  </span>
);
