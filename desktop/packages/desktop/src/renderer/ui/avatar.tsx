import * as React from 'react';
import { cn } from './cn';

type AvatarSize = 'small' | 'default' | 'large' | number;

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: AvatarSize;
  shape?: 'circle' | 'square';
}

const sizeFor = (size: AvatarSize = 'default'): number => {
  if (size === 'small') return 24;
  if (size === 'large') return 40;
  if (size === 'default') return 32;
  return size;
};

/** A round or square identity tile; the person's content fills it. */
const AvatarBase = React.forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { size = 'default', shape = 'circle', className, style, children, ...props },
  ref
) {
  const edge = sizeFor(size);
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden bg-sv-surface-2 text-sv-text',
        shape === 'square' ? 'rounded-[8px]' : 'rounded-full',
        className
      )}
      style={{ width: edge, height: edge, ...style }}
      {...props}
    >
      {children}
    </span>
  );
});

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: AvatarSize;
}

const AvatarGroup: React.FC<AvatarGroupProps> = ({ className, children, ...props }) => (
  <span className={cn('inline-flex items-center', className)} {...props}>
    {children}
  </span>
);

type AvatarComponent = typeof AvatarBase & { Group: typeof AvatarGroup };

export const Avatar = Object.assign(AvatarBase, { Group: AvatarGroup }) as AvatarComponent;
