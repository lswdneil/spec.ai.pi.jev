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

const AvatarSizeContext = React.createContext<AvatarSize | undefined>(undefined);

/** A round or square identity tile; the person's content fills it. */
const AvatarBase = React.forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { size, shape = 'circle', className, style, children, ...props },
  ref
) {
  const groupSize = React.useContext(AvatarSizeContext);
  const edge = sizeFor(size ?? groupSize);
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden bg-sv-surface-2 text-sv-text',
        shape === 'square' ? 'rounded-[8px]' : 'rounded-full',
        className
      )}
      data-sv-avatar=''
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

const AvatarGroup: React.FC<AvatarGroupProps> = ({ size, className, children, ...props }) => (
  <AvatarSizeContext.Provider value={size}>
    <span className={cn('inline-flex items-center', className)} {...props}>
      {children}
    </span>
  </AvatarSizeContext.Provider>
);

type AvatarComponent = typeof AvatarBase & { Group: typeof AvatarGroup };

export const Avatar = Object.assign(AvatarBase, { Group: AvatarGroup }) as AvatarComponent;
