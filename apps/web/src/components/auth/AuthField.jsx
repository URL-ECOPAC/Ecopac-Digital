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
          color: "#334155",
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
            backgroundColor: "#F8FAFC",
            border: error ? "1px solid #EF4444" : "1px solid #CBD5E1",
            borderRadius: "12px",
            outline: "none",
            boxSizing: "border-box",
            color: "#0F172A",
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
            color: "#EF4444",
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
