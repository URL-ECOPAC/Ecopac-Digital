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
        backgroundColor: "#22C55E",
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: "14px",
        border: "none",
        borderRadius: "9999px",
        boxShadow: "0 10px 15px -3px rgba(34, 197, 94, 0.35)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
        transition: "background-color 0.2s ease, transform 0.1s ease",
      }}
    >
      {children}
    </button>
  );
}
