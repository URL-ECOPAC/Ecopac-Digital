import {
  exportarFilasACSV,
  FILTROS_INVENTARIO_REPORTE,
  useReporteInventario,
} from "@ecopac/shared";
import Card from "../components/Card";
import DataList from "../components/DataList";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { useExportarPDF } from "../../../../packages/shared/reportes/useExportarPDF";
import BotonExportarPDF from "../components/BotonExportarPDF";
import "./reportes.css";

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

export default function ReporteInventarioPage() {
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
  } = useReporteInventario({ rol });

  // 📄 Exportación PDF — issue #216
  const periodo = new Date().toLocaleDateString("es-GT", { dateStyle: "long" });
  const { exportar, generando } = useExportarPDF({
    tituloReporte: "Reporte de Inventario Actual",
    periodo: `Al ${periodo}`,
  });

  if (!tieneAcceso) {
    return (
      <ScreenContainer>
        <PageHeader title="Inventario actual" />
        <ErrorState message="Se necesita una sesion activa para consultar el inventario." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <PageHeader
        title="Inventario actual"
        subtitle="Existencia por medicamento, con el desglose de cada lote y bodega"
        actions={[
          {
            label: "Exportar CSV",
            onClick: () => descargarCSV(columnas, medicamentos),
            variant: "secondary",
          },
          // 📄 Nuevo botón de PDF
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
      />

      {hayFiltros && (
        <div className="reporte-barra-agrupacion">
          <button className="reporte-exportar" onClick={limpiarFiltros} type="button">
            Limpiar filtros
          </button>
        </div>
      )}

      {error && <ErrorState message={error.mensaje} onRetry={recargar} />}
      {!error && cargando && <LoadingState message="Consultando el inventario..." />}

      {!error && !cargando && (
        // ✅ TODO el contenido que va al PDF DENTRO de este div
        <div id="contenido-reporte-pdf">
          <section className="reporte-seccion">
            <div className="reporte-cifras">
              <Card>
                <span className="reporte-cifra-etiqueta">Unidades disponibles</span>
                <strong className="reporte-cifra">{totales.unidadesDisponibles}</strong>
              </Card>
              <Card>
                <span className="reporte-cifra-etiqueta">Unidades vencidas</span>
                <strong className="reporte-cifra">{totales.unidadesVencidas}</strong>
              </Card>
              <Card>
                <span className="reporte-cifra-etiqueta">Medicamentos distintos</span>
                <strong className="reporte-cifra">{totales.medicamentosDistintos}</strong>
              </Card>
              <Card>
                <span className="reporte-cifra-etiqueta">Renglones de inventario</span>
                <strong className="reporte-cifra">{totales.renglonesDeInventario}</strong>
              </Card>
            </div>
          </section>

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
              <h2 className="reporte-titulo">
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
        // ✅ Fin del contenido PDF
      )}
    </ScreenContainer>
  );
}
