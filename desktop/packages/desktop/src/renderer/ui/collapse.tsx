import { ChevronRight } from 'lucide-react';
import * as React from 'react';
import { cn } from './cn';

type CollapseKey = string | number;

type CollapseContextValue = {
  active: CollapseKey[];
  toggle: (key: CollapseKey) => void;
};

const CollapseContext = React.createContext<CollapseContextValue | null>(null);

export interface CollapseProps {
  activeKey?: CollapseKey[];
  defaultActiveKey?: CollapseKey[];
  onChange?: (activeKey: CollapseKey[], activeKeys?: CollapseKey[]) => void;
  accordion?: boolean;
  bordered?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const CollapseBase: React.FC<CollapseProps> = ({
  activeKey,
  defaultActiveKey = [],
  onChange,
  accordion,
  bordered: _bordered,
  className,
  style,
  children,
}) => {
  const [uncontrolled, setUncontrolled] = React.useState<CollapseKey[]>(defaultActiveKey);
  const active = activeKey ?? uncontrolled;
  return (
    <CollapseContext.Provider
      value={{
        active,
        toggle: (key) => {
          const next = active.includes(key) ? active.filter((item) => item !== key) : accordion ? [key] : [...active, key];
          if (activeKey === undefined) setUncontrolled(next);
          onChange?.(next, next);
        },
      }}
    >
      <div className={cn('border-y border-sv-line', className)} style={style}>
        {children}
      </div>
    </CollapseContext.Provider>
  );
};

export interface CollapseItemProps {
  name?: CollapseKey;
  header?: React.ReactNode;
  extra?: React.ReactNode;
  disabled?: boolean;
  showExpandIcon?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const CollapseItem: React.FC<CollapseItemProps> = ({
  name,
  header,
  extra,
  disabled,
  showExpandIcon = true,
  className,
  style,
  children,
}) => {
  const context = React.useContext(CollapseContext);
  const generated = React.useId();
  const key = name ?? generated;
  const open = context?.active.includes(key) ?? false;
  return (
    <div className={cn('border-b border-sv-line last:border-b-0', className)} style={style}>
      <button
        type='button'
        disabled={disabled}
        aria-expanded={open}
        onClick={() => context?.toggle(key)}
        className='flex w-full items-center gap-2 px-1 py-2 text-left outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sv-focus disabled:cursor-not-allowed disabled:opacity-50'
      >
        {showExpandIcon ? (
          <ChevronRight
            className={cn('h-3.5 w-3.5 shrink-0 text-sv-muted transition-transform', open && 'rotate-90')}
            strokeWidth={1.75}
            aria-hidden='true'
          />
        ) : null}
        <span className='min-w-0 flex-1 text-[12px] text-sv-text'>{header}</span>
        {extra ? <span className='shrink-0 text-[12px] text-sv-muted'>{extra}</span> : null}
      </button>
      {open ? <div className='pb-2 pl-6 pr-1 text-[12px] text-sv-muted'>{children}</div> : null}
    </div>
  );
};

type CollapseComponent = typeof CollapseBase & { Item: typeof CollapseItem };

export const Collapse = Object.assign(CollapseBase, { Item: CollapseItem }) as CollapseComponent;
