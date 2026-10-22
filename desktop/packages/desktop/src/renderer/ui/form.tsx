import * as React from 'react';
import { cn } from './cn';

export type FormValues = Record<string, unknown>;

export interface FormRule {
  required?: boolean;
  message?: string;
  validator?: (value: unknown, values: FormValues) => string | undefined | Promise<string | undefined>;
}

export interface FormInstance {
  getFieldValue: (field: string) => unknown;
  setFieldValue: (field: string, value: unknown) => void;
  setFieldsValue: (values: FormValues) => void;
  getFieldsValue: () => FormValues;
  resetFields: (fields?: string[]) => void;
  validate: () => Promise<FormValues>;
  getFieldError: (field: string) => string | undefined;
  subscribe: (listener: () => void) => () => void;
  registerRules: (field: string, rules?: FormRule[]) => () => void;
}

type Store = {
  values: FormValues;
  errors: Record<string, string>;
  rules: Record<string, FormRule[]>;
};

const createForm = (): FormInstance => {
  const store: Store = { values: {}, errors: {}, rules: {} };
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    getFieldValue: (field) => store.values[field],
    setFieldValue: (field, value) => {
      store.values[field] = value;
      delete store.errors[field];
      notify();
    },
    setFieldsValue: (values) => {
      Object.assign(store.values, values);
      for (const field of Object.keys(values)) delete store.errors[field];
      notify();
    },
    getFieldsValue: () => ({ ...store.values }),
    resetFields: (fields) => {
      if (fields) {
        for (const field of fields) {
          delete store.values[field];
          delete store.errors[field];
        }
      } else {
        store.values = {};
        store.errors = {};
      }
      notify();
    },
    validate: async () => {
      const errors: Record<string, string> = {};
      for (const [field, rules] of Object.entries(store.rules)) {
        const value = store.values[field];
        for (const rule of rules) {
          if (rule.required && (value === undefined || value === null || value === '')) {
            errors[field] = rule.message ?? 'This field is required';
            break;
          }
          if (rule.validator) {
            const message = await rule.validator(value, store.values);
            if (message) {
              errors[field] = message;
              break;
            }
          }
        }
      }
      store.errors = errors;
      notify();
      if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
      return { ...store.values };
    },
    getFieldError: (field) => store.errors[field],
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    registerRules: (field, rules = []) => {
      store.rules[field] = rules;
      return () => {
        if (store.rules[field] === rules) delete store.rules[field];
      };
    },
  };
};

const FormContext = React.createContext<FormInstance | undefined>(undefined);

export interface FormProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  form?: FormInstance;
  layout?: 'horizontal' | 'vertical' | 'inline';
  initialValues?: FormValues;
  onValuesChange?: (values: FormValues, changed: FormValues) => void;
  children?: React.ReactNode;
}

const FormBase = React.forwardRef<HTMLFormElement, FormProps>(function Form(
  { form: provided, layout = 'horizontal', initialValues, onValuesChange, className, children, ...props },
  ref
) {
  const internal = React.useMemo(() => createForm(), []);
  const form = provided ?? internal;
  const [, force] = React.useReducer((value) => value + 1, 0);
  const initialized = React.useRef(false);
  React.useEffect(() => form.subscribe(force), [form]);
  React.useEffect(() => {
    if (initialized.current || !initialValues) return;
    initialized.current = true;
    form.setFieldsValue(initialValues);
  }, [form, initialValues]);
  React.useEffect(() => {
    if (!onValuesChange) return;
    return form.subscribe(() => onValuesChange(form.getFieldsValue(), form.getFieldsValue()));
  }, [form, onValuesChange]);
  return (
    <FormContext.Provider value={form}>
      <form
        ref={ref}
        className={cn('arco-form flex flex-col gap-3', layout === 'vertical' && 'arco-form-vertical', className)}
        onSubmit={(event) => event.preventDefault()}
        {...props}
      >
        {children}
      </form>
    </FormContext.Provider>
  );
});

export interface FormItemProps {
  field?: string;
  label?: React.ReactNode;
  extra?: React.ReactNode;
  rules?: FormRule[];
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode | ((value: unknown, form: FormInstance) => React.ReactNode);
}

const FormItem: React.FC<FormItemProps> = ({ field, label, extra, rules, className, style, children }) => {
  const form = React.useContext(FormContext);
  const [, force] = React.useReducer((value) => value + 1, 0);
  React.useEffect(() => {
    if (!form || !field) return;
    return form.subscribe(force);
  }, [field, form]);
  React.useEffect(() => {
    if (!form || !field) return;
    return form.registerRules(field, rules);
  }, [field, form, rules]);
  const value = field && form ? form.getFieldValue(field) : undefined;
  const error = field && form ? form.getFieldError(field) : undefined;
  let control = typeof children === 'function' ? form && children(value, form) : children;
  if (field && form && React.isValidElement(control)) {
    const element = control as React.ReactElement<{ value?: unknown; onChange?: (...args: unknown[]) => void }>;
    control = React.cloneElement(element, {
      value: element.props.value ?? value ?? '',
      onChange: (...args: unknown[]) => {
        form.setFieldValue(field, args[0]);
        element.props.onChange?.(...args);
      },
    });
  }
  return (
    <div className={cn('arco-form-item flex flex-col gap-1.5', className)} style={style}>
      {label ? <label className='arco-form-label-item text-[12px] font-medium text-sv-text'>{label}</label> : null}
      <div className='arco-form-item-control-wrapper min-w-0'>{control}</div>
      {error ? <div className='arco-form-message text-[11px] text-sv-danger'>{error}</div> : null}
      {extra ? <div className='text-[11px] text-sv-faint'>{extra}</div> : null}
    </div>
  );
};

type FormComponent = typeof FormBase & {
  Item: typeof FormItem;
  useForm: (form?: FormInstance) => [FormInstance];
};

export const Form = Object.assign(FormBase, {
  Item: FormItem,
  useForm: (form?: FormInstance): [FormInstance] => {
    const ref = React.useRef<FormInstance>(form ?? createForm());
    return [ref.current];
  },
}) as FormComponent;
