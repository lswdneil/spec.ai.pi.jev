import * as React from 'react';
import { cn } from './cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  /** Arco compatibility; the Dense card always uses its hairline. */
  bordered?: boolean;
  size?: 'small' | 'default' | 'medium';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, interactive, bordered: _bordered, size: _size, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-[var(--sv-r-control)] border border-sv-line bg-sv-surface',
        interactive && 'transition-colors hover:border-sv-line-strong',
        className
      )}
      {...props}
    />
  );
});
