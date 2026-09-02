import { useVistaExistencias } from "../../../../packages/shared/inventario/useVistaExistencias";
import { FilterBar, DataList } from "@ecopac/ui/components";
import { ESTADO_EXISTENCIA } from "../../../../packages/shared/inventario/useVistaExistencias";

// ─── Datos de ejemplo (en producción vendrán desde el contenedor/padre) ───
const DATOS_MOCK = [];
const BODEGAS_MOCK = ["Todas", "Central", "Norte", "Sur"];

export default function VistaExistenciasPage() {
  // Consumimos el hook con TODA la lógica
  const {
    medicamentos,
    columnas,
    bodegasDisponibles,

    busqueda,
    setBusqueda,
    filtroBodega,
    setFiltroBodega,
    filtroEstado,
    setFiltroEstado,
    ocultarSinExistencia,
    setOcultarSinExistencia,
    limpiarFiltros,

    filasExpandidas,
    toggleExpandir,

    estadosDisponibles,
  } = useVistaExistencias({
    existencias: DATOS_MOCK,
    bodegas: BODEGAS_MOCK,
  });

  // ─── Renderizado del estado con color ───
  const renderEstado = (valor) => {
    const colores = {
      [ESTADO_EXISTENCIA.DISPONIBLE]: "var(--color-exito)",
      [ESTADO_EXISTENCIA.POR_VENCER]: "var(--color-aviso)",
      [ESTADO_EXISTENCIA.VENCIDO]: "var(--color-error)",
      [ESTADO_EXISTENCIA.SIN_STOCK]: "var(--color-neutro)",
    };
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: "9999px",
          fontSize: "12px",
          fontWeight: 600,
          backgroundColor: `${colores[valor] || "transparent"}15`,
          color: colores[valor] || "inherit",
        }}
      >
        {valor}
      </span>
    );
  };

  // ─── Fila expandible → detalle por lotes ───
  const renderFilaExpandida = (item) => {
    if (!filasExpandidas.has(item)) return null;
    return (
      <div
        style={{
          padding: "12px 24px",
          backgroundColor: "var(--color-fondo-secundario)",
          borderTop: "1px solid var(--color-borde)",
        }}
      >
        <strong style={{ fontSize: "13px", color: "var(--color-texto)" }}>
          📋 Desglose por Lote
        </strong>
        <table
          style={{ width: "100%", marginTop: "8px", fontSize: "13px", borderCollapse: "collapse" }}
        >
          <thead>
            <tr style={{ color: "var(--color-texto-secundario)" }}>
              <th style={{ textAlign: "left", padding: "4px 8px" }}>Lote</th>
              <th style={{ textAlign: "left", padding: "4px 8px" }}>F. Ingreso</th>
              <th style={{ textAlign: "left", padding: "4px 8px" }}>F. Vencimiento</th>
              <th style={{ textAlign: "right", padding: "4px 8px" }}>Cantidad</th>
              <th style={{ textAlign: "center", padding: "4px 8px" }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {item.lotes.map((lote, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--color-borde-claro)" }}>
                <td style={{ padding: "6px 8px" }}>{lote.lote || "—"}</td>
                <td style={{ padding: "6px 8px" }}>{lote.fechaIngreso || "—"}</td>
                <td style={{ padding: "6px 8px" }}>{lote.fechaCaducidad || "Sin fecha"}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>{lote.stockTotal || 0}</td>
                <td style={{ padding: "6px 8px", textAlign: "center" }}>
                  {renderEstado(lote.estado)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ padding: "24px", maxWidth: "100%" }}>
      {/* ─── Encabezado ─── */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--color-texto)", margin: 0 }}>
          Existencias en Tiempo Real
        </h1>
        <p
          style={{ fontSize: "14px", color: "var(--color-texto-secundario)", margin: "4px 0 0 0" }}
        >
          Consulta del inventario disponible · Vista de solo lectura
        </p>
      </div>

      {/* ─── Barra de Filtros (componente reutilizable del catálogo #280) ─── */}
      <FilterBar
        filtros={[
          {
            clave: "busqueda",
            etiqueta: "Buscar",
            tipo: "texto",
            valor: busqueda,
            alCambiar: setBusqueda,
            placeholder: "Nombre, código o lote...",
          },
          {
            clave: "bodega",
            etiqueta: "Bodega",
            tipo: "seleccion",
            valor: filtroBodega,
            alCambiar: setFiltroBodega,
            opciones: bodegasDisponibles.map((b) => ({ valor: b, etiqueta: b })),
          },
          {
            clave: "estado",
            etiqueta: "Estado",
            tipo: "seleccion",
            valor: filtroEstado,
            alCambiar: setFiltroEstado,
            opciones: [
              { valor: "todos", etiqueta: "Todos" },
              ...estadosDisponibles.map((e) => ({ valor: e, etiqueta: e })),
            ],
          },
          {
            clave: "sinExistencia",
            etiqueta: "Ocultar sin existencia",
            tipo: "casilla",
            valor: ocultarSinExistencia,
            alCambiar: setOcultarSinExistencia,
          },
        ]}
        alLimpiar={limpiarFiltros}
        estilo={{ marginBottom: "20px" }}
      />

      {/* ─── Tabla de Resultados (componente genérico #280) ─── */}
      <DataList
        columnas={columnas}
        filas={medicamentos}
        vacio={{ mensaje: "No se encontraron existencias con los filtros aplicados." }}
        cargando={false}
        renderColumna={({ clave, valor, fila }) => {
          if (clave === "estado") return renderEstado(valor);
          if (clave === "nombre") {
            return (
              <button
                onClick={() => toggleExpandir(fila)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: "inherit",
                  color: "var(--color-enlace)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {filasExpandidas.has(fila) ? "▼ " : "▶ "}
                {valor}
              </button>
            );
          }
          return valor;
        }}
        renderFilaExtra={renderFilaExpandida}
      />
    </div>
  );
}
