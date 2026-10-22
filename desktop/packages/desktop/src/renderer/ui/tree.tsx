import { ChevronRight } from 'lucide-react';
import * as React from 'react';
import { cn } from './cn';

export interface TreeNodeData {
  key?: string;
  title?: React.ReactNode;
  children?: TreeNodeData[];
  isLeaf?: boolean;
  [key: string]: unknown;
}

export interface TreeFieldNames {
  children?: string;
  title?: string;
  key?: string;
}

export interface TreeRenderNode {
  title: React.ReactNode;
  key: string;
  dataRef: TreeNodeData;
  isLeaf: boolean;
  children?: TreeNodeData[];
}

export interface TreeSelectExtra {
  node: { props: { dataRef: TreeNodeData } };
}

export interface TreeProps {
  treeData?: TreeNodeData[];
  fieldNames?: TreeFieldNames;
  expandedKeys?: string[];
  defaultExpandedKeys?: string[];
  selectedKeys?: string[];
  defaultSelectedKeys?: string[];
  onExpand?: (keys: string[], extra: { node: TreeRenderNode; expanded: boolean }) => void;
  onSelect?: (keys: string[], extra: TreeSelectExtra) => void;
  loadMore?: (node: TreeRenderNode) => Promise<void> | void;
  renderTitle?: (node: TreeRenderNode) => React.ReactNode;
  actionOnClick?: ('select' | 'expand')[];
  blockNode?: boolean;
  showLine?: boolean;
  className?: string;
  style?: React.CSSProperties;
  'data-testid'?: string;
}

const defaultFieldNames: Required<TreeFieldNames> = { children: 'children', title: 'title', key: 'key' };

export const Tree: React.FC<TreeProps> = ({
  treeData = [],
  fieldNames,
  expandedKeys,
  defaultExpandedKeys = [],
  selectedKeys,
  defaultSelectedKeys = [],
  onExpand,
  onSelect,
  loadMore,
  renderTitle,
  actionOnClick = ['select'],
  blockNode,
  showLine,
  className,
  style,
  'data-testid': testId,
}) => {
  const names = { ...defaultFieldNames, ...fieldNames };
  const [expandedState, setExpandedState] = React.useState<string[]>(defaultExpandedKeys);
  const [selectedState, setSelectedState] = React.useState<string[]>(defaultSelectedKeys);
  const expanded = expandedKeys ?? expandedState;
  const selected = selectedKeys ?? selectedState;

  const keyOf = (node: TreeNodeData, index: number): string => String(node[names.key] ?? index);
  const titleOf = (node: TreeNodeData): React.ReactNode => node[names.title] as React.ReactNode;
  const childrenOf = (node: TreeNodeData): TreeNodeData[] | undefined => node[names.children] as TreeNodeData[] | undefined;
  const leafOf = (node: TreeNodeData): boolean => node.isLeaf ?? !(childrenOf(node)?.length || loadMore);

  const setExpanded = (next: string[], node: TreeNodeData, expandedNow: boolean) => {
    if (expandedKeys === undefined) setExpandedState(next);
    onExpand?.(next, { node: renderNode(node, ''), expanded: expandedNow });
  };

  const renderNode = (node: TreeNodeData, key: string): TreeRenderNode => ({
    title: titleOf(node),
    key: String(node[names.key] ?? key),
    dataRef: node,
    isLeaf: leafOf(node),
    children: childrenOf(node),
  });

  const activate = async (node: TreeNodeData, key: string) => {
    const rendered = renderNode(node, key);
    if (actionOnClick.includes('select')) {
      if (selectedKeys === undefined) setSelectedState([key]);
      onSelect?.([key], { node: { props: { dataRef: node } } });
    }
    if (!actionOnClick.includes('expand')) return;
    const open = expanded.includes(key);
    if (open) {
      setExpanded(expanded.filter((item) => item !== key), node, false);
      return;
    }
    if (!childrenOf(node)?.length && loadMore) {
      await loadMore(rendered);
    }
    setExpanded([...expanded, key], node, true);
  };

  const renderLevel = (nodes: TreeNodeData[], level: number): React.ReactNode =>
    nodes.map((node, index) => {
      const key = keyOf(node, index);
      const open = expanded.includes(key);
      const isSelected = selected.includes(key);
      const children = childrenOf(node);
      const hasChildren = !leafOf(node);
      const rendered = renderNode(node, key);
      return (
        <div key={key}>
          <div
            role='treeitem'
            aria-level={level + 1}
            aria-expanded={hasChildren ? open : undefined}
            aria-selected={isSelected}
            data-key={key}
            className={cn(
              'arco-tree-node group flex min-h-7 cursor-pointer items-center gap-1 bg-transparent rounded-[var(--sv-r-control)] pr-1 text-[12px] outline-none',
              !hasChildren && 'is-leaf',
              isSelected
                ? 'arco-tree-node-selected bg-sv-selected text-sv-text'
                : 'text-sv-muted hover:bg-sv-surface hover:text-sv-text'
            )}
            onClick={(event) => {
              event.stopPropagation();
              void activate(node, key);
            }}
          >
            <span className='flex h-5 w-4 shrink-0 items-center justify-center' aria-hidden='true'>
              {hasChildren ? (
                <ChevronRight
                  className={cn('h-3 w-3 transition-transform', open && 'rotate-90')}
                  strokeWidth={1.75}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (open) setExpanded(expanded.filter((item) => item !== key), node, false);
                    else {
                      if (!children?.length && loadMore) void loadMore(rendered);
                      setExpanded([...expanded, key], node, true);
                    }
                  }}
                />
              ) : (
                <span className={cn('block h-3 border-l border-sv-line', showLine && 'ml-1')} />
              )}
            </span>
            <span
              className={cn(
                'arco-tree-node-title min-w-0 flex-1 truncate py-1',
                blockNode && 'arco-tree-node-title-block'
              )}
            >
              {renderTitle ? renderTitle(rendered) : titleOf(node)}
            </span>
          </div>
          {open && children?.length ? (
            <div role='group' className='ml-3 border-l border-sv-line pl-1'>
              {renderLevel(children, level + 1)}
            </div>
          ) : null}
        </div>
      );
    });

  return (
    <div role='tree' className={className} style={style} data-testid={testId}>
      {renderLevel(treeData, 0)}
    </div>
  );
};
