import { useReporteInventario } from "../../../../packages/shared/reportes/useReporteInventario.js";

// Tarjeta de métrica con estilo unificado
const Tarjeta = ({ etiqueta, valor, color = "#1f2937" }) => (
  <div style={{ 
    backgroundColor: "#fff", borderRadius: "12px", padding: "20px", 
    border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
  }}>
    <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 8px", textTransform: "uppercase", fontWeight: 500 }}>
      {etiqueta}
    </p>
    <p style={{ fontSize: "32px", fontWeight: "700", color, margin: 0, lineHeight: "1.2" }}>
      {valor}
    </p>
  </div>
);

export default function ReporteInventarioPage() {
  const {
    cargando,
    error,
    registros,
    totales,
    bodegaId,
    setBodegaId,
    estadoVencimiento,
    setEstadoVencimiento,
    soloActivos,
    setSoloActivos,
    listaBodegas,
    opcionesVencimiento,
    valoresEspeciales: { TODAS },
    obtenerCSV,
  } = useReporteInventario();

  // 📥 Exportar a CSV
  const descargarCSV = () => {
    const datos = obtenerCSV();
    if (!datos) return;
    const contenido = [
      datos.encabezados.join(","),
      ...datos.filas.map((fila) => fila.join(",")),
    ].join("\n");
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-inventario-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (cargando) return <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Cargando inventario...</div>;
  if (error) return <div style={{ padding: "40px", color: "#dc2626" }}> {error}</div>;

  return (
    <div style={{ padding: "24px", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      {/* 📌 Cabecera */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", margin: 0, color: "#1f2937" }}>Reporte de Inventario Actual</h1>
          <p style={{ fontSize: "14px", color: "#64748b", margin: "4px 0 0" }}>Existencias por medicamento, lote y bodega</p>
        </div>
        <button
          onClick={descargarCSV}
          style={{
            padding: "10px 20px",
            backgroundColor: "#10b981",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
           Exportar CSV
        </button>
      </div>

      {/* 🔍 Barra de Filtros — 3 columnas */}
      <div style={{ 
        backgroundColor: "#fff", 
        borderRadius: "12px", 
        padding: "20px", 
        marginBottom: "24px", 
        border: "1px solid #e2e8f0"
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {/* Filtro por Bodega */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748b", display: "block", marginBottom: "6px" }}>Bodega</label>
            <select
              value={bodegaId}
              onChange={(e) => setBodegaId(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
            >
              <option value={TODAS}>Todas las bodegas</option>
              {listaBodegas.map((b) => (
                <option key={b.id} value={b.id}>{b.nombre}</option>
              ))}
            </select>
          </div>

          {/* Filtro por Estado de Vencimiento */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748b", display: "block", marginBottom: "6px" }}>Estado de Vencimiento</label>
            <select
              value={estadoVencimiento}
              onChange={(e) => setEstadoVencimiento(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
            >
              {opcionesVencimiento.map((o) => (
                <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
              ))}
            </select>
          </div>

          {/* ✅ Filtro por Estado del Medicamento (columna activo de la migración) */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748b", display: "block", marginBottom: "6px" }}>Estado del Medicamento</label>
            <select
              value={soloActivos ? "si" : "todos"}
              onChange={(e) => setSoloActivos(e.target.value === "si")}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
            >
              <option value="si"> Solo activos</option>
              <option value="todos"> Activos e inactivos</option>
            </select>
          </div>
        </div>
      </div>

      {/* 📊 Tarjetas de Totales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        <Tarjeta etiqueta="Unidades Disponibles" valor={totales.unidadesDisponibles} color="#10b981" />
        <Tarjeta etiqueta="Medicamentos Distintos" valor={totales.medicamentosDistintos} color="#3b82f6" />
        <Tarjeta etiqueta="Unidades Vencidas" valor={totales.unidadesVencidas} color="#ef4444" />
        <Tarjeta etiqueta="Lotes Vencidos" valor={totales.lotesVencidos} color="#f59e0b" />
      </div>

      {/* 📋 Tabla de Existencias por Lote */}
      <div style={{ 
        backgroundColor: "#fff", 
        borderRadius: "12px", 
        padding: "20px", 
        border: "1px solid #e2e8f0"
      }}>
        <h3 style={{ fontSize: "15px", fontWeight: "600", margin: "0 0 16px", color: "#1f2937" }}>Existencias por Lote</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
              <th style={{ textAlign: "left", padding: "10px 8px", fontSize: "13px", color: "#64748b" }}>Medicamento</th>
              <th style={{ textAlign: "left", padding: "10px 8px", fontSize: "13px", color: "#64748b" }}>Lote</th>
              <th style={{ textAlign: "left", padding: "10px 8px", fontSize: "13px", color: "#64748b" }}>Bodega</th>
              <th style={{ textAlign: "center", padding: "10px 8px", fontSize: "13px", color: "#64748b" }}>Vencimiento</th>
              <th style={{ textAlign: "right", padding: "10px 8px", fontSize: "13px", color: "#64748b" }}>Cantidad</th>
              <th style={{ textAlign: "center", padding: "10px 8px", fontSize: "13px", color: "#64748b" }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {registros.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>
                  Sin registros para los filtros seleccionados
                </td>
              </tr>
            ) : registros.map((r, i) => (
              <tr 
                key={i} 
                style={{ 
                  borderBottom: "1px solid #f3f4f6", 
                  backgroundColor: r.estaVencido ? "#fef2f2" : r.medicamento?.activo === false ? "#f8fafc" : "transparent"
                }}
              >
                <td style={{ padding: "10px 8px" }}>
                  <div style={{ fontWeight: 500, color: r.medicamento?.activo === false ? "#94a3b8" : "inherit" }}>
                    {r.medicamento?.nombre || "Desconocido"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    {r.medicamento?.concentracion || ""}
                    {r.medicamento?.activo === false && <span style={{ marginLeft: "8px", color: "#9ca3af" }}>— INACTIVO</span>}
                  </div>
                </td>
                <td style={{ padding: "10px 8px", fontSize: "14px" }}>{r.numero_lote}</td>
                <td style={{ padding: "10px 8px", fontSize: "14px" }}>{r.bodega?.nombre || "Sin bodega"}</td>
                <td style={{ padding: "10px 8px", fontSize: "14px", textAlign: "center" }}>{r.fecha_vencimiento || "Sin fecha"}</td>
                <td style={{ padding: "10px 8px", fontSize: "14px", fontWeight: 600, textAlign: "right" }}>{r.cantidad}</td>
                <td style={{ padding: "10px 8px", textAlign: "center" }}>
                  {r.estaVencido ? (
                    <span style={{ color: "#dc2626", fontWeight: 600 }}> Vencido</span>
                  ) : r.estadoVencimiento === "por_vencer" ? (
                    <span style={{ color: "#f59e0b", fontWeight: 600 }}> Por vencer</span>
                  ) : (
                    <span style={{ color: "#10b981", fontWeight: 600 }}> Vigente</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}