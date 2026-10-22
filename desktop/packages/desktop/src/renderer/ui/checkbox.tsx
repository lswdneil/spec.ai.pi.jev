import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import * as React from 'react';
import { cn } from './cn';

type GroupValue = readonly string[];

const GroupContext = React.createContext<{
  value?: GroupValue;
  onChange?: (value: string[]) => void;
  disabled?: boolean;
}>({});

export interface CheckboxGroupProps {
  value?: GroupValue;
  defaultValue?: GroupValue;
  onChange?: (value: string[]) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const CheckboxGroup: React.FC<CheckboxGroupProps> = ({
  value,
  defaultValue = [],
  onChange,
  disabled,
  className,
  children,
}) => {
  const [uncontrolled, setUncontrolled] = React.useState<string[]>([...defaultValue]);
  const current = value ?? uncontrolled;
  return (
    <GroupContext.Provider
      value={{
        value: current,
        disabled,
        onChange: (next) => {
          if (value === undefined) setUncontrolled(next);
          onChange?.(next);
        },
      }}
    >
      <div role='group' className={className}>
        {children}
      </div>
    </GroupContext.Provider>
  );
};

export interface CheckboxProps {
  checked?: boolean | 'indeterminate';
  defaultChecked?: boolean;
  value?: string;
  onCheckedChange?: (checked: boolean) => void;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  'aria-label'?: string;
  'data-testid'?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  indeterminate?: boolean;
}

const CheckboxBase = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  function Checkbox(
    { checked, defaultChecked, value, indeterminate, onCheckedChange, onChange, disabled, className, children, ...props },
    ref
  ) {
    const group = React.useContext(GroupContext);
    const inGroup = group.value !== undefined && value !== undefined;
    const isChecked = inGroup ? group.value!.includes(value!) : checked;
    return (
      <label className={cn('inline-flex items-center gap-2', className)}>
        <CheckboxPrimitive.Root
          ref={ref}
          checked={indeterminate ? 'indeterminate' : isChecked}
          defaultChecked={defaultChecked}
          disabled={disabled || group.disabled}
          onCheckedChange={(next) => {
            const on = next === true;
            if (inGroup) {
              const set = new Set(group.value);
              if (on) set.add(value!);
              else set.delete(value!);
              group.onChange?.([...set]);
            }
            onCheckedChange?.(on);
            onChange?.(on);
          }}
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-sv-line bg-sv-surface text-sv-on-brand outline-none transition-colors',
            'data-[state=checked]:border-sv-brand data-[state=checked]:bg-sv-brand',
            'data-[state=indeterminate]:border-sv-brand data-[state=indeterminate]:bg-sv-brand',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sv-focus',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
          {...props}
        >
          <CheckboxPrimitive.Indicator className='flex items-center justify-center'>
            <Check className='h-3 w-3' strokeWidth={2.5} />
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
        {children}
      </label>
    );
  }
);

type CheckboxComponent = typeof CheckboxBase & { Group: typeof CheckboxGroup };

export const Checkbox = Object.assign(CheckboxBase, { Group: CheckboxGroup }) as CheckboxComponent;
