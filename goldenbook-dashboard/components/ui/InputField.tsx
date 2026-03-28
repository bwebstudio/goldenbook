interface InputFieldProps {
  label: string;
  hint?: string;
  error?: string;
  id: string;
  multiline?: boolean;
  rows?: number;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}

export default function InputField({
  label,
  hint,
  error,
  id,
  multiline = false,
  rows = 4,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: InputFieldProps) {
  const baseClass =
    "w-full rounded-xl border bg-surface px-5 py-4 text-lg text-text placeholder:text-[#B0AAA3] focus:outline-none focus:ring-2 transition resize-none";
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
      {multiline ? (
        <textarea
          id={id}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={fieldClass}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={!!error}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={fieldClass}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={!!error}
        />
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-600 font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
