// Envoltorio visual compartido por las pantallas de autenticacion (login, restablecer
// contrasena, nueva contrasena): fondo degradado, tarjeta blanca centrada y responsive, y el
// isotipo de EcoPac con titulo/subtitulo. Vive fuera de components/index.js a proposito: ese
// catalogo replica el de apps/mobile/src/components (docs/ARQUITECTURA-FRONTEND.md) y estas
// pantallas son bespoke de la web, igual que ya lo era LoginPage antes de esta extraccion.

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        backgroundColor: "#EFF6FF",
        backgroundImage: "linear-gradient(135deg, #F0FDF4 0%, #E0F2FE 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px",
        boxSizing: "border-box",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          margin: "0 auto",
          backgroundColor: "#FFFFFF",
          borderRadius: "24px",
          padding: "36px 28px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
          border: "1px solid #E2E8F0",
          boxSizing: "border-box",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "4px",
                width: "28px",
                height: "28px",
              }}
            >
              <span
                style={{
                  backgroundColor: "#22C55E",
                  borderRadius: "50%",
                  width: "12px",
                  height: "12px",
                }}
              ></span>
              <span
                style={{
                  backgroundColor: "#3B82F6",
                  borderRadius: "50%",
                  width: "12px",
                  height: "12px",
                }}
              ></span>
              <span
                style={{
                  backgroundColor: "#F59E0B",
                  borderRadius: "50%",
                  width: "12px",
                  height: "12px",
                }}
              ></span>
              <span
                style={{
                  backgroundColor: "#EC4899",
                  borderRadius: "50%",
                  width: "12px",
                  height: "12px",
                }}
              ></span>
            </div>
            <div style={{ textAlign: "left" }}>
              <span
                style={{
                  display: "block",
                  fontSize: "22px",
                  fontWeight: "800",
                  color: "#1E293B",
                  lineHeight: "1",
                }}
              >
                EcoPac
              </span>
            </div>
          </div>

          <h2
            style={{
              fontSize: "20px",
              fontWeight: "700",
              color: "#0F172A",
              margin: "14px 0 4px 0",
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p style={{ fontSize: "13px", color: "#64748B", margin: "0" }}>{subtitle}</p>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
