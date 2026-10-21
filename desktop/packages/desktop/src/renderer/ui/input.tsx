import * as React from 'react';
import { cn } from './cn';

const field =
  'w-full rounded-[var(--sv-r-control)] border border-sv-line bg-sv-input px-2.5 text-[13px] text-sv-text placeholder:text-sv-placeholder outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus:border-sv-line-strong focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-sv-focus';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  size?: 'sm' | 'md' | 'lg';
  status?: 'normal' | 'error' | 'warning';
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  allowClear?: boolean;
  onClear?: () => void;
}

const heights = { sm: 'h-7', md: 'h-8', lg: 'h-9' } as const;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, size = 'md', status = 'normal', prefix, suffix, allowClear, onClear, disabled, ...props },
  ref
) {
  const statusClass =
    status === 'error' ? 'border-sv-danger' : status === 'warning' ? 'border-sv-warn' : '';
  const input = (
    <input
      ref={ref}
      disabled={disabled}
      className={cn(field, heights[size], statusClass, prefix && 'pl-7', suffix && 'pr-7', allowClear && 'pr-7', className)}
      {...props}
    />
  );
  if (!prefix && !suffix && !allowClear) return input;
  return (
    <span className='relative flex w-full items-center'>
      {prefix ? (
        <span className='pointer-events-none absolute left-2 flex items-center text-sv-faint' aria-hidden='true'>
          {prefix}
        </span>
      ) : null}
      {input}
      {suffix || allowClear ? (
        <span className='absolute right-2 flex items-center gap-1 text-sv-faint'>
          {suffix}
          {allowClear && !disabled ? (
            <button
              type='button'
              aria-label='Clear'
              className='rounded p-0.5 hover:bg-sv-raised hover:text-sv-text'
              onClick={() => {
                onClear?.();
              }}
            >
              <svg viewBox='0 0 24 24' className='h-3 w-3' fill='none' stroke='currentColor' strokeWidth='1.75'>
                <path d='m6 6 12 12M18 6 6 18' />
              </svg>
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  status?: 'normal' | 'error' | 'warning';
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, status = 'normal', ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        field,
        'min-h-[72px] resize-y py-2 leading-[1.55]',
        status === 'error' ? 'border-sv-danger' : status === 'warning' ? 'border-sv-warn' : '',
        className
      )}
      {...props}
    />
  );
});
