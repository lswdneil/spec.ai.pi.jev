import { Search } from 'lucide-react';
import * as React from 'react';
import { cn } from './cn';
import { Input, type InputProps } from './input';

export interface SearchInputProps extends Omit<InputProps, 'prefix' | 'suffix' | 'allowClear' | 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  allowClear?: boolean;
  onClear?: () => void;
  /** `bar` is a standing search field; `inline` sits at the top of a dropdown. */
  variant?: 'bar' | 'inline';
  /** Test id for the wrapper, while `data-testid` still lands on the input. */
  wrapTestId?: string;
  /** Extra attributes for the native input. */
  inputProps?: Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'placeholder' | 'disabled' | 'autoFocus' | 'className'
  >;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  {
    value,
    onChange,
    allowClear = true,
    onClear,
    variant = 'bar',
    wrapTestId,
    inputProps,
    className,
    autoFocus,
    ...props
  },
  ref
) {
  return (
    <div
      data-testid={wrapTestId}
      className={cn(variant === 'inline' ? 'rounded-[8px] bg-sv-surface-2 p-1.5' : 'w-full', className)}
    >
      <Input
        {...inputProps}
        {...props}
        ref={ref}
        size={variant === 'inline' ? 'sm' : 'md'}
        value={value}
        autoFocus={autoFocus}
        allowClear={allowClear}
        onClear={onClear}
        prefix={<Search className='sv-icon-xs' strokeWidth={1.75} />}
        onChange={(next) => onChange(next)}
        className={variant === 'inline' ? 'border-transparent bg-transparent px-1' : undefined}
      />
    </div>
  );
});
