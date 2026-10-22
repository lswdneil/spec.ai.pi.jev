import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, ChevronDown, X } from 'lucide-react';
import * as React from 'react';
import { cn } from './cn';

export type SelectValue = string | number;

export interface SelectOptionProps {
  value: SelectValue;
  children?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  wrapperClassName?: string;
  title?: string;
  'data-label'?: string;
}

/** Declarative option; Select reads its value and label. */
const Option: React.FC<SelectOptionProps> = () => null;

export interface SelectOptGroupProps {
  label?: React.ReactNode;
  children?: React.ReactNode;
}

const OptGroup: React.FC<SelectOptGroupProps> = () => null;

type ParsedOption = { value: SelectValue; label: React.ReactNode; disabled?: boolean };

const walk = (children: React.ReactNode, out: ParsedOption[], groups: { label: React.ReactNode; options: ParsedOption[] }[]) => {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as { value?: SelectValue; children?: React.ReactNode; disabled?: boolean; label?: React.ReactNode };
    if (child.type === Option && props.value !== undefined) {
      out.push({ value: props.value, label: props.children ?? String(props.value), disabled: props.disabled });
      return;
    }
    if (child.type === OptGroup) {
      const inner: ParsedOption[] = [];
      walk(props.children, inner, []);
      groups.push({ label: props.label, options: inner });
      out.push(...inner);
      return;
    }
    walk(props.children, out, groups);
  });
};

export interface SelectProps {
  value?: SelectValue | SelectValue[];
  defaultValue?: SelectValue | SelectValue[];
  onChange?: (value: any, option?: any) => void;
  placeholder?: React.ReactNode;
  disabled?: boolean;
  mode?: 'single' | 'multiple';
  allowClear?: boolean;
  size?: 'mini' | 'small' | 'default' | 'large';
  className?: string;
  style?: React.CSSProperties;
  renderFormat?: (option: ParsedOption | undefined, value: SelectValue | SelectValue[] | undefined) => React.ReactNode;
  dropdownRender?: (menu: React.ReactNode) => React.ReactNode;
  onVisibleChange?: (visible: boolean) => void;
  getPopupContainer?: (node: HTMLElement) => Element;
  options?: { label: React.ReactNode; value: SelectValue; disabled?: boolean }[];
  children?: React.ReactNode;
  'aria-label'?: string;
  'data-testid'?: string;
  notFoundContent?: React.ReactNode;
  showSearch?: boolean;
  filterOption?: unknown;
  onClear?: () => void;
  renderTag?: (props: { label: React.ReactNode; value: SelectValue }) => React.ReactNode;
  onSearch?: (value: string) => void;
  triggerProps?: unknown;
  popupVisible?: boolean;
  virtualListProps?: unknown;
  allowCreate?: boolean;
  defaultActiveFirstOption?: boolean;
  labelInValue?: boolean;
  loading?: boolean;
  unmountOnExit?: boolean;
  dropdownMenuStyle?: React.CSSProperties;
  inputValue?: string;
  onInputValueChange?: (value: string) => void;
  maxTagCount?: number | 'responsive' | { count: number; render: () => React.ReactNode };
}

