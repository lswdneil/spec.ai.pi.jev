import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import * as React from 'react';
import { cn } from './cn';

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** A 16px square checkbox; the checked mark is the one accent. */
export const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  function Checkbox({ checked, defaultChecked, onCheckedChange, onChange, disabled, className, ...props }, ref) {
    return (
      <CheckboxPrimitive.Root
        ref={ref}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onCheckedChange={(value) => {
          const next = value === true;
          onCheckedChange?.(next);
          onChange?.(next);
        }}
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-sv-line bg-sv-surface text-sv-on-brand outline-none transition-colors',
          'data-[state=checked]:border-sv-brand data-[state=checked]:bg-sv-brand',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sv-focus',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className='flex items-center justify-center'>
          <Check className='h-3 w-3' strokeWidth={2.5} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );
  }
);
