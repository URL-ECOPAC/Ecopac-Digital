import { useState } from "react";

const rangosPredefinidos = [
  { etiqueta: "Última semana", dias: 7 },
  { etiqueta: "Último mes", dias: 30 },
  { etiqueta: "Últimos 3 meses", dias: 90 },
  { etiqueta: "Último año", dias: 365 },
  { etiqueta: "Personalizado", personalizado: true },
];

// 🎨 Estilos IGUALES a Figma
const etiquetaStyle = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#1e293b",
  display: "block",
  marginBottom: "10px",
};

const botonStyle = {
  padding: "8px 14px",
  fontSize: "13px",
  fontWeight: "500",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#475569",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const botonActivoStyle = {
  ...botonStyle,
  borderColor: "#10b981",
  background: "#f0fdf4",
  color: "#059669",
};

const selectStyle = {
  width: "100%",
  padding: "10px 14px",
  fontSize: "14px",
  fontWeight: "500",
  color: "#1e293b",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  backgroundColor: "#ffffff",
  cursor: "pointer",
  outline: "none",
  transition: "border-color 0.2s ease",
};

const contenedorTarjeta = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  padding: "20px",
  border: "1px solid #f1f5f9",
  marginBottom: "24px",
};

export default function BarraFiltrosReporte({
  filtros = {},
  alCambiarFiltros = () => {},
  comunidades = [],
  jornadas = [],
  proyectos = [],
}) {
  const [mostrarPersonalizado, setMostrarPersonalizado] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(filtros.fechaInicio || "");
  const [fechaFin, setFechaFin] = useState(filtros.fechaFin || "");

  const aplicarRango = (rango) => {
    if (rango.personalizado) {
      setMostrarPersonalizado(true);
      return;
    }
    setMostrarPersonalizado(false);
    const hoy = new Date();
    const inicio = new Date();
    inicio.setDate(hoy.getDate() - rango.dias);
    alCambiarFiltros({
      ...filtros,
      fechaInicio: inicio.toISOString().split("T")[0],
      fechaFin: hoy.toISOString().split("T")[0],
    });
  };

  const aplicarFechasPersonalizadas = () => {
    if (fechaInicio && fechaFin) {
      alCambiarFiltros({ ...filtros, fechaInicio, fechaFin });
    }
  };

  const limpiarFiltro = (clave) => {
    const nuevos = { ...filtros };
    delete nuevos[clave];
    alCambiarFiltros(nuevos);
  };

  const hayFiltros = Object.values(filtros).some(Boolean);

  return (
    <div style={contenedorTarjeta}>
      {/* Rango de fechas */}
      <div style={{ marginBottom: "20px" }}>
        <label style={etiquetaStyle}>Rango de fechas</label>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px" }}>
          {rangosPredefinidos.map((r) => {
            const esActivo = !mostrarPersonalizado && filtros.fechaInicio && filtros.fechaFin;
            return (
              <button
                key={r.etiqueta}
                onClick={() => aplicarRango(r)}
                style={esActivo ? botonActivoStyle : botonStyle}
                onMouseOver={(e) => {
                  if (!esActivo) {
                    e.target.style.borderColor = "#cbd5e1";
                    e.target.style.backgroundColor = "#f8fafc";
                  }
                }}
                onMouseOut={(e) => {
                  if (!esActivo) {
                    e.target.style.borderColor = "#e2e8f0";
                    e.target.style.backgroundColor = "#ffffff";
                  }
                }}
              >
                {r.etiqueta}
              </button>
            );
          })}
        </div>

        {mostrarPersonalizado && (
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
              flexWrap: "wrap",
              padding: "16px",
              backgroundColor: "#f8fafc",
              borderRadius: "12px",
            }}
          >
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              style={{
                padding: "10px 14px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                fontSize: "14px",
                outline: "none",
              }}
            />
            <span style={{ color: "#64748b", fontWeight: "500", fontSize: "14px" }}>hasta</span>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              style={{
                padding: "10px 14px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                fontSize: "14px",
                outline: "none",
              }}
            />
            <button
              onClick={aplicarFechasPersonalizadas}
              style={{
                padding: "10px 20px",
                backgroundColor: "#10b981",
                color: "#ffffff",
                border: "none",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "background-color 0.2s ease",
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = "#059669")}
              onMouseOut={(e) => (e.target.style.backgroundColor = "#10b981")}
            >
              Aplicar
            </button>
          </div>
        )}
      </div>

      {/* Selectores de lista — 3 columnas iguales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
        <div>
          <label style={etiquetaStyle}>Comunidad</label>
          <select
            value={filtros.comunidadId || ""}
            onChange={(e) =>
              alCambiarFiltros({ ...filtros, comunidadId: e.target.value || undefined })
            }
            style={selectStyle}
          >
            <option value="">Todas las comunidades</option>
            {comunidades.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={etiquetaStyle}>Jornada</label>
          <select
            value={filtros.jornadaId || ""}
            onChange={(e) =>
              alCambiarFiltros({ ...filtros, jornadaId: e.target.value || undefined })
            }
            style={selectStyle}
          >
            <option value="">Todas las jornadas</option>
            {jornadas.map((j) => (
              <option key={j.id} value={j.id}>
                {j.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={etiquetaStyle}>Proyecto</label>
          <select
            value={filtros.proyectoId || ""}
            onChange={(e) =>
              alCambiarFiltros({ ...filtros, proyectoId: e.target.value || undefined })
            }
            style={selectStyle}
          >
            <option value="">Todos los proyectos</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Etiquetas de filtros activos */}
      {hayFiltros && (
        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            paddingTop: "16px",
            marginTop: "20px",
            borderTop: "1px solid #f1f5f9",
          }}
        >
          <span style={{ fontSize: "13px", color: "#64748b", fontWeight: "600" }}>
            Filtros activos:
          </span>
          {filtros.fechaInicio && filtros.fechaFin && (
            <span
              style={{
                fontSize: "13px",
                background: "#e0f2fe",
                padding: "6px 14px",
                borderRadius: "9999px",
                display: "flex",
                gap: "8px",
                alignItems: "center",
                color: "#0369a1",
                fontWeight: "500",
              }}
            >
              {filtros.fechaInicio} → {filtros.fechaFin}
              <button
                onClick={() => limpiarFiltro("fechaInicio")}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: "16px",
                  color: "#0369a1",
                  fontWeight: "700",
                  padding: "0 0 0 4px",
                }}
              >
                ×
              </button>
            </span>
          )}
          {filtros.comunidadId && (
            <span
              style={{
                fontSize: "13px",
                background: "#dcfce7",
                padding: "6px 14px",
                borderRadius: "9999px",
                display: "flex",
                gap: "8px",
                alignItems: "center",
                color: "#059669",
                fontWeight: "500",
              }}
            >
              Comunidad
              <button
                onClick={() => limpiarFiltro("comunidadId")}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: "16px",
                  color: "#059669",
                  fontWeight: "700",
                  padding: "0 0 0 4px",
                }}
              >
                ×
              </button>
            </span>
          )}
          {filtros.jornadaId && (
            <span
              style={{
                fontSize: "13px",
                background: "#fef3c7",
                padding: "6px 14px",
                borderRadius: "9999px",
                display: "flex",
                gap: "8px",
                alignItems: "center",
                color: "#b45309",
                fontWeight: "500",
              }}
            >
              Jornada
              <button
                onClick={() => limpiarFiltro("jornadaId")}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: "16px",
                  color: "#b45309",
                  fontWeight: "700",
                  padding: "0 0 0 4px",
                }}
              >
                ×
              </button>
            </span>
          )}
          {filtros.proyectoId && (
            <span
              style={{
                fontSize: "13px",
                background: "#e0e7ff",
                padding: "6px 14px",
                borderRadius: "9999px",
                display: "flex",
                gap: "8px",
                alignItems: "center",
                color: "#4338ca",
                fontWeight: "500",
              }}
            >
              Proyecto
              <button
                onClick={() => limpiarFiltro("proyectoId")}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: "16px",
                  color: "#4338ca",
                  fontWeight: "700",
                  padding: "0 0 0 4px",
                }}
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
