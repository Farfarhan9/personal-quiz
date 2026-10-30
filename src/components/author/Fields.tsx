import type { ReactNode } from 'react';

interface BaseFieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  required?: boolean;
  invalid?: boolean;
}

interface TextFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'color' | 'url';
  monospace?: boolean;
}

export function TextField({ id, label, hint, required, invalid, value, onChange, placeholder, type = 'text', monospace }: TextFieldProps) {
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
        {required && <span className="field__req"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        className={`input ${monospace ? 'input--mono' : ''} ${type === 'color' ? 'input--color' : ''}`}
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        autoComplete="off"
        autoCapitalize={monospace ? 'off' : 'sentences'}
        spellCheck={!monospace}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      )}
    </div>
  );
}

interface TextAreaFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export function TextAreaField({ id, label, hint, required, invalid, value, onChange, placeholder, rows = 3 }: TextAreaFieldProps) {
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
        {required && <span className="field__req"> *</span>}
      </label>
      <textarea
        id={id}
        className="input textarea"
        rows={rows}
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      )}
    </div>
  );
}

interface SelectFieldProps<T extends string> extends BaseFieldProps {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function SelectField<T extends string>({ id, label, hint, value, options, onChange }: SelectFieldProps<T>) {
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <select
        id={id}
        className="input select"
        value={value}
        onChange={(e) => {
          const found = options.find((o) => o.value === e.target.value);
          if (found) onChange(found.value);
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}
