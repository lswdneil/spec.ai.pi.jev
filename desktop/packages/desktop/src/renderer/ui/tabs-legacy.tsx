import * as React from 'react';
import { cn } from './cn';

type TabKey = string;

export interface TabPaneProps {
  title?: React.ReactNode;
  children?: React.ReactNode;
  disabled?: boolean;
}

/** Arco's declarative tab pane; the parent Tabs reads its key and title. */
const TabPane: React.FC<TabPaneProps> = ({ children }) => <>{children}</>;

export interface TabsProps {
  activeTab?: TabKey;
  defaultActiveTab?: TabKey;
  onChange?: (key: TabKey) => void;
  size?: 'mini' | 'small' | 'default' | 'large';
  type?: 'line' | 'card' | 'text' | 'rounded';
  className?: string;
  children?: React.ReactNode;
}

const keyOf = (child: React.ReactNode, index: number): TabKey => {
  if (React.isValidElement(child) && child.key != null) {
    return String(child.key).replace(/^\.\$/, '').replace(/^\./, '');
  }
  return String(index);
};

const LegacyTabsBase: React.FC<TabsProps> = ({
  activeTab,
  defaultActiveTab,
  onChange,
  size = 'default',
  type: _type,
  className,
  children,
}) => {
  const panes = React.Children.toArray(children).filter(
    (child): child is React.ReactElement<TabPaneProps> =>
      React.isValidElement<TabPaneProps>(child) && child.type === TabPane
  );
  const keys = panes.map((pane, index) => keyOf(pane, index));
  const [uncontrolled, setUncontrolled] = React.useState<TabKey>(defaultActiveTab ?? keys[0] ?? '');
  const current = activeTab ?? uncontrolled;
  return (
    <div className={className}>
      <div role='tablist' className='flex items-center gap-3 border-b border-sv-line'>
        {panes.map((pane, index) => {
          const key = keys[index];
          const selected = key === current;
          return (
            <button
              key={key}
              type='button'
              role='tab'
              aria-selected={selected}
              disabled={pane.props.disabled}
              onClick={() => {
                if (activeTab === undefined) setUncontrolled(key);
                onChange?.(key);
              }}
              className={cn(
                'relative inline-flex items-center pb-1.5 text-sv-muted outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sv-focus disabled:cursor-not-allowed disabled:opacity-50',
                size === 'mini' || size === 'small' ? 'text-[11.5px]' : 'text-[12px]',
                selected && 'text-sv-text after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-sv-text'
              )}
            >
              {pane.props.title}
            </button>
          );
        })}
      </div>
      <div role='tabpanel' className='pt-2'>
        {panes.find((_, index) => keys[index] === current)?.props.children}
      </div>
    </div>
  );
};

type LegacyTabsComponent = typeof LegacyTabsBase & { TabPane: typeof TabPane };

export const Tabs = Object.assign(LegacyTabsBase, { TabPane }) as LegacyTabsComponent;
export { Tabs as LegacyTabs };
