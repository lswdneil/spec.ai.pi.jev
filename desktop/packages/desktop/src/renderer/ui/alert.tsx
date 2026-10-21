import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import * as React from 'react';
import { cn } from './cn';

const tones = {
  info: { box: 'border-sv-line bg-sv-surface text-sv-text', icon: Info, iconColor: 'text-sv-info' },
  success: { box: 'border-sv-line bg-sv-surface text-sv-text', icon: CheckCircle2, iconColor: 'text-sv-ok' },
  warning: { box: 'border-sv-line bg-sv-surface text-sv-text', icon: AlertTriangle, iconColor: 'text-sv-warn' },
  error: { box: 'border-sv-line bg-sv-surface text-sv-text', icon: XCircle, iconColor: 'text-sv-danger' },
} as const;

export type AlertTone = keyof typeof tones;

export interface AlertProps {
  tone?: AlertTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({ tone = 'info', title, children, action, className }) => {
  const config = tones[tone];
  const Icon = config.icon;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-2.5 rounded-[var(--sv-r-control)] border p-3', config.box, className)}>
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', config.iconColor)} aria-hidden='true' />
      <div className='min-w-0 flex-1'>
        {title ? <p className='text-[13px] font-medium text-sv-text'>{title}</p> : null}
        {children ? <div className='mt-0.5 text-[12px] leading-[1.6] text-sv-muted'>{children}</div> : null}
      </div>
      {action ? <div className='shrink-0'>{action}</div> : null}
    </div>
  );
};
