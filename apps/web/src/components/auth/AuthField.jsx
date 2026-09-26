// Campo de formulario de las pantallas de autenticacion, con el mismo estilo que LoginPage.
// `rightAdornment` es el boton "Mostrar/Ocultar" de los campos de contrasena.

export default function AuthField({
  label,
  type = "text",
  autoComplete,
  placeholder,
  value,
  onChange,
  error,
  disabled,
  rightAdornment,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", textAlign: "left", width: "100%" }}>
      <label
        style={{
          display: "block",
          fontSize: "var(--texto-xs)",
          fontWeight: "var(--peso-semibold)",
          color: "var(--color-text)",
          marginBottom: "6px",
        }}
      >
        {label}
      </label>
      <div style={{ position: "relative", width: "100%" }}>
        <input
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          style={{
            width: "100%",
            display: "block",
            padding: rightAdornment ? "11px 65px 11px 14px" : "11px 14px",
            fontSize: "var(--texto-sm)",
            backgroundColor: "var(--color-background)",
            border: error ? "1px solid var(--color-danger)" : "1px solid var(--color-border)",
            borderRadius: "12px",
            outline: "none",
            boxSizing: "border-box",
            color: "var(--color-text)",
            transition: "all 0.2s ease",
          }}
        />
        {rightAdornment && (
          <div
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            {rightAdornment}
          </div>
        )}
      </div>
      {error && (
        <span
          style={{
            fontSize: "var(--texto-xxs)",
            fontWeight: "var(--peso-medium)",
            color: "var(--color-danger)",
            marginTop: "4px",
            display: "block",
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
