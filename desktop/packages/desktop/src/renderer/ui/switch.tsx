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
  onChange?: (checked: boolean) => void;
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
  style,
  'aria-label': ariaLabel,
  ...props
}) => (
  <SwitchPrimitive.Root
    checked={checked}
    defaultChecked={defaultChecked}
    disabled={disabled}
    aria-label={ariaLabel}
    {...props}
    style={{ width: 32, height: 18, padding: 0, ...style }}
    onCheckedChange={(next) => {
      onChange?.(next);
      onCheckedChange?.(next);
    }}
    className={cn(
      'relative h-[18px] w-8 shrink-0 rounded-full border border-sv-line bg-sv-raised outline-none transition-colors data-[state=checked]:border-sv-brand data-[state=checked]:bg-sv-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sv-focus disabled:opacity-40',
      className
    )}
  >
    <SwitchPrimitive.Thumb className='absolute left-[2px] top-[1px] block h-[14px] w-[14px] rounded-full bg-sv-text transition-[left] data-[state=checked]:left-[16px] data-[state=checked]:bg-sv-on-brand' />
  </SwitchPrimitive.Root>
);
