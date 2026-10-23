import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from './cn';

const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap font-medium outline-none transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sv-focus',
  {
    variants: {
      variant: {
        primary: 'bg-sv-brand text-sv-on-brand hover:bg-sv-brand-1',
        secondary: 'border border-sv-line bg-transparent text-sv-text hover:border-sv-line-strong hover:bg-sv-surface',
        ghost: 'bg-transparent text-sv-muted hover:bg-sv-surface hover:text-sv-text',
        text: 'bg-transparent text-sv-text hover:bg-sv-surface',
        danger: 'bg-sv-danger text-sv-bg hover:opacity-90',
      },
      size: {
        sm: 'h-7 rounded-[var(--sv-r-control)] px-2.5 text-[11.5px]',
        md: 'h-8 rounded-[var(--sv-r-control)] px-3 text-[13px]',
        lg: 'h-9 rounded-[var(--sv-r-control)] px-4 text-[14px]',
        icon: 'h-7 w-7 rounded-[var(--sv-r-control)] p-0',
        'icon-lg': 'h-8 w-8 rounded-[var(--sv-r-control)] p-0',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
);

type ArcoButtonType = 'default' | 'primary' | 'secondary' | 'outline' | 'dashed' | 'text';
type ArcoButtonSize = 'mini' | 'small' | 'default' | 'large';

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'>,
    Omit<VariantProps<typeof buttonVariants>, 'size'> {
  /** Arco compatibility: the visual type. Prefer `variant` in new code. */
  type?: ArcoButtonType;
  /** Arco's names (`mini`, `small`, `default`, `large`) also work. */
  size?: VariantProps<typeof buttonVariants>['size'] | ArcoButtonSize;
  htmlType?: 'button' | 'submit' | 'reset';
  status?: 'default' | 'normal' | 'success' | 'warning' | 'danger';
  loading?: boolean;
  /** Arco compatibility: a leading icon; `loading` replaces it. */
  icon?: React.ReactNode;
  shape?: 'circle' | 'round' | 'square';
  long?: boolean;
  asChild?: boolean;
}

function variantFor(type: ArcoButtonType | undefined, status: ButtonProps['status']): ButtonProps['variant'] {
  if (status === 'danger') return 'danger';
  if (type === 'primary') return 'primary';
  if (type === 'text') return 'text';
  if (type === 'outline' || type === 'dashed') return 'secondary';
  return 'secondary';
}

function sizeFor(size: ButtonProps['size']): VariantProps<typeof buttonVariants>['size'] {
  if (size === 'mini' || size === 'small') return 'sm';
  if (size === 'default') return 'md';
  if (size === 'large') return 'lg';
  return size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    type,
    htmlType = 'button',
    status,
    loading = false,
    icon,
    shape,
    long,
    asChild = false,
    disabled,
    children,
    ...props
  },
  ref
) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      ref={ref}
      type={asChild ? undefined : htmlType}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        buttonVariants({ variant: variant ?? variantFor(type, status), size: sizeFor(size) }),
        (variant ?? variantFor(type, status)) === 'primary' && 'arco-btn-primary',
        loading && 'arco-btn-loading',
        status && `arco-btn-status-${status}`,
        long && 'w-full',
        shape === 'circle' || shape === 'round' ? 'rounded-full' : null,
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className='sv-icon-sm animate-spin' aria-hidden='true' /> : icon}
      {children}
    </Component>
  );
});
