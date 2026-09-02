// Banner de error/exito de las pantallas de autenticacion, con el mismo estilo que LoginPage.

const VARIANTES = {
  error: { backgroundColor: "#FEF2F2", border: "1px solid #FEE2E2", color: "#DC2626" },
  success: { backgroundColor: "#F0FDF4", border: "1px solid #DCFCE7", color: "#16A34A" },
};

export default function AuthAlert({ children, variant = "error" }) {
  return (
    <div
      role="alert"
      style={{
        marginBottom: "16px",
        padding: "10px 14px",
        borderRadius: "12px",
        fontSize: "12px",
        textAlign: "center",
        fontWeight: "500",
        ...VARIANTES[variant],
      }}
    >
      {children}
    </div>
  );
}
