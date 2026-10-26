import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import * as React from 'react';
import { cn } from './cn';

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  disabled?: boolean;
  icon?: React.ReactNode;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { disabled, icon, className, children, ...props },
  ref
) {
  return (
    <a
      ref={ref}
      aria-disabled={disabled || undefined}
      className={cn(
        'inline-flex items-center gap-1 text-sv-brand-ink underline-offset-2 hover:underline',
        disabled && 'pointer-events-none opacity-50',
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </a>
  );
});

export interface SpaceProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'mini' | 'small' | 'medium' | 'large' | number;
  direction?: 'horizontal' | 'vertical';
  align?: 'start' | 'center' | 'end' | 'baseline';
  wrap?: boolean;
  split?: React.ReactNode;
}

const gapFor = (size: SpaceProps['size']): number => {
  if (size === 'mini') return 4;
  if (size === 'small') return 8;
  if (size === 'large') return 24;
  if (typeof size === 'number') return size;
  return 16;
};

export const Space: React.FC<SpaceProps> = ({
  size = 'small',
  direction = 'horizontal',
  align = 'center',
  wrap,
  split,
  className,
  style,
  children,
  ...props
}) => {
  const items = React.Children.toArray(children);
  return (
    <div
      className={cn('flex', direction === 'vertical' ? 'flex-col' : 'flex-row', wrap && 'flex-wrap', className)}
      style={{
        gap: gapFor(size),
        alignItems: align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : align,
        ...style,
      }}
      {...props}
    >
      {items.map((child, index) => (
        <React.Fragment key={index}>
          {split && index > 0 ? <span className='shrink-0 text-sv-faint'>{split}</span> : null}
          {child}
        </React.Fragment>
      ))}
    </div>
  );
};

export interface ResultProps {
  status?: 'success' | 'error' | 'info' | 'warning' | '404' | '403' | '500';
  title?: React.ReactNode;
  subTitle?: React.ReactNode;
  extra?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const resultIcons = {
  success: { Icon: CheckCircle2, tone: 'text-sv-ok' },
  error: { Icon: XCircle, tone: 'text-sv-danger' },
  warning: { Icon: AlertTriangle, tone: 'text-sv-warn' },
  info: { Icon: Info, tone: 'text-sv-info' },
} as const;

export const Result: React.FC<ResultProps> = ({ status = 'info', title, subTitle, extra, icon, className, style }) => {
  const config = resultIcons[status as keyof typeof resultIcons] ?? resultIcons.info;
  const Icon = config.Icon;
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 px-6 py-10 text-center', className)}
      style={style}
    >
      <div className={config.tone}>{icon ?? <Icon className='h-8 w-8' strokeWidth={1.5} aria-hidden='true' />}</div>
      {title ? <div className='text-[15px] font-semibold text-sv-text'>{title}</div> : null}
      {subTitle ? <div className='max-w-[420px] text-[12px] leading-[1.6] text-sv-muted'>{subTitle}</div> : null}
      {extra ? <div className='mt-2'>{extra}</div> : null}
    </div>
  );
};

export interface ProgressProps {
  percent?: number;
  type?: 'line' | 'circle';
  size?: 'mini' | 'small' | 'default' | 'large';
  width?: number;
  strokeWidth?: number;
  color?: string;
  trailColor?: string;
  formatText?: (percent: number) => React.ReactNode;
  showText?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const Progress: React.FC<ProgressProps> = ({
  percent = 0,
  type = 'line',
  size = 'default',
  width = 48,
  strokeWidth = 4,
  color = 'var(--sv-brand)',
  trailColor = 'var(--sv-line)',
  formatText,
  showText = true,
  className,
  style,
}) => {
  const value = Math.max(0, Math.min(100, percent));
  if (type === 'circle') {
    const radius = (width - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    return (
      <span className={cn('relative inline-flex items-center justify-center', className)} style={style}>
        <svg width={width} height={width} viewBox={`0 0 ${width} ${width}`} aria-hidden='true'>
          <circle cx={width / 2} cy={width / 2} r={radius} fill='none' stroke={trailColor} strokeWidth={strokeWidth} />
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill='none'
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - value / 100)}
            strokeLinecap='round'
            transform={`rotate(-90 ${width / 2} ${width / 2})`}
          />
        </svg>
        {showText ? (
          <span className='absolute inset-0 flex items-center justify-center text-[10px] text-sv-text'>
            {formatText ? formatText(value) : `${Math.round(value)}%`}
          </span>
        ) : null}
      </span>
    );
  }
  const height = size === 'mini' ? 2 : size === 'small' ? 4 : size === 'large' ? 10 : 6;
  return (
    <span className={cn('flex w-full items-center gap-2', className)} style={style}>
      <span className='relative block flex-1 overflow-hidden rounded-full' style={{ height, background: trailColor }}>
        <span
          className='block h-full rounded-full transition-[width]'
          style={{ width: `${value}%`, background: color }}
        />
      </span>
      {showText ? (
        <span className='shrink-0 text-[11px] text-sv-muted'>
          {formatText ? formatText(value) : `${Math.round(value)}%`}
        </span>
      ) : null}
    </span>
  );
};
