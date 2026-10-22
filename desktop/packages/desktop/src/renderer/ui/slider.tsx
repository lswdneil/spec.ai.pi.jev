import * as SliderPrimitive from '@radix-ui/react-slider';
import * as React from 'react';
import { cn } from './cn';

export interface SliderProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  onChange?: (value: number) => void;
  /** Called once the pointer or key is released. */
  onAfterChange?: (value: number) => void;
  formatValue?: (value: number) => string;
  'aria-label'?: string;
}

/**
 * One-thumb slider. The thumb is the value the person reads: its name and its
 * formatted value are the ones the row shows.
 */
export const Slider: React.FC<SliderProps> = ({
  value = 0,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  className,
  onChange,
  onAfterChange,
  formatValue,
  'aria-label': ariaLabel,
}) => (
  <SliderPrimitive.Root
    value={[value]}
    min={min}
    max={max}
    step={step}
    disabled={disabled}
    onValueChange={([next]) => onChange?.(next)}
    onValueCommit={([next]) => onAfterChange?.(next)}
    className={cn('relative flex h-5 w-full touch-none select-none items-center', className)}
  >
    <SliderPrimitive.Track className='relative h-1 w-full grow overflow-hidden rounded-full bg-sv-raised'>
      <SliderPrimitive.Range className='absolute inset-y-0 bg-sv-text' />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      aria-label={ariaLabel}
      aria-valuetext={formatValue?.(value)}
      className='block h-3.5 w-3.5 rounded-full border border-sv-line-strong bg-sv-bg outline-none transition-colors hover:border-sv-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sv-focus disabled:pointer-events-none disabled:opacity-50'
    />
  </SliderPrimitive.Root>
);
