import { AlertCircle } from "lucide-react";
import { labels } from "../../features/competitions/config.js";
// Campos reutilizables: las etiquetas mantienen el nombre accesible de cada control.
function Notice({ children }) {
  return (
    children && (
      <div className="error-notice" role="alert">
        <AlertCircle size={18} />
        <span>{children}</span>
      </div>
    )
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  required = true,
  ...props
}) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        {...props}
      />
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
  required = true,
  placeholder = "Selecciona una opción",
  ...props
}) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((item) => (
          <option
            key={item.id ?? item}
            value={item.id ?? item}
            disabled={item.disabled}
          >
            {item.nombre ?? labels[item] ?? item}
          </option>
        ))}
      </select>
    </label>
  );
}
function TextArea({ label, value, onChange, required = false, ...props }) {
  return (
    <label>
      {label}
      <textarea
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        rows={3}
        maxLength={2000}
        {...props}
      />
    </label>
  );
}
function Checks({ label, values, options, onChange }) {
  return (
    <fieldset className="choice-field">
      <legend>{label}</legend>
      <div className="choice-options">
        {options.map((option) => (
          <label key={option}>
            <input
              type="checkbox"
              checked={values.includes(option)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...values, option]
                    : values.filter((value) => value !== option),
                )
              }
            />
            {labels[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export { Notice, Field, Select, TextArea, Checks };
