// apps/web/src/pages/ReporteJornadaPage.jsx
import { useParams } from "react-router-dom";
import { useReporteJornada } from "../../../../packages/shared/reportes/useReporteJornada.js";

const tarjeta = {
  backgroundColor: "#fff",
  borderRadius: "16px",
  padding: "20px",
  border: "1px solid #f1f5f9",
  marginBottom: "20px",
};

const etiqueta = {
  fontSize: "13px",
  fontWeight: "600",
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  margin: "0 0 6px 0",
};

const encabezadoSeccion = {
  fontSize: "15px",
  fontWeight: "700",
  color: "#1e293b",
  margin: "0 0 14px 0",
  paddingBottom: "8px",
  borderBottom: "1px solid #f1f5f9",
};

export default function ReporteJornadaPage() {
  const { id } = useParams();
  const { cargando, error, datos, imprimir, exportar } = useReporteJornada(id);

  if (cargando) {
    return <div style={{ padding: "60px 24px", textAlign: "center", color: "#64748b" }}>Cargando reporte de jornada...</div>;
  }

  if (error) {
    return <div style={{ padding: "24px", color: "#dc2626", backgroundColor: "#fef2f2", borderRadius: "12px" }}>{error}</div>;
  }

  if (!datos) return null;

  const estadoEtiqueta = {
    planificada: { texto: "Planificada", color: "#d97706", fondo: "#fffbeb" },
    en_curso: { texto: "En curso", color: "#2563eb", fondo: "#eff6ff" },
    completada: { texto: "Completada", color: "#059669", fondo: "#f0fdf4" },
    cancelada: { texto: "Cancelada", color: "#dc2626", fondo: "#fef2f2" },
  }[datos.jornada.estado] || { texto: datos.jornada.estado, color: "#64748b", fondo: "#f8fafc" };

  return (
    <div style={{ padding: "24px", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      {/* Cabecera */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#1e293b", margin: "0 0 8px 0" }}>
            {datos.jornada.nombre}
          </h1>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "14px", color: "#64748b" }}>{datos.jornada.fecha}</span>
            <span style={{ fontSize: "13px", fontWeight: "600", padding: "2px 10px", borderRadius: "9999px", backgroundColor: estadoEtiqueta.fondo, color: estadoEtiqueta.color }}>
              {estadoEtiqueta.texto}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={imprimir} style={{ padding: "10px 16px", backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "14px", fontWeight: "500", color: "#334155", cursor: "pointer" }}>
             Imprimir
          </button>
          <button onClick={exportar} style={{ padding: "10px 16px", backgroundColor: "#10b981", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: "600", color: "#fff", cursor: "pointer" }}>
             Exportar
          </button>
        </div>
      </div>

      {/* 📊 Resumen */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "20px" }}>
        <div style={{ ...tarjeta, marginBottom: 0 }}>
          <p style={etiqueta}>Pacientes Atendidos</p>
          <p style={{ fontSize: "32px", fontWeight: "700", color: "#059669", margin: 0 }}>{datos.pacientesAtendidos}</p>
        </div>
        <div style={{ ...tarjeta, marginBottom: 0 }}>
          <p style={etiqueta}>Presupuesto</p>
          <p style={{ fontSize: "32px", fontWeight: "700", color: "#0891b2", margin: 0 }}>Q {datos.jornada.presupuesto_asignado.toFixed(2)}</p>
        </div>
        <div style={{ ...tarjeta, marginBottom: 0 }}>
          <p style={etiqueta}>Diagnósticos distintos</p>
          <p style={{ fontSize: "32px", fontWeight: "700", color: "#d97706", margin: 0 }}>{datos.diagnosticos.length}</p>
        </div>
        <div style={{ ...tarjeta, marginBottom: 0 }}>
          <p style={etiqueta}>Personal participante</p>
          <p style={{ fontSize: "32px", fontWeight: "700", color: "#7c3aed", margin: 0 }}>{datos.personal.length}</p>
        </div>
      </div>

      {/* 🩺 Diagnósticos */}
      <div style={tarjeta}>
        <h3 style={encabezadoSeccion}>Diagnósticos más frecuentes</h3>
        {datos.diagnosticos.map((d, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < datos.diagnosticos.length - 1 ? "1px solid #f8fafc" : "none" }}>
            <span style={{ fontSize: "14px", color: "#334155" }}>{d.nombre}</span>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#059669" }}>{d.cantidad}</span>
          </div>
        ))}
      </div>

      {/* 💊 Medicamentos */}
      <div style={tarjeta}>
        <h3 style={encabezadoSeccion}>Medicamentos más entregados</h3>
        {datos.medicamentos.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < datos.medicamentos.length - 1 ? "1px solid #f8fafc" : "none" }}>
            <span style={{ fontSize: "14px", color: "#334155" }}>{m.nombre}</span>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#0891b2" }}>{m.cantidad} unidades</span>
          </div>
        ))}
      </div>

      {/* 👥 Personal — Campos reales de jornada_personal */}
      <div style={tarjeta}>
        <h3 style={encabezadoSeccion}>Personal Asignado</h3>
        {datos.personal.map((p, i) => (
          <div key={i} style={{ padding: "12px 0", borderBottom: i < datos.personal.length - 1 ? "1px solid #f8fafc" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "600", color: "#334155" }}>{p.nombre}</div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                  {p.rol_en_jornada} · {p.hora_inicio} - {p.hora_fin}
                  {p.responsabilidad && ` · ${p.responsabilidad}`}
                </div>
              </div>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#d97706" }}>{p.atenciones} atenciones</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}