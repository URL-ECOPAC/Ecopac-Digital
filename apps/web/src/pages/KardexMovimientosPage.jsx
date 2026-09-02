import {
  useKardexMovimientos,
  TIPO_MOVIMIENTO,
  ESTADO_MOVIMIENTO,
} from "../../../../packages/shared/inventario/useKardexMovimientos";

const colores = {
  fondoTarjeta: "#ffffff",
  borde: "#e2e8f0",
  textoTitulo: "#1e293b",
  textoSecundario: "#64748b",
  fondoFiltros: "#f8fafc",
  botonFondo: "#10b981",
  botonTexto: "#ffffff",
  bordeActivo: "#10b981",
};

export default function KardexMovimientosPage({
  loteId = null,
  medicamentoId = null,
  titulo = "Historial de Movimientos",
}) {
  const { movimientos, cargando, filtros, setFiltros, exportar } = useKardexMovimientos({
    loteId,
    medicamentoId,
  });

  const formatoFecha = (fechaIso) => {
    if (!fechaIso) return "—";
    return new Date(fechaIso).toLocaleString("es-GT", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const filaEstilo = (movimiento) => {
    if (movimiento.estado === ESTADO_MOVIMIENTO.RECHAZADO) {
      return { backgroundColor: "#fef2f2", opacity: 0.85 };
    }
    if (movimiento.estado === ESTADO_MOVIMIENTO.PENDIENTE) {
      return { backgroundColor: "#fffbeb" };
    }
    return {};
  };

  const etiquetaTipo = (tipo) => {
    const estilos = {
      [TIPO_MOVIMIENTO.INGRESO]: { fondo: "#dcfce7", texto: "#166534", etiqueta: "Ingreso" },
      [TIPO_MOVIMIENTO.SALIDA]: { fondo: "#fef3c7", texto: "#92400e", etiqueta: "Salida" },
    };
    const s = estilos[tipo] || { fondo: "#e2e8f0", texto: "#475569", etiqueta: tipo };
    return `<span style="background:${s.fondo};color:${s.texto};padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600">${s.etiqueta}</span>`;
  };

  const etiquetaEstado = (estado) => {
    const estilos = {
      [ESTADO_MOVIMIENTO.APROBADO]: { fondo: "#e0f2fe", texto: "#0369a1", etiqueta: "Aprobado" },
      [ESTADO_MOVIMIENTO.RECHAZADO]: { fondo: "#fee2e2", texto: "#dc2626", etiqueta: "Rechazado" },
      [ESTADO_MOVIMIENTO.PENDIENTE]: { fondo: "#fef9c3", texto: "#a16207", etiqueta: "Pendiente" },
    };
    const s = estilos[estado] || { fondo: "#e2e8f0", texto: "#475569", etiqueta: estado };
    return `<span style="background:${s.fondo};color:${s.texto};padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600">${s.etiqueta}</span>`;
  };

  return (
    <div
      style={{
        background: colores.fondoTarjeta,
        boxShadow: "0 4px 6px -1px rgba(0,0,0,.08)",
        borderRadius: "10px",
        padding: "24px",
      }}
    >
      {/* Cabecera */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: colores.textoTitulo, margin: 0 }}>
            {titulo}
          </h2>
          <p style={{ fontSize: "13px", color: colores.textoSecundario, margin: "4px 0 0 0" }}>
            Historial cronológico • Solo movimientos{" "}
            <strong style={{ color: colores.botonFondo }}>aprobados</strong> afectan el saldo
          </p>
        </div>
        <button
          onClick={exportar}
          style={{
            padding: "10px 18px",
            background: colores.botonFondo,
            color: colores.botonTexto,
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Exportar historial
        </button>
      </div>

      {/* Filtros */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
          padding: "16px",
          background: colores.fondoFiltros,
          borderRadius: "8px",
          marginBottom: "24px",
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              color: colores.textoSecundario,
              marginBottom: "6px",
            }}
          >
            Fecha desde
          </label>
          <input
            type="date"
            value={filtros.fechaDesde}
            onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })}
            style={{
              width: "100%",
              padding: "8px 10px",
              border: `1px solid ${colores.borde}`,
              borderRadius: "6px",
              fontSize: "14px",
            }}
          />
        </div>
        <div>
          <label
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              color: colores.textoSecundario,
              marginBottom: "6px",
            }}
          >
            Fecha hasta
          </label>
          <input
            type="date"
            value={filtros.fechaHasta}
            onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })}
            style={{
              width: "100%",
              padding: "8px 10px",
              border: `1px solid ${colores.borde}`,
              borderRadius: "6px",
              fontSize: "14px",
            }}
          />
        </div>
        <div>
          <label
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              color: colores.textoSecundario,
              marginBottom: "6px",
            }}
          >
            Tipo de movimiento
          </label>
          <select
            value={filtros.tipoMovimiento}
            onChange={(e) => setFiltros({ ...filtros, tipoMovimiento: e.target.value })}
            style={{
              width: "100%",
              padding: "8px 10px",
              border: `1px solid ${colores.borde}`,
              borderRadius: "6px",
              fontSize: "14px",
            }}
          >
            <option value="todos">Todos los tipos</option>
            <option value={TIPO_MOVIMIENTO.INGRESO}>Ingresos</option>
            <option value={TIPO_MOVIMIENTO.SALIDA}>Salidas</option>
          </select>
        </div>
      </div>

      {/* Tabla / Mensaje */}
      {cargando ? (
        <p style={{ textAlign: "center", padding: "40px", color: colores.textoSecundario }}>
          Cargando movimientos...
        </p>
      ) : movimientos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: colores.textoSecundario }}>
          <p style={{ fontSize: "15px", margin: 0 }}>No hay movimientos registrados</p>
          <p style={{ fontSize: "13px", margin: "8px 0 0 0" }}>
            Seleccione un lote o medicamento para ver su historial
          </p>
        </div>
      ) : (
        <div
          style={{ overflowX: "auto", border: `1px solid ${colores.borde}`, borderRadius: "8px" }}
        >
          <table style={{ width: "100%", fontSize: "14px", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: colores.fondoFiltros,
                  borderBottom: `2px solid ${colores.borde}`,
                }}
              >
                <th
                  style={{
                    padding: "12px 10px",
                    textAlign: "left",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: colores.textoSecundario,
                  }}
                >
                  Fecha registro
                </th>
                <th
                  style={{
                    padding: "12px 10px",
                    textAlign: "left",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: colores.textoSecundario,
                  }}
                >
                  Tipo
                </th>
                <th
                  style={{
                    padding: "12px 10px",
                    textAlign: "right",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: colores.textoSecundario,
                  }}
                >
                  Cantidad
                </th>
                <th
                  style={{
                    padding: "12px 10px",
                    textAlign: "left",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: colores.textoSecundario,
                  }}
                >
                  Motivo
                </th>
                <th
                  style={{
                    padding: "12px 10px",
                    textAlign: "left",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: colores.textoSecundario,
                  }}
                >
                  Registrado por
                </th>
                <th
                  style={{
                    padding: "12px 10px",
                    textAlign: "left",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: colores.textoSecundario,
                  }}
                >
                  Aprobado por
                </th>
                <th
                  style={{
                    padding: "12px 10px",
                    textAlign: "left",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: colores.textoSecundario,
                  }}
                >
                  Fecha aprobación
                </th>
                <th
                  style={{
                    padding: "12px 10px",
                    textAlign: "left",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: colores.textoSecundario,
                  }}
                >
                  Estado
                </th>
                <th
                  style={{
                    padding: "12px 10px",
                    textAlign: "right",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: colores.textoSecundario,
                  }}
                >
                  Saldo
                </th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((mov) => (
                <tr
                  key={mov.id}
                  style={{ ...filaEstilo(mov), borderBottom: `1px solid ${colores.borde}` }}
                >
                  <td style={{ padding: "10px", fontSize: "13px", color: colores.textoSecundario }}>
                    {formatoFecha(mov.created_at)}
                  </td>
                  <td
                    style={{ padding: "10px" }}
                    dangerouslySetInnerHTML={{ __html: etiquetaTipo(mov.tipo) }}
                  />
                  <td style={{ padding: "10px", textAlign: "right", fontWeight: 500 }}>
                    {mov.tipo === TIPO_MOVIMIENTO.INGRESO ? "+" : ""}
                    {mov.cantidad}
                  </td>
                  <td style={{ padding: "10px", fontSize: "13px", color: colores.textoSecundario }}>
                    {mov.motivo}
                  </td>
                  <td style={{ padding: "10px", fontSize: "13px" }}>
                    {mov.registrado_por_nombre || "—"}
                  </td>
                  <td style={{ padding: "10px", fontSize: "13px" }}>
                    {mov.aprobado_por_nombre || "Pendiente"}
                  </td>
                  <td style={{ padding: "10px", fontSize: "12px", color: colores.textoSecundario }}>
                    {formatoFecha(mov.fecha_aprobacion)}
                  </td>
                  <td
                    style={{ padding: "10px" }}
                    dangerouslySetInnerHTML={{ __html: etiquetaEstado(mov.estado) }}
                  />
                  <td
                    style={{
                      padding: "10px",
                      textAlign: "right",
                      fontWeight: 700,
                      color: mov.afectaSaldo ? colores.textoTitulo : "#94a3b8",
                    }}
                  >
                    {mov.saldoAcumulado}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Leyenda */}
      <div
        style={{
          display: "flex",
          gap: "20px",
          marginTop: "16px",
          paddingTop: "16px",
          borderTop: `1px solid ${colores.borde}`,
          fontSize: "12px",
          color: colores.textoSecundario,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{ width: "12px", height: "12px", borderRadius: "4px", background: "#dcfce7" }}
          ></div>
          <span>Aprobado → modifica saldo</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{ width: "12px", height: "12px", borderRadius: "4px", background: "#fee2e2" }}
          ></div>
          <span>Rechazado → NO modifica saldo</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{ width: "12px", height: "12px", borderRadius: "4px", background: "#fef9c3" }}
          ></div>
          <span>Pendiente → NO modifica saldo</span>
        </div>
      </div>
    </div>
  );
}
