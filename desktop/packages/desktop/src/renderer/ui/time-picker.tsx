import * as React from 'react';
import { cn } from './cn';

type TimeLike = string | { format: (pattern: string) => string };

export interface TimePickerProps {
  value?: TimeLike;
  defaultValue?: TimeLike;
  onChange?: (value: string, time: { format: (pattern?: string) => string }) => void;
  format?: string;
  allowClear?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  'aria-label'?: string;
  'data-testid'?: string;
}

const textOf = (value: TimeLike | undefined): string => {
  if (value === undefined) return '';
  return typeof value === 'string' ? value : value.format('HH:mm');
};

/** A native time field in Arco's `TimePicker` shape. */
export const TimePicker = React.forwardRef<HTMLInputElement, TimePickerProps>(function TimePicker(
  { value, defaultValue, onChange, disabled, placeholder, className, style, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type='time'
      value={textOf(value)}
      defaultValue={textOf(defaultValue)}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => {
        const next = event.target.value;
        onChange?.(next, { format: () => next });
      }}
      className={cn(
        'h-8 rounded-[var(--sv-r-control)] border border-sv-line bg-sv-surface px-2 text-[12px] text-sv-text outline-none transition-colors focus:border-sv-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sv-focus disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      style={style}
      {...props}
    />
  );
});
