import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { cn } from './cn';

export interface PaginationProps {
  current?: number;
  pageSize?: number;
  total?: number;
  simple?: boolean;
  showTotal?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onChange?: (page: number) => void;
  'aria-label'?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  current = 1,
  pageSize = 10,
  total = 0,
  simple,
  showTotal,
  className,
  style,
  onChange,
  'aria-label': ariaLabel = 'Pagination',
}) => {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  if (pages <= 1) return null;
  const go = (page: number) => onChange?.(Math.min(pages, Math.max(1, page)));
  return (
    <nav aria-label={ariaLabel} className={cn('flex items-center justify-end gap-2 text-[11px] text-sv-muted', className)} style={style}>
      {showTotal ? <span>{`${total} total`}</span> : null}
      <button
        type='button'
        aria-label='Previous page'
        disabled={current <= 1}
        onClick={() => go(current - 1)}
        className='flex h-6 w-6 items-center justify-center rounded-[6px] border border-sv-line text-sv-muted outline-none transition-colors hover:text-sv-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sv-focus disabled:cursor-not-allowed disabled:opacity-40'
      >
        <ChevronLeft className='h-3.5 w-3.5' strokeWidth={1.75} />
      </button>
      {simple ? (
        <span className='tabular-nums'>
          {current} / {pages}
        </span>
      ) : (
        <span className='tabular-nums'>{`${current} / ${pages}`}</span>
      )}
      <button
        type='button'
        aria-label='Next page'
        disabled={current >= pages}
        onClick={() => go(current + 1)}
        className='flex h-6 w-6 items-center justify-center rounded-[6px] border border-sv-line text-sv-muted outline-none transition-colors hover:text-sv-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sv-focus disabled:cursor-not-allowed disabled:opacity-40'
      >
        <ChevronRight className='h-3.5 w-3.5' strokeWidth={1.75} />
      </button>
    </nav>
  );
};