export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    value,
    defaultValue,
    onChange,
    placeholder = 'Select',
    disabled,
    mode = 'single',
    allowClear,
    size = 'default',
    className,
    style,
    renderFormat,
    dropdownRender,
    onVisibleChange,
    getPopupContainer,
    options,
    children,
    'aria-label': ariaLabel,
    'data-testid': testId,
  },
  ref
) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const portalContainer = getPopupContainer && triggerRef.current ? getPopupContainer(triggerRef.current) : undefined;
  const parsed: ParsedOption[] = [];
  const groups: { label: React.ReactNode; options: ParsedOption[] }[] = [];
  walk(children, parsed, groups);
  for (const option of options ?? []) parsed.push(option);
  const [uncontrolled, setUncontrolled] = React.useState<SelectValue | SelectValue[] | undefined>(defaultValue);
  const current = value ?? uncontrolled;
  const selectedValues = new Set(Array.isArray(current) ? current : current === undefined ? [] : [current]);
  const selected = parsed.filter((option) => selectedValues.has(option.value));
  const groupedValues = new Set(groups.flatMap((group) => group.options.map((option) => option.value)));
  const small = size === 'mini' || size === 'small';
  const text =
    renderFormat?.(mode === 'multiple' ? undefined : selected[0], current) ??
    (selected.length
      ? selected.map((option) => option.label).reduce<React.ReactNode[]>((all, label, index) => {
          if (index) all.push(', ');
          all.push(label);
          return all;
        }, [])
      : placeholder);
  const commit = (next: SelectValue | SelectValue[]) => {
    if (value === undefined) setUncontrolled(next);
    const asOptions = parsed.filter((option) =>
      Array.isArray(next) ? next.includes(option.value) : option.value === next
    );
    onChange?.(next, Array.isArray(next) ? asOptions : asOptions[0]);
  };
  const pick = (option: ParsedOption) => {
    if (mode === 'multiple') {
      const next = new Set(selectedValues);
      if (next.has(option.value)) next.delete(option.value);
      else next.add(option.value);
      commit([...next]);
      return;
    }
    commit(option.value);
    setOpen(false);
  };
  const menu = (
    <div role='listbox' aria-multiselectable={mode === 'multiple' || undefined}>
      {groups.map((group, index) => (
        <div key={index}>
          {group.label ? <div className='px-2 py-1 text-[10.5px] text-sv-faint'>{group.label}</div> : null}
          {group.options.map((option) => (
            <OptionRow
              key={String(option.value)}
              option={option}
              selected={selectedValues.has(option.value)}
              multiple={mode === 'multiple'}
              onPick={() => pick(option)}
            />
          ))}
        </div>
      ))}
      {parsed
        .filter((option) => !groupedValues.has(option.value))
        .map((option) => (
          <OptionRow
            key={String(option.value)}
            option={option}
            selected={selectedValues.has(option.value)}
            multiple={mode === 'multiple'}
            onPick={() => pick(option)}
          />
        ))}
    </div>
  );
  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onVisibleChange?.(next);
      }}
    >
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <button
          ref={(node) => {
            triggerRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          type='button'
          role='combobox'
          aria-expanded={open}
          aria-label={ariaLabel}
          data-testid={testId}
          disabled={disabled}
          className={cn(
            'inline-flex min-w-0 max-w-full items-center gap-1 rounded-[6px] border border-sv-line bg-sv-surface px-2 text-left text-[12px] text-sv-text outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sv-focus disabled:cursor-not-allowed disabled:opacity-50',
            'arco-select',
            disabled && 'arco-select-disabled',
            small ? 'h-7' : 'h-8',
            className
          )}
          style={style}
        >
          <span className={cn('min-w-0 flex-1 truncate', !selected.length && 'text-sv-muted')}>{text}</span>
          {allowClear && selected.length ? (
            <span
              role='button'
              aria-label='Clear'
              className='flex h-3.5 w-3.5 items-center justify-center rounded-full text-sv-muted hover:bg-sv-raised hover:text-sv-text'
              onClick={(event) => {
                event.stopPropagation();
                commit(mode === 'multiple' ? [] : undefined);
              }}
            >
              <X className='h-3 w-3' />
            </span>
          ) : null}
          <ChevronDown className='h-3 w-3 shrink-0 text-sv-muted' aria-hidden='true' />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={portalContainer}>
        <PopoverPrimitive.Content
          side='bottom'
          align='start'
          sideOffset={6}
          className='z-[70] max-h-[280px] min-w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-[var(--sv-r-popup)] border border-sv-line bg-sv-popover p-1 text-[12px] text-sv-text outline-none'
        >
          {dropdownRender ? dropdownRender(menu) : menu}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
});

const OptionRow: React.FC<{
  option: ParsedOption;
  selected: boolean;
  multiple: boolean;
  onPick: () => void;
}> = ({ option, selected, multiple, onPick }) => (
  <button
    type='button'
    role='option'
    aria-selected={selected}
    disabled={option.disabled}
    onClick={onPick}
    className={cn(
      'arco-select-option flex h-7 w-full items-center gap-2 rounded-[6px] px-2 text-left outline-none hover:bg-sv-surface focus-visible:bg-sv-surface disabled:cursor-not-allowed disabled:opacity-40',
      selected ? 'text-sv-text' : 'text-sv-muted'
    )}
  >
    <span className='flex-1 truncate'>{option.label}</span>
    {selected ? <Check className='h-3.5 w-3.5 text-sv-brand-ink' aria-hidden='true' /> : null}
    {multiple && selected ? <span className='sr-only'>selected</span> : null}
  </button>
);

type SelectComponent = typeof Select & { Option: typeof Option; OptGroup: typeof OptGroup };

export const SelectWithOptions = Object.assign(Select, { Option, OptGroup }) as SelectComponent;
export { Option as SelectOption, OptGroup as SelectOptGroup };
