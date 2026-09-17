import {
  AGRUPACIONES_DE_PACIENTES,
  exportarFilasACSV,
  useExportarPDF,
  useReportePacientes,
} from "@ecopac/shared";
import DataList from "../components/DataList";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import LoadingState from "../components/LoadingState";
import CabeceraDeReporte, { ContenedorDeReporte } from "./CabeceraDeReporte";
import Selector from "../components/Selector";
import { useSesionCompartida } from "../contexto/SesionProvider";
import BotonExportarPDF from "../components/BotonExportarPDF";
import "./reportes.css";
import StatCard from "../components/StatCard";

// Reporte de pacientes atendidos (issues #202 / #211, reconectado por #693).
// Agregada exportación PDF (issue #216).
const OPCIONES_DE_AGRUPACION = [
  { value: AGRUPACIONES_DE_PACIENTES.JORNADA, label: "Por jornada" },
  { value: AGRUPACIONES_DE_PACIENTES.COMUNIDAD, label: "Por comunidad" },
  { value: AGRUPACIONES_DE_PACIENTES.PERIODO, label: "Por periodo" },
];

/** Descarga el CSV. Vive acá porque toca document, Blob y URL, que shared no puede tocar. */
function descargarCSV(columnas, filas) {
  const blob = new Blob([exportarFilasACSV(filas, columnas)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "pacientes-atendidos.csv";
  enlace.click();
  URL.revokeObjectURL(url);
}

export default function ReportePacientesPage({ incrustado = false }) {
  const { rol } = useSesionCompartida();
  const {
    tieneAcceso,
    cargando,
    error,
    grupos,
    totales,
    columnas,
    definicionDeFiltros,
    valores,
    setFiltro,
    limpiarFiltros,
    catalogos,
    agruparPor,
    setAgruparPor, // VIENE DEL HOOK, NO LO DECLARES TÚ
    recargar,
  } = useReportePacientes({ rol });

  // Exportación PDF — issue #216
  const periodo = `${valores?.fechaInicio || "—"} al ${valores?.fechaFin || "—"}`;
  const { exportar, generando } = useExportarPDF({
    tituloReporte: "Reporte de Pacientes Atendidos",
    periodo,
  });

  if (!tieneAcceso) {
    return (
      <ContenedorDeReporte incrustado={incrustado}>
        <CabeceraDeReporte incrustado={incrustado} title="Pacientes atendidos" />
        <ErrorState message="Solo administración y junta directiva consultan el reporte de pacientes." />
      </ContenedorDeReporte>
    );
  }

  return (
    <ContenedorDeReporte incrustado={incrustado}>
      <CabeceraDeReporte
        incrustado={incrustado}
        title="Pacientes atendidos"
        subtitle="Agregados por jornada, comunidad o periodo. Ninguna fila identifica a un paciente."
        actions={[
          {
            label: "Exportar CSV",
            onClick: () => descargarCSV(columnas, grupos),
            variant: "secondary",
          },
          // Botón de PDF
          { custom: <BotonExportarPDF onClick={exportar} generando={generando} /> },
        ]}
      />
      {/* "Agrupar por" y "Limpiar filtros" dentro de la misma barra: antes iban en una fila suelta
          debajo, con el boton pegado al selector y otro aspecto. */}
      <FilterBar
        campos={definicionDeFiltros}
        valores={valores}
        onChange={setFiltro}
        catalogos={catalogos}
        onLimpiar={limpiarFiltros}
      >
        <div className="ec-filtro">
          <Selector
            label="Agrupar por"
            value={agruparPor}
            options={OPCIONES_DE_AGRUPACION}
            onSelect={setAgruparPor}
            style={{ marginBottom: 0 }}
          />
        </div>
      </FilterBar>
      {error && <ErrorState message={error.mensaje} onRetry={recargar} />}
      {!error && cargando && <LoadingState message="Calculando el reporte..." />}
      {!error && !cargando && (
        // TODO el contenido que va al PDF DENTRO de este div
        <div id="contenido-reporte-pdf">
          {totales && (
            <section className="reporte-seccion">
              <div className="ec-kpis">
                <StatCard label="Pacientes atendidos" value={totales.pacientes} />
                <StatCard label="Nuevos" value={totales.nuevos} />
                <StatCard label="Recurrentes" value={totales.recurrentes} />
                <StatCard label="Grupos" value={grupos.length} />
              </div>
            </section>
          )}
          <section className="reporte-seccion">
            <DataList
              columnas={columnas}
              datos={grupos}
              vacio="No hay atenciones registradas con estos filtros."
            />
          </section>
        </div>
        // Fin del contenido PDF
      )}
    </ContenedorDeReporte>
  );
}
