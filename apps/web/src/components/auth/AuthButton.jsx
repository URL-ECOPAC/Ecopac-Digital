// Boton principal verde de las pantallas de autenticacion, con el mismo estilo que LoginPage.

export default function AuthButton({ children, disabled, type = "submit" }) {
  return (
    <button
      type={type}
      disabled={disabled}
      style={{
        width: "100%",
        display: "block",
        padding: "12px",
        backgroundColor: "var(--color-success)",
        color: "var(--color-surface)",
        fontWeight: "var(--peso-bold)",
        fontSize: "var(--texto-sm)",
        border: "none",
        borderRadius: "9999px",
        boxShadow: "0 10px 15px -3px color-mix(in srgb, var(--color-success) 35%, transparent)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
        transition: "background-color 0.2s ease, transform 0.1s ease",
      }}
    >
      {children}
    </button>
  );
}
