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
  /** Text a filter may match beyond the value, such as a model's name. */
  extra?: unknown;
  'data-label'?: string;
}

/** Declarative option; Select reads its value and label. */
const Option: React.FC<SelectOptionProps> = () => null;

export interface SelectOptGroupProps {
  label?: React.ReactNode;
  children?: React.ReactNode;
}

const OptGroup: React.FC<SelectOptGroupProps> = () => null;

type ParsedOption = { value: SelectValue; label: React.ReactNode; disabled?: boolean; extra?: unknown };

const labelText = (option: ParsedOption) =>
  typeof option.label === 'string' || typeof option.label === 'number'
    ? String(option.label)
    : String(option.value);

const walk = (children: React.ReactNode, out: ParsedOption[], groups: { label: React.ReactNode; options: ParsedOption[] }[]) => {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as {
      value?: SelectValue;
      children?: React.ReactNode;
      disabled?: boolean;
      label?: React.ReactNode;
      extra?: unknown;
    };
    if (child.type === Option && props.value !== undefined) {
      out.push({
        value: props.value,
        label: props.children ?? String(props.value),
        disabled: props.disabled,
        extra: props.extra,
      });
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
  options?: Array<
    { label: React.ReactNode; value: SelectValue; disabled?: boolean; extra?: unknown } | string | number
  >;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  children?: React.ReactNode;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'data-testid'?: string;
  notFoundContent?: React.ReactNode;
  showSearch?: boolean;
  filterOption?: (inputValue: string, option: React.ReactElement<{ children?: React.ReactNode; value?: unknown }>) => boolean;
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
    prefix,
    suffix,
    children,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'data-testid': testId,
    notFoundContent,
    showSearch,
    filterOption,
    allowCreate,
    onSearch,
    popupVisible,
    loading,
  },
  ref
) {
  const [innerOpen, setInnerOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const open = popupVisible ?? innerOpen;
  const setOpen = (next: boolean) => {
    if (popupVisible === undefined) setInnerOpen(next);
    onVisibleChange?.(next);
    if (!next) setQuery('');
  };
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const portalContainer = getPopupContainer && triggerRef.current ? getPopupContainer(triggerRef.current) : undefined;
  const parsed: ParsedOption[] = [];
  const groups: { label: React.ReactNode; options: ParsedOption[] }[] = [];
  walk(children, parsed, groups);
  for (const option of options ?? []) {
    parsed.push(
      typeof option === 'object'
        ? { value: option.value, label: option.label, disabled: option.disabled, extra: option.extra }
        : { value: option, label: option }
    );
  }
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
  const commit = (next: SelectValue | SelectValue[] | undefined) => {
    if (value === undefined) setUncontrolled(next);
    const values = Array.isArray(next) ? next : next === undefined ? [] : [next];
    const asOptions = parsed.filter((option) => values.includes(option.value));
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
  const normalizedQuery = query.trim().toLowerCase();
  const matches = (option: ParsedOption) => {
    if (!showSearch || !normalizedQuery) return true;
    if (filterOption) {
      return filterOption(query, {
        props: { children: option.label, value: option.value, extra: option.extra },
      } as unknown as React.ReactElement<{ children?: React.ReactNode; value?: unknown }>);
    }
    return labelText(option).toLowerCase().includes(normalizedQuery);
  };
  const visibleGroups = groups
    .map((group) => ({ label: group.label, options: group.options.filter(matches) }))
    .filter((group) => group.options.length > 0);
  const visibleLoose = parsed.filter((option) => !groupedValues.has(option.value) && matches(option));
  const canCreate =
    Boolean(allowCreate) &&
    normalizedQuery.length > 0 &&
    !parsed.some((option) => String(option.value).toLowerCase() === normalizedQuery);
  const createOption: ParsedOption | undefined = canCreate
    ? { value: query.trim(), label: `Create "${query.trim()}"` }
    : undefined;
  const menu = (
    <>
      {showSearch ? (
        <div className='p-1 pb-0'>
          <input
            aria-label={ariaLabel ? `${ariaLabel} search` : 'Search options'}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              onSearch?.(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
              }
            }}
            placeholder={ariaLabel ? `${ariaLabel} search` : 'Search'}
            className='h-7 w-full rounded-[var(--sv-r-control)] border border-sv-line bg-sv-input px-2 text-[12px] text-sv-text outline-none placeholder:text-sv-placeholder focus:border-sv-line-strong'
          />
        </div>
      ) : null}
      <div role='listbox' aria-multiselectable={mode === 'multiple' || undefined}>
        {visibleGroups.map((group, index) => (
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
        {visibleLoose.map((option) => (
          <OptionRow
            key={String(option.value)}
            option={option}
            selected={selectedValues.has(option.value)}
            multiple={mode === 'multiple'}
            onPick={() => pick(option)}
          />
        ))}
        {createOption ? (
          <OptionRow
            option={createOption}
            selected={selectedValues.has(createOption.value)}
            multiple={mode === 'multiple'}
            onPick={() => pick(createOption)}
          />
        ) : null}
        {!visibleGroups.length && !visibleLoose.length && !createOption ? (
          <div className='px-2 py-2 text-[11.5px] text-sv-muted'>
            {loading ? 'Loading...' : (notFoundContent ?? 'No options')}
          </div>
        ) : null}
      </div>
    </>
  );
  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
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
          aria-labelledby={ariaLabelledBy}
          data-testid={testId}
          disabled={disabled}
          className={cn(
            'inline-flex min-w-0 max-w-full items-center gap-1 rounded-[var(--sv-r-control)] border border-sv-line bg-sv-surface px-2 text-left text-[12px] text-sv-text outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sv-focus disabled:cursor-not-allowed disabled:opacity-50',
            'arco-select',
            disabled && 'arco-select-disabled',
            mode === 'multiple' && selected.length ? 'h-auto min-h-7 flex-wrap py-1' : small ? 'h-7' : 'h-8',
            className
          )}
          style={style}
        >
          {prefix ? <span className='shrink-0 text-sv-muted'>{prefix}</span> : null}
          {mode === 'multiple' && selected.length ? (
            <span className='flex min-w-0 flex-1 flex-wrap items-center gap-1'>
              {selected.map((option) => (
                <span
                  key={String(option.value)}
                  className='arco-tag inline-flex h-5 max-w-full items-center truncate rounded-[4px] bg-sv-raised px-1.5 text-[11px] text-sv-text'
                >
                  {option.label}
                </span>
              ))}
            </span>
          ) : (
            <span
              className={cn(
                'arco-select-view-value min-w-0 flex-1 truncate',
                !selected.length && 'text-sv-muted'
              )}
            >
              {text}
            </span>
          )}
          {suffix ? <span className='shrink-0 text-sv-muted'>{suffix}</span> : null}
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
      'arco-select-option flex h-7 w-full items-center gap-2 bg-transparent rounded-[6px] px-2 text-left outline-none hover:bg-sv-surface focus-visible:bg-sv-surface disabled:cursor-not-allowed disabled:opacity-40',
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
