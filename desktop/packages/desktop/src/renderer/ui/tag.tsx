import * as React from 'react';
import { cn } from './cn';

const tones = {
  neutral: 'border-sv-line bg-sv-surface text-sv-muted',
  brand: 'border-sv-brand bg-sv-selected text-sv-brand-ink',
  success: 'border-sv-ok bg-sv-surface text-sv-ok',
  warning: 'border-sv-warn bg-sv-surface text-sv-warn',
  danger: 'border-sv-danger bg-sv-surface text-sv-danger',
  info: 'border-sv-info bg-sv-surface text-sv-info',
} as const;

export type TagTone = keyof typeof tones;

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: TagTone;
  /** Arco compatibility: a named colour. */
  color?: 'gray' | 'green' | 'red' | 'orange' | 'blue' | 'arcoblue' | 'purple';
  size?: 'small' | 'default' | 'medium' | 'large';
  bordered?: boolean;
}

const arcoTones: Record<NonNullable<TagProps['color']>, TagTone> = {
  gray: 'neutral',
  green: 'success',
  red: 'danger',
  orange: 'warning',
  blue: 'info',
  arcoblue: 'info',
  purple: 'brand',
};

export const Tag: React.FC<TagProps> = ({
  tone,
  color,
  className,
  children,
  size: _size,
  bordered: _bordered,
  ...props
}) => (
  <span
    className={cn(
      'inline-flex h-[22px] items-center rounded-full border px-2 text-[10.5px] font-medium leading-none',
      tones[tone ?? (color ? arcoTones[color] : 'neutral')],
      className
    )}
    {...props}
  >
    {children}
  </span>
);
