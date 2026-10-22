import * as React from 'react';
import { cn } from './cn';

export interface InputNumberProps {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number | undefined) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  size?: 'mini' | 'small' | 'default' | 'large';
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  hideControl?: boolean;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  name?: string;
  'aria-label'?: string;
  'data-testid'?: string;
}

const clamp = (value: number, min?: number, max?: number): number =>
  Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, value));

const formatted = (value: number | undefined, precision?: number): string =>
  value === undefined ? '' : precision === undefined ? String(value) : value.toFixed(precision);

export const InputNumber = React.forwardRef<HTMLInputElement, InputNumberProps>(function InputNumber(
  {
    value,
    defaultValue,
    onChange,
    onBlur,
    onFocus,
    min,
    max,
    step = 1,
    precision,
    disabled,
    readOnly,
    placeholder,
    size = 'default',
    prefix,
    suffix,
    hideControl,
    className,
    style,
    ...props
  },
  ref
) {
  const [text, setText] = React.useState(() => formatted(value ?? defaultValue, precision));
  React.useEffect(() => {
    if (value !== undefined) setText(formatted(value, precision));
  }, [value, precision]);
  const small = size === 'mini' || size === 'small';
  const commit = () => {
    if (text.trim() === '') {
      if (value === undefined) onChange?.(undefined);
      return;
    }
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
      setText(formatted(value, precision));
      return;
    }
    const next = clamp(parsed, min, max);
    setText(formatted(next, precision));
    if (next !== value) onChange?.(next);
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[6px] border border-sv-line bg-sv-surface px-2 text-sv-text focus-within:border-sv-line-strong',
        small ? 'h-7 text-[12px]' : 'h-8 text-[12px]',
        disabled && 'opacity-50',
        className
      )}
      style={style}
    >
      {prefix ? <span className='shrink-0 text-sv-muted'>{prefix}</span> : null}
      <input
        ref={ref}
        type='number'
        inputMode='decimal'
        value={text}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (next.trim() === '') {
            onChange?.(undefined);
            return;
          }
          const parsed = Number(next);
          if (Number.isFinite(parsed)) onChange?.(parsed);
        }}
        onBlur={(event) => {
          commit();
          onBlur?.(event);
        }}
        onFocus={onFocus}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-right outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          hideControl && 'text-left'
        )}
        {...props}
      />
      {suffix ? <span className='shrink-0 text-sv-muted'>{suffix}</span> : null}
    </span>
  );
});
