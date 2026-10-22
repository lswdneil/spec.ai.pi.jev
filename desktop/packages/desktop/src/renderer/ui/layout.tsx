import * as React from 'react';
import { cn } from './cn';

const LayoutBase = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function Layout(
  { className, children, ...props },
  ref
) {
  return (
    <div ref={ref} className={cn('flex min-h-0 flex-col', className)} {...props}>
      {children}
    </div>
  );
});

const Header = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(function Header(
  { className, ...props },
  ref
) {
  return <header ref={ref} className={cn('shrink-0', className)} {...props} />;
});

const Content = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(function Content(
  { className, ...props },
  ref
) {
  return <main ref={ref} className={cn('min-h-0 flex-1', className)} {...props} />;
});

const Sider = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(function Sider(
  { className, ...props },
  ref
) {
  return <aside ref={ref} className={cn('min-h-0 shrink-0', className)} {...props} />;
});

const Footer = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(function Footer(
  { className, ...props },
  ref
) {
  return <footer ref={ref} className={cn('shrink-0', className)} {...props} />;
});

type LayoutComponent = typeof LayoutBase & {
  Header: typeof Header;
  Content: typeof Content;
  Sider: typeof Sider;
  Footer: typeof Footer;
};

export const Layout = Object.assign(LayoutBase, { Header, Content, Sider, Footer }) as LayoutComponent;
