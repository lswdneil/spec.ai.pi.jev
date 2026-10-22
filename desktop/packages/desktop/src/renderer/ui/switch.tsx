import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as React from 'react';
import { cn } from './cn';

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  /** Arco compatibility; the Dense switch keeps one size. */
  size?: 'small' | 'default' | 'large';
  loading?: boolean;
  onChange?: (checked: boolean, event?: unknown) => void;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  id?: string;
  title?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  'data-testid'?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  defaultChecked,
  disabled,
  onChange,
  onCheckedChange,
  className,
  'aria-label': ariaLabel,
  ...props
}) => (
  <SwitchPrimitive.Root
    checked={checked}
    defaultChecked={defaultChecked}
    disabled={disabled}
    aria-label={ariaLabel}
    {...props}
    onCheckedChange={(next) => {
      onChange?.(next, {});
      onCheckedChange?.(next);
    }}
    className={cn(
      'relative h-[18px] w-8 shrink-0 rounded-full border border-sv-line bg-sv-raised outline-none transition-colors data-[state=checked]:border-sv-brand data-[state=checked]:bg-sv-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sv-focus disabled:opacity-40',
      className
    )}
  >
    <SwitchPrimitive.Thumb className='block h-[14px] w-[14px] translate-x-[2px] rounded-full bg-sv-text transition-transform data-[state=checked]:translate-x-[16px] data-[state=checked]:bg-sv-on-brand' />
  </SwitchPrimitive.Root>
);
