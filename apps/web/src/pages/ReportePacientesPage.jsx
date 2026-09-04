import { AGRUPACIONES_DE_PACIENTES, exportarFilasACSV, useReportePacientes } from "@ecopac/shared";

import Card from "../components/Card";
import DataList from "../components/DataList";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import Selector from "../components/Selector";
import { useSesionCompartida } from "../contexto/SesionProvider";
import "./reportes.css";

// Reporte de pacientes atendidos (issues #202 / #211, reconectado por #693).
//
// La version anterior montaba un hook que consultaba vista_reporte_impacto, que solo tiene
// `pacientes_atendidos`: el desglose demografico que pide el requerimiento -- nuevos,
// recurrentes, sexo y rangos de edad -- lo calcula fn_reporte_pacientes_atendidos (00067) y no
// llegaba a ninguna pantalla. Ahora las columnas salen de COLUMNAS_PACIENTES_ATENDIDOS, que ya
// declaraba las nueve.
//
// Los filtros son la barra comun de las cuatro pantallas de reportes (FILTROS_REPORTES +
// useFiltrosReportes, issue #208), dibujada con el FilterBar del catalogo. La
// BarraFiltrosReporte propia que habia antes se elimino: tenia su propio vocabulario de filtros
// y sus propios colores escritos a mano.

const OPCIONES_DE_AGRUPACION = [
  { value: AGRUPACIONES_DE_PACIENTES.JORNADA, label: "Por jornada" },
  { value: AGRUPACIONES_DE_PACIENTES.COMUNIDAD, label: "Por comunidad" },
  { value: AGRUPACIONES_DE_PACIENTES.PERIODO, label: "Por periodo" },
];

/** Descarga el CSV. Vive aca porque toca document, Blob y URL, que shared no puede tocar. */
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

export default function ReportePacientesPage() {
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
    setAgruparPor,
    recargar,
  } = useReportePacientes({ rol });

  if (!tieneAcceso) {
    return (
      <ScreenContainer>
        <PageHeader title="Pacientes atendidos" />
        <ErrorState message="Solo administracion y junta directiva consultan el reporte de pacientes." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <PageHeader
        title="Pacientes atendidos"
        subtitle="Agregados por jornada, comunidad o periodo. Ninguna fila identifica a un paciente."
        actions={[
          {
            label: "Exportar CSV",
            onClick: () => descargarCSV(columnas, grupos),
            variant: "secondary",
          },
        ]}
      />

      <FilterBar
        campos={definicionDeFiltros}
        valores={valores}
        onChange={setFiltro}
        catalogos={catalogos}
      />

      <div className="reporte-barra-agrupacion">
        <Selector
          label="Agrupar por"
          value={agruparPor}
          options={OPCIONES_DE_AGRUPACION}
          onSelect={setAgruparPor}
        />
        <button className="reporte-exportar" onClick={limpiarFiltros} type="button">
          Limpiar filtros
        </button>
      </div>

      {error && <ErrorState message={error.mensaje} onRetry={recargar} />}

      {!error && cargando && <LoadingState message="Calculando el reporte..." />}

      {!error && !cargando && (
        <>
          {totales && (
            <section className="reporte-seccion">
              <div className="reporte-cifras">
                <Card>
                  <span className="reporte-cifra-etiqueta">Pacientes atendidos</span>
                  <strong className="reporte-cifra">{totales.pacientes}</strong>
                </Card>
                <Card>
                  <span className="reporte-cifra-etiqueta">Nuevos</span>
                  <strong className="reporte-cifra">{totales.nuevos}</strong>
                </Card>
                <Card>
                  <span className="reporte-cifra-etiqueta">Recurrentes</span>
                  <strong className="reporte-cifra">{totales.recurrentes}</strong>
                </Card>
                <Card>
                  <span className="reporte-cifra-etiqueta">Grupos</span>
                  <strong className="reporte-cifra">{grupos.length}</strong>
                </Card>
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
        </>
      )}
    </ScreenContainer>
  );
}
