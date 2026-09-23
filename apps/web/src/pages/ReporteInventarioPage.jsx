import {
  exportarFilasACSV,
  FILTROS_INVENTARIO_REPORTE,
  formatearMoneda,
  useExportarPDF,
  useReporteInventario,
} from "@ecopac/shared";
import DataList from "../components/DataList";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import LoadingState from "../components/LoadingState";
import CabeceraDeReporte, { ContenedorDeReporte } from "./CabeceraDeReporte";
import { useSesionCompartida } from "../contexto/SesionProvider";
import BotonExportarPDF from "../components/BotonExportarPDF";
import "./reportes.css";
import StatCard from "../components/StatCard";

// Reporte de inventario actual (issue #212, reconectado por #693).
// Agregada exportación PDF (issue #216).

/** Descarga el CSV. Vive aca porque toca document, Blob y URL, que shared no puede tocar. */
function descargarCSV(columnas, filas) {
  const blob = new Blob([exportarFilasACSV(filas, columnas)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "inventario-actual.csv";
  enlace.click();
  URL.revokeObjectURL(url);
}

export default function ReporteInventarioPage({ incrustado = false }) {
  const { rol } = useSesionCompartida();
  const {
    tieneAcceso,
    cargando,
    error,
    medicamentos,
    totales,
    columnas,
    camposDeLote,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros,
    catalogos,
    recargar,
    tieneAccesoValorizacion,
    cargandoValorizacion,
    errorValorizacion,
    valorizacion,
    valorizacionPorOrigen,
    columnasValorizacionPorOrigen,
    recargarValorizacion,
  } = useReporteInventario({ rol });

  // Exportación PDF — issue #216
  const periodo = new Date().toLocaleDateString("es-GT", { dateStyle: "long" });
  const { exportar, generando } = useExportarPDF({
    tituloReporte: "Reporte de Inventario Actual",
    periodo: `Al ${periodo}`,
  });

  if (!tieneAcceso) {
    return (
      <ContenedorDeReporte incrustado={incrustado}>
        <CabeceraDeReporte incrustado={incrustado} title="Inventario actual" />
        <ErrorState message="Se necesita una sesión activa para consultar el inventario." />
      </ContenedorDeReporte>
    );
  }

  return (
    <ContenedorDeReporte incrustado={incrustado}>
      <CabeceraDeReporte
        incrustado={incrustado}
        title="Inventario actual"
        subtitle="Existencia por medicamento, con el desglose de cada lote y bodega"
        actions={[
          {
            label: "Exportar CSV",
            onClick: () => descargarCSV(columnas, medicamentos),
            variant: "secondary",
          },
          // Nuevo botón de PDF
          {
            custom: <BotonExportarPDF onClick={exportar} generando={generando} />,
          },
        ]}
      />

      <FilterBar
        campos={FILTROS_INVENTARIO_REPORTE}
        valores={filtros}
        onChange={setFiltro}
        catalogos={catalogos}
        onLimpiar={limpiarFiltros}
        hayFiltros={hayFiltros}
      />

      {error && <ErrorState message={error.mensaje} onRetry={recargar} />}
      {!error && cargando && <LoadingState message="Consultando el inventario..." />}

      {!error && !cargando && (
        // TODO el contenido que va al PDF DENTRO de este div
        <div id="contenido-reporte-pdf">
          <section className="reporte-seccion">
            <div className="ec-kpis">
              <StatCard label="Unidades disponibles" value={totales.unidadesDisponibles} />
              <StatCard label="Unidades vencidas" value={totales.unidadesVencidas} />
              <StatCard label="Medicamentos distintos" value={totales.medicamentosDistintos} />
              <StatCard label="Renglones de inventario" value={totales.renglonesDeInventario} />
            </div>
          </section>

          {tieneAccesoValorizacion && (
            <section className="reporte-seccion">
              <h2 className="ec-seccion-titulo">Valor del inventario disponible</h2>
              {errorValorizacion && (
                <ErrorState message={errorValorizacion.mensaje} onRetry={recargarValorizacion} />
              )}
              {!errorValorizacion && cargandoValorizacion && (
                <LoadingState message="Calculando el valor del inventario..." />
              )}
              {!errorValorizacion && !cargandoValorizacion && (
                <>
                  <div className="ec-kpis">
                    <StatCard
                      label="Valor total disponible"
                      value={
                        formatearMoneda(valorizacion.valorDisponible) ?? "Sin costo registrado"
                      }
                      esTexto
                    />
                    <StatCard
                      label="Unidades sin costo conocido"
                      value={valorizacion.unidadesSinCosto}
                    />
                    <StatCard label="Lotes sin costo conocido" value={valorizacion.lotesSinCosto} />
                  </div>
                  <DataList
                    columnas={columnasValorizacionPorOrigen}
                    datos={valorizacionPorOrigen}
                    catalogos={catalogos}
                    vacio="Sin datos de valorizacion por origen."
                  />
                </>
              )}
            </section>
          )}

          <section className="reporte-seccion">
            <DataList
              columnas={columnas}
              datos={medicamentos}
              vacio="No hay existencias que coincidan con estos filtros."
            />
          </section>

          {medicamentos.map((medicamento) => (
            <section
              className="reporte-seccion"
              key={medicamento.medicamentoId ?? medicamento.medicamento}
            >
              <h2 className="ec-seccion-titulo">
                {medicamento.medicamento} - lotes ({medicamento.lotes?.length ?? 0})
              </h2>
              <DataList
                columnas={camposDeLote}
                datos={medicamento.lotes ?? []}
                catalogos={catalogos}
                vacio="Sin lotes registrados."
              />
            </section>
          ))}
        </div>
        // Fin del contenido PDF
      )}
    </ContenedorDeReporte>
  );
}
