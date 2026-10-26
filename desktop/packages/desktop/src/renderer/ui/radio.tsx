import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import * as React from 'react';
import { cn } from './cn';

type RadioSize = 'mini' | 'small' | 'default' | 'large' | 'sm' | 'md' | 'lg';

type GroupContextValue = {
  type: 'radio' | 'button';
  size: RadioSize;
  disabled?: boolean;
};

const GroupContext = React.createContext<GroupContextValue>({ type: 'radio', size: 'default' });

export interface RadioGroupProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  type?: 'radio' | 'button';
  direction?: 'horizontal' | 'vertical';
  size?: RadioSize;
  className?: string;
  'aria-label'?: string;
  options?: { value: string; label: React.ReactNode; disabled?: boolean }[];
  children?: React.ReactNode;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(function RadioGroup(
  {
    value,
    defaultValue,
    onChange,
    disabled,
    type = 'radio',
    direction = 'horizontal',
    size = 'default',
    className,
    options,
    children,
    ...props
  },
  ref
) {
  return (
    <GroupContext.Provider value={{ type, size, disabled }}>
      <RadioGroupPrimitive.Root
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        onValueChange={onChange}
        className={cn(
          'flex gap-2',
          direction === 'vertical' ? 'flex-col items-start' : 'items-center',
          type === 'button' && 'gap-1',
          className
        )}
        {...props}
      >
        {options?.map((option) => (
          <Radio key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </Radio>
        ))}
        {children}
      </RadioGroupPrimitive.Root>
    </GroupContext.Provider>
  );
});

export interface RadioProps {
  value: string;
  disabled?: boolean;
  className?: string;
  title?: string;
  children?: React.ReactNode;
  'data-testid'?: string;
}

const RadioBase = React.forwardRef<HTMLButtonElement, RadioProps>(function Radio(
  { value, disabled, className, title, children, ...props },
  ref
) {
  const group = React.useContext(GroupContext);
  const button = group.type === 'button';
  const small = group.size === 'mini' || group.size === 'small' || group.size === 'sm';
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      value={value}
      disabled={disabled || group.disabled}
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sv-focus disabled:cursor-not-allowed disabled:opacity-50',
        button
          ? cn(
              'justify-center rounded-[5px] border border-sv-line bg-transparent px-2 text-sv-muted hover:bg-sv-surface hover:text-sv-text',
              small ? 'h-6 text-[11px]' : 'h-7 text-[12px]',
              'data-[state=checked]:border-sv-line-strong data-[state=checked]:bg-sv-selected data-[state=checked]:text-sv-text'
            )
          : 'text-[12px] text-sv-text',
        className
      )}
      {...props}
    >
      {button ? null : (
        <span className='flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-sv-line-strong'>
          <RadioGroupPrimitive.Indicator className='h-1.5 w-1.5 rounded-full bg-sv-text' />
        </span>
      )}
      {children}
    </RadioGroupPrimitive.Item>
  );
});

type RadioComponent = typeof RadioBase & { Group: typeof RadioGroup };

export const Radio = Object.assign(RadioBase, { Group: RadioGroup }) as RadioComponent;
