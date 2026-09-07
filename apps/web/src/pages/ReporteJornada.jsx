import { useNavigate, useParams } from "react-router-dom";
import {
  ESTADOS_JORNADA_REPORTE,
  exportarFilasACSV,
  formatearFechaLarga,
  useReporteJornada,
} from "@ecopac/shared";
import Card from "../components/Card";
import DataList from "../components/DataList";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import StatusChip from "../components/StatusChip";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { useExportarPDF } from "../../../../packages/shared/reportes/useExportarPDF";
import BotonExportarPDF from "../components/BotonExportarPDF";
import "./reportes.css";

// Reporte de resultados de una jornada (issues #206 / #215, reconectado por #693).
// Agregada exportación PDF (issue #216).

/**
 * Descarga el CSV en el navegador. Vive acá y no en packages/shared porque toca `document`,
 * `Blob` y `URL`, que es justo la frontera que shared no puede cruzar.
 */
function descargarCSV(nombreDeArchivo, columnas, filas) {
  const csv = exportarFilasACSV(filas, columnas);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreDeArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
}

export default function ReporteJornada() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { rol } = useSesionCompartida();
  const {
    tieneAcceso,
    cargando,
    error,
    ficha,
    diagnosticos,
    columnasDeDiagnosticos,
    medicamentos,
    columnasDeMedicamentos,
    personal,
    columnasDePersonal,
    recargar,
  } = useReporteJornada(id, { rol });

  // 📄 Exportación PDF — issue #216
  const periodo = ficha
    ? [ficha.comunidad, formatearFechaLarga(ficha.fecha)].filter(Boolean).join(" — ")
    : `Jornada: ${id}`;
  const { exportar, generando } = useExportarPDF({
    tituloReporte: ficha?.nombre ?? "Reporte de Resultados de Jornada",
    periodo,
  });

  const volver = {
    label: "Volver a reportes",
    onClick: () => navigate("/reportes"),
    variant: "secondary",
  };

  if (!tieneAcceso) {
    return (
      <ScreenContainer>
        <PageHeader title="Resultados de la jornada" actions={[volver]} />
        <ErrorState message="Solo administración y médico consultan el reporte de resultados de la jornada." />
      </ScreenContainer>
    );
  }

  if (cargando) {
    return (
      <ScreenContainer>
        <PageHeader title="Resultados de la jornada" actions={[volver]} />
        <LoadingState message="Cargando los resultados de la jornada..." />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <PageHeader title="Resultados de la jornada" actions={[volver]} />
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <PageHeader
        title={ficha?.nombre ?? "Resultados de la jornada"}
        subtitle={
          ficha
            ? [ficha.comunidad, formatearFechaLarga(ficha.fecha)].filter(Boolean).join(" — ")
            : undefined
        }
        actions={[
          volver,
          // 📄 Botón de PDF
          { custom: <BotonExportarPDF onClick={exportar} generando={generando} /> },
        ]}
      />

      {ficha && (
        // ✅ TODO el contenido que va al PDF DENTRO de este div
        <div id="contenido-reporte-pdf">
          <section className="reporte-seccion">
            <div className="reporte-cifras">
              <Card>
                <span className="reporte-cifra-etiqueta">Pacientes atendidos</span>
                <strong className="reporte-cifra">{ficha.pacientes_atendidos}</strong>
              </Card>
              <Card>
                <span className="reporte-cifra-etiqueta">Consultas realizadas</span>
                <strong className="reporte-cifra">{ficha.total_consultas}</strong>
              </Card>
              <Card>
                <span className="reporte-cifra-etiqueta">Diagnósticos distintos</span>
                <strong className="reporte-cifra">{diagnosticos.length}</strong>
              </Card>
              <Card>
                <span className="reporte-cifra-etiqueta">Estado</span>
                <span className="reporte-cifra-estado">
                  <StatusChip
                    status={ficha.estado}
                    label={
                      ESTADOS_JORNADA_REPORTE.find((e) => e.value === ficha.estado)?.label ??
                      ficha.estado
                    }
                  />
                </span>
              </Card>
            </div>
          </section>

          <section className="reporte-seccion">
            <div className="reporte-cabecera-tabla">
              <h2 className="reporte-titulo">Diagnósticos más frecuentes</h2>
              <button
                className="reporte-exportar"
                disabled={diagnosticos.length === 0}
                onClick={() =>
                  descargarCSV(`diagnosticos-jornada-${id}.csv`, columnasDeDiagnosticos, diagnosticos)
                }
                type="button"
              >
                Exportar CSV
              </button>
            </div>
            <DataList
              columnas={columnasDeDiagnosticos}
              datos={diagnosticos}
              vacio="No se registró ningún diagnóstico en esta jornada."
            />
          </section>

          <section className="reporte-seccion">
            <div className="reporte-cabecera-tabla">
              <h2 className="reporte-titulo">Medicamentos más entregados</h2>
              <button
                className="reporte-exportar"
                disabled={medicamentos.length === 0}
                onClick={() =>
                  descargarCSV(`medicamentos-jornada-${id}.csv`, columnasDeMedicamentos, medicamentos)
                }
                type="button"
              >
                Exportar CSV
              </button>
            </div>
            <DataList
              columnas={columnasDeMedicamentos}
              datos={medicamentos}
              vacio="No se entregó ningún medicamento en esta jornada."
            />
          </section>

          <section className="reporte-seccion">
            <h2 className="reporte-titulo">Personal participante</h2>
            <DataList
              columnas={columnasDePersonal}
              datos={personal}
              vacio="Nadie registró consultas en esta jornada."
            />
          </section>
        </div>
        // ✅ Fin del contenido PDF
      )}
    </ScreenContainer>
  );
}