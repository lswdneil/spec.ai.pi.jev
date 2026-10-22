import * as React from 'react';
import { Input } from './input';

export interface AutoCompleteProps {
  value?: string;
  defaultValue?: string;
  data?: string[];
  onChange?: (value: string) => void;
  placeholder?: string;
  status?: 'normal' | 'error' | 'warning';
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  'data-testid'?: string;
}

/** Arco's `AutoComplete`, over a native input and datalist. */
export const AutoComplete = React.forwardRef<HTMLInputElement, AutoCompleteProps>(function AutoComplete(
  { data = [], value, defaultValue, onChange, ...props },
  ref
) {
  const id = React.useId();
  return (
    <>
      <Input
        ref={ref}
        list={id}
        value={value}
        defaultValue={defaultValue}
        onChange={(next) => onChange?.(next)}
        {...props}
      />
      <datalist id={id}>
        {data.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
    </>
  );
});
