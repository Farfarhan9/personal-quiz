interface ToggleProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A large, full-row switch. The whole row is tappable. */
export function Toggle({ id, label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="toggle">
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="toggle__input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id} className="toggle__label">
        <span className="toggle__text">
          <span className="toggle__title">{label}</span>
          {description && <span className="toggle__desc">{description}</span>}
        </span>
        <span className="toggle__track" aria-hidden="true">
          <span className="toggle__thumb" />
        </span>
      </label>
    </div>
  );
}
