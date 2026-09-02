import { Link } from "react-router-dom";
import { useDashboardMetricas } from "../../../../packages/shared/reportes/useDashboardMetricas.js";
import { CAMPOS_DASHBOARD, COLORES_GRAFICAS } from "../../../../packages/shared/reportes/dashboard.campos.js";
// Tarjeta de indicador principal
const TarjetaIndicador = ({ etiqueta, valor, color = "#059669" }) => (
  <div style={{
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "20px",
    border: "1px solid #f1f5f9",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  }}>
    <p style={{
      margin: 0,
      fontSize: "12px",
      fontWeight: "700",
      color: "#64748b",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    }}>
      {etiqueta}
    </p>
    <h3 style={{
      margin: "8px 0 0 0",
      fontSize: "32px",
      fontWeight: "800",
      color: color,
    }}>
      {valor?.toLocaleString("es-GT")}
    </h3>
  </div>
);

// Tarjeta de aviso con enlace
const TarjetaAviso = ({ etiqueta, valor, enlace, color }) => (
  <Link to={enlace} style={{ textDecoration: "none" }}>
    <div style={{
      backgroundColor: "#ffffff",
      borderRadius: "12px",
      padding: "16px",
      borderLeft: `4px solid ${color}`,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}>
      <span style={{ fontSize: "14px", fontWeight: "600", color: "#334155" }}>
        {etiqueta}
      </span>
      <span style={{
        backgroundColor: color + "15",
        color: color,
        padding: "4px 12px",
        borderRadius: "9999px",
        fontSize: "13px",
        fontWeight: "800",
      }}>
        {valor}
      </span>
    </div>
  </Link>
);

// Gráfica de barras
const GraficaBarras = ({ datos, etiquetaX, etiquetaY, color = "#059669", titulo }) => {
  if (!datos || datos.length === 0) {
    return (
      <div style={{
        backgroundColor: "#fff",
        borderRadius: "16px",
        padding: "20px",
        border: "1px solid #f1f5f9",
        textAlign: "center",
        color: "#94a3b8",
      }}>
        {titulo}<br />Sin datos disponibles
      </div>
    );
  }

  const maxValor = Math.max(...datos.map(d => d[etiquetaY]));

  return (
    <div style={{
      backgroundColor: "#fff",
      borderRadius: "16px",
      padding: "20px",
      border: "1px solid #f1f5f9",
    }}>
      <h4 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "700", color: "#334155" }}>
        {titulo}
      </h4>
      <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", height: "180px" }}>
        {datos.map((item, i) => {
          const valor = item[etiquetaY];
          const porcentaje = maxValor > 0 ? (valor / maxValor) * 100 : 0;
          const colorBarra = Array.isArray(color) ? color[i % color.length] : color;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: "10px", fontWeight: "700", marginBottom: "4px" }}>
                {valor.toLocaleString("es-GT")}
              </span>
              <div style={{
                width: "100%",
                backgroundColor: colorBarra,
                borderRadius: "4px 4px 0 0",
                height: `${porcentaje}%`,
                minHeight: "6px",
              }} />
              <span style={{ fontSize: "10px", color: "#64748b", marginTop: "6px", textAlign: "center" }}>
                {item[etiquetaX]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function DashboardMetricasPage() {
  const { cargando, error, indicadores, evolucionMensual, porComunidad, avisos } = useDashboardMetricas();

  if (cargando) {
    return (
      <div style={{
        padding: "60px 24px",
        textAlign: "center",
        color: "#64748b",
        fontFamily: "system-ui",
      }}>
        Cargando tablero de métricas...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: "24px",
        color: "#991b1b",
        backgroundColor: "#fef2f2",
        borderRadius: "12px",
        fontFamily: "system-ui",
      }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{
      padding: "24px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      backgroundColor: "#f8fafc",
      minHeight: "100vh",
    }}>
      {/* Cabecera */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#1e293b", margin: 0 }}>
          Panel de Métricas de Impacto
        </h1>
        <p style={{ fontSize: "14px", color: "#64748b", margin: "4px 0 0 0" }}>
          Resumen general de actividad y resultados
        </p>
      </div>

      {/* Tarjetas de indicadores principales */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "16px",
        marginBottom: "28px",
      }}>
        <TarjetaIndicador
          etiqueta={CAMPOS_DASHBOARD.pacientesAtendidos.etiqueta}
          valor={indicadores.pacientesAtendidos}
        />
        <TarjetaIndicador
          etiqueta={CAMPOS_DASHBOARD.comunidadesBeneficiadas.etiqueta}
          valor={indicadores.comunidadesBeneficiadas}
          color="#0891b2"
        />
        <TarjetaIndicador
          etiqueta={CAMPOS_DASHBOARD.tratamientosEntregados.etiqueta}
          valor={indicadores.tratamientosEntregados}
          color="#d97706"
        />
        <TarjetaIndicador
          etiqueta={CAMPOS_DASHBOARD.medicamentosUtilizados.etiqueta}
          valor={indicadores.medicamentosUtilizados}
          color="#4f46e5"
        />
      </div>

      {/* Avisos que requieren acción */}
      {(avisos.movimientosPendientes > 0 || avisos.alertasVencimiento > 0) && (
        <div style={{ marginBottom: "28px" }}>
          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#334155", margin: "0 0 12px 0" }}>
            ⚠️ Avisos que requieren su atención
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "12px" }}>
            {avisos.movimientosPendientes > 0 && (
              <TarjetaAviso
                etiqueta={CAMPOS_DASHBOARD.movimientosPendientes.etiqueta}
                valor={avisos.movimientosPendientes}
                enlace={CAMPOS_DASHBOARD.movimientosPendientes.enlace}
                color={COLORES_GRAFICAS.pendiente}
              />
            )}
            {avisos.alertasVencimiento > 0 && (
              <TarjetaAviso
                etiqueta={CAMPOS_DASHBOARD.alertasVencimiento.etiqueta}
                valor={avisos.alertasVencimiento}
                enlace={CAMPOS_DASHBOARD.alertasVencimiento.enlace}
                color={COLORES_GRAFICAS.alerta}
              />
            )}
          </div>
        </div>
      )}

      {/* Gráficas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "20px" }}>
        <GraficaBarras
          datos={evolucionMensual}
          etiquetaX="mes"
          etiquetaY="cantidad"
          color={COLORES_GRAFICAS.evolucion}
          titulo="Evolución de atenciones por mes"
        />
        <GraficaBarras
          datos={porComunidad}
          etiquetaX="nombre"
          etiquetaY="cantidad"
          color={COLORES_GRAFICAS.comunidad}
          titulo="Atenciones por comunidad"
        />
      </div>
    </div>
  );
}