interface SelectFieldProps {
  label: string;
  hint?: string;
  error?: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}

export default function SelectField({
  label,
  hint,
  error,
  id,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  required = false,
}: SelectFieldProps) {
  const baseClass =
    "w-full rounded-xl border bg-surface px-5 py-4 text-lg text-text focus:outline-none focus:ring-2 transition appearance-none cursor-pointer";
  const normalBorder = "border-border focus:border-gold focus:ring-gold/20";
  const errorBorder  = "border-red-300 focus:border-red-400 focus:ring-red-200";
  const fieldClass   = `${baseClass} ${error ? errorBorder : normalBorder}`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-semibold text-text">
        {label}
        {required && <span className="text-gold ml-1">*</span>}
      </label>
      {hint && <p className="text-sm text-muted -mt-1">{hint}</p>}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={!!error}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-600 font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
