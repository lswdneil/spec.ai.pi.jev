import * as React from 'react';
import { cn } from './cn';

type MenuKey = string;

type MenuContextValue = {
  onClickMenuItem?: (key: MenuKey, event?: React.MouseEvent<HTMLButtonElement>) => void;
  selectedKeys: MenuKey[];
};

const MenuContext = React.createContext<MenuContextValue>({ selectedKeys: [] });

const keyOf = (child: React.ReactNode): MenuKey | undefined => {
  if (!React.isValidElement(child) || child.key == null) return undefined;
  return String(child.key).replace(/^\.\$/, '').replace(/^\./, '');
};

const withKeys = (children: React.ReactNode): React.ReactNode =>
  React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    if (child.type === MenuItem || child.type === SubMenu) {
      return React.cloneElement(child as React.ReactElement<{ __menuKey?: MenuKey }>, { __menuKey: keyOf(child) });
    }
    return child;
  });

export interface MenuProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'> {
  onClickMenuItem?: (key: MenuKey, event?: React.MouseEvent<HTMLButtonElement>) => void;
  selectedKeys?: MenuKey[];
  children?: React.ReactNode;
}

const MenuBase: React.FC<MenuProps> = ({ onClickMenuItem, selectedKeys = [], className, children, ...props }) => (
  <MenuContext.Provider value={{ onClickMenuItem, selectedKeys }}>
    <div role='menu' className={cn('arco-dropdown-menu flex min-w-0 flex-col gap-0.5', className)} {...props}>
      {withKeys(children)}
    </div>
  </MenuContext.Provider>
);

export interface MenuItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  children?: React.ReactNode;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  __menuKey?: MenuKey;
}

export const MenuItem: React.FC<MenuItemProps> = ({ children, disabled, onClick, __menuKey, className, ...props }) => {
  const context = React.useContext(MenuContext);
  const selected = __menuKey !== undefined && context.selectedKeys.includes(__menuKey);
  return (
    <button
      type='button'
      role='menuitem'
      disabled={disabled}
      data-menu-key={__menuKey}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex min-h-8 w-full items-center gap-2 rounded-[6px] px-2 py-1 text-left text-[12px] outline-none transition-colors',
        selected ? 'bg-sv-selected text-sv-text' : 'text-sv-muted hover:bg-sv-surface hover:text-sv-text',
        'focus-visible:bg-sv-surface disabled:cursor-not-allowed disabled:opacity-40',
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (__menuKey !== undefined) context.onClickMenuItem?.(__menuKey, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        const asMouse = event as unknown as React.MouseEvent<HTMLButtonElement>;
        onClick?.(asMouse);
        if (!event.defaultPrevented && __menuKey !== undefined) context.onClickMenuItem?.(__menuKey, asMouse);
      }}
      {...props}
    >
      {children}
    </button>
  );
};

export interface MenuItemGroupProps {
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const ItemGroup: React.FC<MenuItemGroupProps> = ({ title, children, className }) => (
  <div role='group' aria-label={typeof title === 'string' ? title : undefined} className={className}>
    {title ? <div className='px-2 py-1 text-[10.5px] text-sv-faint'>{title}</div> : null}
    {withKeys(children)}
  </div>
);

export interface SubMenuProps {
  title?: React.ReactNode;
  children?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  triggerProps?: unknown;
  __menuKey?: MenuKey;
  'data-testid'?: string;
  'data-value'?: string;
}

const SubMenu: React.FC<SubMenuProps> = ({ title, children, disabled, className, triggerProps: _triggerProps, __menuKey: _menuKey, ...props }) => (
  <details className={cn('group/sub', className)} {...props}>
    <summary
      data-testid='submenu-title'
      className={cn(
        'flex min-h-8 cursor-pointer list-none items-center gap-2 rounded-[6px] px-2 py-1 text-[12px] text-sv-muted outline-none hover:bg-sv-surface hover:text-sv-text group-open/sub:text-sv-text [&::-webkit-details-marker]:hidden',
        disabled && 'pointer-events-none opacity-40'
      )}
    >
      <span className='min-w-0 flex-1'>{title}</span>
      <span aria-hidden='true' className='text-sv-faint transition-transform group-open/sub:rotate-90'>
        ›
      </span>
    </summary>
    <div role='group' data-testid='submenu-body' className='ml-2 border-l border-sv-line pl-1'>
      {withKeys(children)}
    </div>
  </details>
);

type MenuComponent = typeof MenuBase & {
  Item: typeof MenuItem;
  ItemGroup: typeof ItemGroup;
  SubMenu: typeof SubMenu;
};

export const Menu = Object.assign(MenuBase, { Item: MenuItem, ItemGroup, SubMenu }) as MenuComponent;
