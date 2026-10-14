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
        backgroundImage:
          "linear-gradient(135deg, color-mix(in srgb, var(--color-success) 12%, white) 0%, " +
          "color-mix(in srgb, var(--color-info) 12%, white) 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          margin: "0 auto",
          backgroundColor: "var(--color-surface)",
          borderRadius: "24px",
          padding: "36px 28px",
          boxShadow: "var(--sombra-lg)",
          border: "1px solid var(--color-border)",
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
            {/* Los cuatro puntos son los cuatro colores del logo de EcoPac (verde, azul,
                naranja, magenta), los mismos que moduleAccents reparte por modulo -- issue #700. */}
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
                  backgroundColor: "var(--color-success)",
                  borderRadius: "50%",
                  width: "12px",
                  height: "12px",
                }}
              ></span>
              <span
                style={{
                  backgroundColor: "var(--color-info)",
                  borderRadius: "50%",
                  width: "12px",
                  height: "12px",
                }}
              ></span>
              <span
                style={{
                  backgroundColor: "var(--color-warning)",
                  borderRadius: "50%",
                  width: "12px",
                  height: "12px",
                }}
              ></span>
              <span
                style={{
                  backgroundColor: "var(--color-danger)",
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
                  fontSize: "var(--texto-lg)",
                  fontWeight: "var(--peso-bold)",
                  color: "var(--color-text)",
                  lineHeight: "1",
                }}
              >
                EcoPac
              </span>
            </div>
          </div>

          <h2
            style={{
              fontSize: "var(--texto-lg)",
              fontWeight: "var(--peso-bold)",
              color: "var(--color-text)",
              margin: "14px 0 4px 0",
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              style={{ fontSize: "var(--texto-xs)", color: "var(--color-text-muted)", margin: "0" }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
