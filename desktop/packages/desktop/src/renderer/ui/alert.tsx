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
  /** Arco compatibility. */
  type?: AlertTone;
  title?: React.ReactNode;
  content?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  showIcon?: boolean;
  closable?: boolean;
}

export const Alert: React.FC<AlertProps> = ({
  tone,
  type,
  title,
  content,
  children,
  action,
  icon,
  className,
  style,
  showIcon = true,
}) => {
  const config = tones[tone ?? type ?? 'info'];
  const Icon = config.icon;
  return (
    <div
      role={(tone ?? type) === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-2.5 rounded-[var(--sv-r-control)] border p-3', config.box, className)}
      style={style}
    >
      {showIcon
        ? (icon ?? <Icon className={cn('sv-icon-md mt-0.5 shrink-0', config.iconColor)} aria-hidden='true' />)
        : null}
      <div className='min-w-0 flex-1'>
        {title ? <p className='text-[13px] font-medium text-sv-text'>{title}</p> : null}
        {(content ?? children) ? (
          <div className='mt-0.5 text-[12px] leading-[1.6] text-sv-muted'>{content ?? children}</div>
        ) : null}
      </div>
      {action ? <div className='shrink-0'>{action}</div> : null}
    </div>
  );
};
