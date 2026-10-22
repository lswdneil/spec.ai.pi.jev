import * as React from 'react';
import { cn } from './cn';

export interface TypographyTextProps extends React.HTMLAttributes<HTMLElement> {
  /** Render as a code span. */
  code?: boolean;
  /** Truncate with an ellipsis when the text overflows. */
  ellipsis?: boolean;
}

const Text = React.forwardRef<HTMLElement, TypographyTextProps>(function Text(
  { code, ellipsis, className, children, ...props },
  ref
) {
  const Tag = code ? 'code' : 'span';
  return (
    <Tag
      ref={ref as React.Ref<HTMLElement>}
      className={cn(ellipsis && 'block overflow-hidden text-ellipsis whitespace-nowrap', className)}
      {...props}
    >
      {children}
    </Tag>
  );
});

export interface TypographyParagraphProps extends React.HTMLAttributes<HTMLParagraphElement> {
  ellipsis?: boolean;
}

const Paragraph = React.forwardRef<HTMLParagraphElement, TypographyParagraphProps>(function Paragraph(
  { ellipsis, className, children, ...props },
  ref
) {
  return (
    <p
      ref={ref}
      className={cn('m-0 leading-[1.7]', ellipsis && 'overflow-hidden text-ellipsis whitespace-nowrap', className)}
      {...props}
    >
      {children}
    </p>
  );
});

export interface TypographyTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  heading?: 1 | 2 | 3 | 4 | 5 | 6;
}

const Title = React.forwardRef<HTMLHeadingElement, TypographyTitleProps>(function Title(
  { heading = 1, className, children, ...props },
  ref
) {
  const Tag = `h${heading}` as 'h1';
  return (
    <Tag ref={ref} className={cn('m-0 font-semibold text-sv-text', className)} {...props}>
      {children}
    </Tag>
  );
});

export interface TypographyLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  disabled?: boolean;
}

const Link = React.forwardRef<HTMLAnchorElement, TypographyLinkProps>(function Link(
  { disabled, className, children, ...props },
  ref
) {
  return (
    <a
      ref={ref}
      aria-disabled={disabled || undefined}
      className={cn(
        'text-sv-brand-ink underline-offset-2 hover:underline',
        disabled && 'pointer-events-none opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </a>
  );
});

export const Typography = { Text, Paragraph, Title, Link };
