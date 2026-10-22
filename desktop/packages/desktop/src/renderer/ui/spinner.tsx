import * as React from 'react';
import { cn } from './cn';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | number;
  className?: string;
  label?: string;
  /** Arco compatibility; ignored (a spinner is the loading state). */
  loading?: boolean;
  dot?: boolean;
  tip?: React.ReactNode;
}

const sizes = { sm: 'h-3.5 w-3.5 border', md: 'h-5 w-5 border-2', lg: 'h-7 w-7 border-2' } as const;

const sizeFor = (size: SpinnerProps['size']): keyof typeof sizes => {
  if (typeof size === 'number') return size <= 14 ? 'sm' : size <= 22 ? 'md' : 'lg';
  return size ?? 'md';
};

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className, label = 'Loading', tip }) => (
  <span
    role='status'
    aria-label={typeof tip === 'string' ? tip : label}
    className={cn(
      'arco-spin inline-block animate-spin rounded-full border-sv-line border-t-sv-text',
      sizes[sizeFor(size)],
      className
    )}
  />
);

/** Arco's name, for the codemod. */
export const Spin = Spinner;
