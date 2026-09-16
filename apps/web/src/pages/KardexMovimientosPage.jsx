import {
  ESTADO_MOVIMIENTO,
  exportarFilasACSV,
  TIPO_MOVIMIENTO,
  TIPOS_DE_PRESENTACION,
  useKardexMovimientos,
} from "@ecopac/shared";
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

// Antes armaban HTML a mano (interpolando el tipo/estado sin escapar) y lo pintaban con
// dangerouslySetInnerHTML: para un valor que no fuera ninguno de los conocidos, el texto crudo
// terminaba en el DOM sin el escapado que React hace por defecto. tipo_movimiento y
// estado_movimiento son enums de Postgres, asi que hoy no hay forma de inyectar nada por ahi,
// pero un <span> normal de React da el mismo resultado sin ese patron.
function EtiquetaTipo({ tipo }) {
  const estilos = {
    [TIPO_MOVIMIENTO.INGRESO]: { fondo: "#dcfce7", texto: "#166534", etiqueta: "Ingreso" },
    [TIPO_MOVIMIENTO.SALIDA]: { fondo: "#fef3c7", texto: "#92400e", etiqueta: "Salida" },
  };
  const s = estilos[tipo] || { fondo: "#e2e8f0", texto: "#475569", etiqueta: tipo };
  return (
    <span
      style={{
        background: s.fondo,
        color: s.texto,
        padding: "4px 10px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: 600,
      }}
    >
      {s.etiqueta}
    </span>
  );
}

function EtiquetaEstado({ estado }) {
  const estilos = {
    [ESTADO_MOVIMIENTO.APROBADO]: { fondo: "#e0f2fe", texto: "#0369a1", etiqueta: "Aprobado" },
    [ESTADO_MOVIMIENTO.RECHAZADO]: { fondo: "#fee2e2", texto: "#dc2626", etiqueta: "Rechazado" },
    [ESTADO_MOVIMIENTO.PENDIENTE]: { fondo: "#fef9c3", texto: "#a16207", etiqueta: "Pendiente" },
  };
  const s = estilos[estado] || { fondo: "#e2e8f0", texto: "#475569", etiqueta: estado };
  return (
    <span
      style={{
        background: s.fondo,
        color: s.texto,
        padding: "4px 10px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: 600,
      }}
    >
      {s.etiqueta}
    </span>
  );
}

const COLUMNAS_CSV_KARDEX = [
  { id: "created_at", label: "Fecha registro", tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: "tipo", label: "Tipo" },
  { id: "cantidad", label: "Cantidad", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  { id: "bodega_nombre", label: "Bodega" },
  { id: "motivo", label: "Motivo" },
  { id: "registrado_por_nombre", label: "Registrado por" },
  { id: "aprobado_por_nombre", label: "Aprobado por" },
  { id: "aprobado_en", label: "Fecha aprobación", tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: "estado", label: "Estado" },
  { id: "motivo_rechazo", label: "Motivo de rechazo" },
  { id: "saldoAcumulado", label: "Saldo", tipo: TIPOS_DE_PRESENTACION.NUMERO },
];

/** Descarga el CSV. Vive aca porque toca document, Blob y URL, que shared no puede tocar. */
function descargarCSV(movimientos) {
  const blob = new Blob([exportarFilasACSV(movimientos, COLUMNAS_CSV_KARDEX)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "kardex-movimientos.csv";
  enlace.click();
  URL.revokeObjectURL(url);
}

export default function KardexMovimientosPage({
  loteId = null,
  medicamentoId = null,
  titulo = "Historial de Movimientos",
}) {
  const { movimientos, cargando, error, filtros, setFiltros } = useKardexMovimientos({
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
          onClick={() => descargarCSV(movimientos)}
          disabled={movimientos.length === 0}
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
      ) : error ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#dc2626" }}>
          <p style={{ fontSize: "15px", margin: 0 }}>No se pudo cargar el historial</p>
          <p style={{ fontSize: "13px", margin: "8px 0 0 0" }}>{error.mensaje}</p>
        </div>
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
                  Bodega
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
                  <td style={{ padding: "10px" }}>
                    <EtiquetaTipo tipo={mov.tipo} />
                  </td>
                  <td style={{ padding: "10px", textAlign: "right", fontWeight: 500 }}>
                    {mov.tipo === TIPO_MOVIMIENTO.INGRESO ? "+" : ""}
                    {mov.cantidad}
                  </td>
                  <td style={{ padding: "10px", fontSize: "13px", color: colores.textoSecundario }}>
                    {mov.motivo}
                  </td>
                  <td style={{ padding: "10px", fontSize: "13px", color: colores.textoSecundario }}>
                    {mov.bodega_nombre || "—"}
                  </td>
                  <td style={{ padding: "10px", fontSize: "13px" }}>
                    {mov.registrado_por_nombre || "—"}
                  </td>
                  <td style={{ padding: "10px", fontSize: "13px" }}>
                    {mov.aprobado_por_nombre || "Pendiente"}
                    {/* aprobacion_automatica (00028): TRUE cuando quien registro el movimiento
                        era administrador y el trigger lo aprobo solo, sin que nadie mas
                        interviniera -era una columna real que nunca llegaba a pantalla. */}
                    {mov.aprobacion_automatica && (
                      <span style={{ fontSize: "11px", color: colores.textoSecundario }}>
                        {" "}
                        (automático)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "10px", fontSize: "12px", color: colores.textoSecundario }}>
                    {formatoFecha(mov.aprobado_en)}
                  </td>
                  <td style={{ padding: "10px" }}>
                    <EtiquetaEstado estado={mov.estado} />
                    {mov.estado === ESTADO_MOVIMIENTO.RECHAZADO && mov.motivo_rechazo && (
                      <div
                        style={{ fontSize: "11px", color: colores.textoSecundario, marginTop: 2 }}
                      >
                        Motivo: {mov.motivo_rechazo}
                      </div>
                    )}
                  </td>
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
