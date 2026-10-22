import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from './cn';

export interface InputTagProps {
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  saveOnBlur?: boolean;
  validate?: (value: string) => boolean;
  size?: 'mini' | 'small' | 'default' | 'large';
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  'data-testid'?: string;
}

export const InputTag = React.forwardRef<HTMLInputElement, InputTagProps>(function InputTag(
  {
    value,
    defaultValue = [],
    onChange,
    placeholder,
    disabled,
    allowClear,
    saveOnBlur,
    validate,
    size = 'default',
    className,
    style,
    'aria-label': ariaLabel,
    'data-testid': testId,
  },
  ref
) {
  const [internal, setInternal] = React.useState(defaultValue);
  const [draft, setDraft] = React.useState('');
  const entries = value ?? internal;
  const small = size === 'mini' || size === 'small';
  const commit = (next: string[]) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  };
  const add = (raw: string) => {
    const entry = raw.trim();
    if (!entry || (validate && !validate(entry))) return;
    if (entries.includes(entry)) {
      setDraft('');
      return;
    }
    commit([...entries, entry]);
    setDraft('');
  };
  return (
    <span
      className={cn(
        'flex min-h-8 w-full flex-wrap items-center gap-1 rounded-[var(--sv-r-control)] border border-sv-line bg-sv-surface px-1.5 py-1 text-[12px] text-sv-text focus-within:border-sv-line-strong',
        small && 'min-h-7 text-[11.5px]',
        disabled && 'opacity-50',
        className
      )}
      style={style}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {entries.map((entry) => (
        <span
          key={entry}
          className='inline-flex h-5 items-center gap-1 rounded-[4px] bg-sv-raised px-1.5 text-[11px] text-sv-text'
        >
          {entry}
          {!disabled ? (
            <button
              type='button'
              aria-label={`Remove ${entry}`}
              className='flex h-3 w-3 items-center justify-center rounded-full bg-transparent text-sv-muted hover:text-sv-text'
              onClick={() => commit(entries.filter((item) => item !== entry))}
            >
              <X className='h-2.5 w-2.5' />
            </button>
          ) : null}
        </span>
      ))}
      <input
        ref={ref}
        value={draft}
        disabled={disabled}
        placeholder={entries.length ? undefined : placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            add(draft);
          } else if (event.key === 'Backspace' && !draft && entries.length) {
            commit(entries.slice(0, -1));
          }
        }}
        onBlur={() => {
          if (saveOnBlur) add(draft);
        }}
        className='h-5 min-w-[72px] flex-1 bg-transparent outline-none placeholder:text-sv-placeholder'
      />
      {allowClear && entries.length && !disabled ? (
        <button
          type='button'
          aria-label='Clear all'
          className='ms-auto flex h-4 w-4 items-center justify-center rounded-full bg-transparent text-sv-muted hover:text-sv-text'
          onClick={() => commit([])}
        >
          <X className='h-3 w-3' />
        </button>
      ) : null}
    </span>
  );
});
