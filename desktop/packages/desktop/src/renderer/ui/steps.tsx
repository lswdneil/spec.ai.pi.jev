import { Check } from 'lucide-react';
import * as React from 'react';
import { cn } from './cn';

export interface StepProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  status?: 'wait' | 'process' | 'finish' | 'error';
  className?: string;
  style?: React.CSSProperties;
}

const Step: React.FC<StepProps> = ({ className }) => <div className={className} />;

export interface StepsProps {
  current?: number;
  direction?: 'horizontal' | 'vertical';
  size?: 'small' | 'default';
  type?: 'default' | 'dot' | 'arrow' | 'navigation';
  labelPlacement?: 'horizontal' | 'vertical';
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const StepsBase: React.FC<StepsProps> = ({
  current = 0,
  direction = 'horizontal',
  size = 'default',
  className,
  style,
  children,
}) => {
  const steps = React.Children.toArray(children).filter(
    (child): child is React.ReactElement<StepProps> => React.isValidElement<StepProps>(child) && child.type === Step
  );
  return (
    <div className={cn('flex', direction === 'vertical' ? 'flex-col gap-3' : 'items-start', className)} style={style}>
      {steps.map((step, index) => {
        const status = step.props.status ?? (index < current ? 'finish' : index === current ? 'process' : 'wait');
        const active = status === 'finish' || status === 'process';
        return (
          <div key={index} className={cn('flex min-w-0 items-start gap-2', direction === 'horizontal' && 'flex-1')}>
            <div className='flex flex-col items-center'>
              <span
                className={cn(
                  'flex items-center justify-center rounded-full border text-[11px] font-medium',
                  size === 'small' ? 'h-5 w-5' : 'h-6 w-6',
                  status === 'finish' && 'border-sv-brand bg-sv-brand text-sv-on-brand',
                  status === 'process' && 'border-sv-brand text-sv-brand-ink',
                  status === 'wait' && 'border-sv-line text-sv-faint',
                  status === 'error' && 'border-sv-danger text-sv-danger'
                )}
              >
                {step.props.icon ??
                  (status === 'finish' ? <Check className='sv-icon-xs' strokeWidth={2.5} /> : index + 1)}
              </span>
              {direction === 'vertical' && index < steps.length - 1 ? (
                <span className='my-1 block h-4 w-px bg-sv-line' aria-hidden='true' />
              ) : null}
            </div>
            <div className='min-w-0 flex-1 pt-0.5'>
              <div className={cn('text-[12px] font-medium', active ? 'text-sv-text' : 'text-sv-muted')}>
                {step.props.title}
              </div>
              {step.props.description ? (
                <div className='mt-0.5 text-[11px] text-sv-faint'>{step.props.description}</div>
              ) : null}
            </div>
            {direction === 'horizontal' && index < steps.length - 1 ? (
              <span className='mt-3 block h-px flex-1 bg-sv-line' aria-hidden='true' />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

type StepsComponent = typeof StepsBase & { Step: typeof Step };

export const Steps = Object.assign(StepsBase, { Step }) as StepsComponent;
