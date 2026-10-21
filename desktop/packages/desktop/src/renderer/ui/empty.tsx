import { Inbox } from 'lucide-react';
import * as React from 'react';
import { cn } from './cn';

export interface EmptyProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const Empty: React.FC<EmptyProps> = ({ title, description, action, icon, className }) => (
  <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-10 text-center', className)}>
    <div className='flex h-9 w-9 items-center justify-center rounded-full border border-sv-line bg-sv-surface text-sv-faint'>
      {icon ?? <Inbox className='h-4 w-4' aria-hidden='true' />}
    </div>
    {title ? <p className='text-[13px] font-medium text-sv-text'>{title}</p> : null}
    {description ? <p className='max-w-[360px] text-[12px] leading-[1.6] text-sv-muted'>{description}</p> : null}
    {action ? <div className='mt-1'>{action}</div> : null}
  </div>
);
