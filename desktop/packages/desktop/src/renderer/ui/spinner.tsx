import * as React from 'react';
import { cn } from './cn';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizes = { sm: 'h-3.5 w-3.5 border', md: 'h-5 w-5 border-2', lg: 'h-7 w-7 border-2' } as const;

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className, label = 'Loading' }) => (
  <span
    role='status'
    aria-label={label}
    className={cn('inline-block animate-spin rounded-full border-sv-line border-t-sv-text', sizes[size], className)}
  />
);
