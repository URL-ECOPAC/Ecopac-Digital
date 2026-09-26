// Banner de error/exito de las pantallas de autenticacion, con el mismo estilo que LoginPage.

const VARIANTES = {
  error: {
    backgroundColor: "color-mix(in srgb, var(--color-danger) 8%, var(--color-surface))",
    border: "1px solid color-mix(in srgb, var(--color-danger) 25%, var(--color-surface))",
    color: "var(--color-danger)",
  },
  success: {
    backgroundColor: "color-mix(in srgb, var(--color-success) 8%, var(--color-surface))",
    border: "1px solid color-mix(in srgb, var(--color-success) 25%, var(--color-surface))",
    color: "var(--color-success)",
  },
  // Aviso que no es un error: la sesion se cerro por inactividad. Con tokens, no con hex.
  info: {
    backgroundColor: "color-mix(in srgb, var(--color-info) 10%, var(--color-surface))",
    border: "1px solid color-mix(in srgb, var(--color-info) 28%, var(--color-surface))",
    color: "var(--color-info)",
  },
};

export default function AuthAlert({ children, variant = "error" }) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      style={{
        marginBottom: "16px",
        padding: "10px 14px",
        borderRadius: "12px",
        fontSize: "var(--texto-xs)",
        textAlign: "center",
        fontWeight: "var(--peso-medium)",
        ...VARIANTES[variant],
      }}
    >
      {children}
    </div>
  );
}
