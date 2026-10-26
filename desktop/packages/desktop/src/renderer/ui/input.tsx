import * as React from 'react';
import { cn } from './cn';

const field =
  'w-full rounded-[var(--sv-r-control)] border border-sv-line bg-sv-input px-2.5 text-[13px] text-sv-text placeholder:text-sv-placeholder outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus:border-sv-line-strong focus:outline-none';

type ArcoSize = 'mini' | 'small' | 'default' | 'large';
type Size = 'sm' | 'md' | 'lg';
const heights = { sm: 'h-7', md: 'h-8', lg: 'h-9' } as const;
const sizeFor = (size: Size | ArcoSize = 'md'): Size => {
  if (size === 'mini' || size === 'small') return 'sm';
  if (size === 'large') return 'lg';
  if (size === 'default') return 'md';
  return size;
};

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix' | 'onChange'> {
  size?: Size | ArcoSize;
  status?: 'normal' | 'error' | 'warning';
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  addBefore?: React.ReactNode;
  addAfter?: React.ReactNode;
  allowClear?: boolean;
  onClear?: () => void;
  showWordLimit?: boolean;
  /** Arco's value-first change; the native event is second. */
  onChange?: (value: string, event?: React.ChangeEvent<HTMLInputElement>) => void;
  onPressEnter?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

const InputBase = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    size = 'md',
    status = 'normal',
    prefix,
    suffix,
    addBefore,
    addAfter,
    allowClear,
    onClear,
    showWordLimit,
    onChange,
    onPressEnter,
    onKeyDown,
    disabled,
    maxLength,
    value,
    ...props
  },
  ref
) {
  const statusClass =
    status === 'error'
      ? 'border-sv-danger arco-input-error'
      : status === 'warning'
        ? 'border-sv-warn arco-input-warning'
        : '';
  const input = (
    <input
      ref={ref}
      disabled={disabled}
      value={value}
      maxLength={maxLength}
      className={cn(
        field,
        heights[sizeFor(size)],
        statusClass,
        prefix && 'pl-7',
        suffix || allowClear || showWordLimit ? 'pr-16' : null,
        className
      )}
      onChange={(event) => onChange?.(event.target.value, event)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onPressEnter?.(event);
        onKeyDown?.(event);
      }}
      {...props}
    />
  );
  const decorated = (
    <span className='relative flex w-full items-center'>
      {prefix ? (
        <span className='pointer-events-none absolute left-2 flex items-center text-sv-faint' aria-hidden='true'>
          {prefix}
        </span>
      ) : null}
      {input}
      {suffix || allowClear || showWordLimit ? (
        <span className='absolute right-2 flex items-center gap-1 text-sv-faint'>
          {showWordLimit && typeof value === 'string' ? (
            <span className='font-mono text-[9px]'>
              {value.length}/{maxLength ?? '∞'}
            </span>
          ) : null}
          {suffix}
          {allowClear && !disabled ? (
            <button
              type='button'
              aria-label='Clear'
              className='rounded bg-transparent p-0.5 hover:bg-sv-raised hover:text-sv-text'
              onClick={() => {
                onClear?.();
                onChange?.('');
              }}
            >
              <svg viewBox='0 0 24 24' className='sv-icon-xs' fill='none' stroke='currentColor' strokeWidth='1.75'>
                <path d='m6 6 12 12M18 6 6 18' />
              </svg>
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
  if (!addBefore && !addAfter) return decorated;
  return (
    <span className='flex w-full items-center'>
      {addBefore ? <span className='shrink-0'>{addBefore}</span> : null}
      {decorated}
      {addAfter ? <span className='shrink-0'>{addAfter}</span> : null}
    </span>
  );
});

export interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  status?: 'normal' | 'error' | 'warning';
  autoSize?: boolean | { minRows?: number; maxRows?: number };
  showWordLimit?: boolean;
  onChange?: (value: string, event?: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onPressEnter?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, status = 'normal', onChange, onPressEnter, onKeyDown, ...props },
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
      onChange={(event) => onChange?.(event.target.value, event)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) onPressEnter?.(event);
        onKeyDown?.(event);
      }}
      {...props}
    />
  );
});

const Password = React.forwardRef<HTMLInputElement, InputProps>(function Password(props, ref) {
  return <InputBase {...props} ref={ref} type='password' />;
});

const Search = React.forwardRef<HTMLInputElement, InputProps>(function Search(props, ref) {
  return <InputBase {...props} ref={ref} type='search' />;
});

type InputComponent = typeof InputBase & {
  TextArea: typeof Textarea;
  Password: typeof Password;
  Search: typeof Search;
};

export const Input = Object.assign(InputBase, {
  TextArea: Textarea,
  Password,
  Search,
}) as InputComponent;
