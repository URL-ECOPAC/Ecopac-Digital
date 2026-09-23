import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ESTADOS_JORNADA_REPORTE, formatearFechaLarga, useReporteJornada } from "@ecopac/shared";
import BotonExportarCSV from "../components/BotonExportarCSV";
import BotonImprimir from "../components/BotonImprimir";
import Card from "../components/Card";
import DataList from "../components/DataList";
import descargarCSV from "../components/descargarCSV";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import StatusChip from "../components/StatusChip";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ReporteImprimible from "./ReporteImprimible";
import "./reportes.css";
import StatCard from "../components/StatCard";

// Reporte de resultados de una jornada (issues #206 / #215, reconectado por #693).
//
// ISSUE #862. Tres cosas se corrigen aqui:
//
//   - Los dos "Exportar CSV" eran <button> con una clase propia (.reporte-exportar): el unico
//     sitio del modulo con un boton escrito a mano en vez del catalogo.
//   - "Personal participante" era la unica de las tres secciones SIN boton de CSV.
//   - El "Exportar PDF" no funcionaba (ver ReporteImprimible.jsx). Ahora la jornada entera sale
//     en una sola hoja, con sus tres tablas, en vez de tres descargas sueltas.

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

  const [imprimiendo, setImprimiendo] = useState(false);

  const periodo = ficha
    ? [ficha.comunidad, formatearFechaLarga(ficha.fecha)].filter(Boolean).join(" — ")
    : `Jornada: ${id}`;

  // ISSUE #862: decia "Volver a reportes" y llevaba a /reportes, que era arbitrario incluso antes
  // de esta issue: al reporte de una jornada NO se llega desde ahi -no es una de las cuatro
  // pestanas-, asi que el boton devolvia a una pantalla por la que no se habia pasado.
  //
  // El unico sitio que enlaza aqui es el detalle de la jornada, que es ademas donde uno espera
  // volver: se sale del reporte de una jornada a esa jornada. `id` es justamente su UUID, asi que
  // el destino existe siempre, tambien cuando alguien llega escribiendo la direccion a mano
  // -caso en el que navigate(-1) no tendria a donde volver-.
  const volver = {
    label: "Volver a la jornada",
    onClick: () => navigate(`/jornadas/${id}`),
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
          { key: "imprimir", custom: <BotonImprimir onClick={() => setImprimiendo(true)} /> },
        ]}
      />

      {ficha && (
        <>
          <section className="reporte-seccion">
            <div className="ec-kpis">
              <StatCard label="Pacientes atendidos" value={ficha.pacientes_atendidos} />
              <StatCard label="Consultas realizadas" value={ficha.total_consultas} />
              <StatCard label="Diagnósticos distintos" value={diagnosticos.length} />
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
              <h2 className="ec-seccion-titulo">Diagnósticos más frecuentes</h2>
              <BotonExportarCSV
                onClick={() =>
                  descargarCSV(
                    columnasDeDiagnosticos,
                    diagnosticos,
                    `diagnosticos-jornada-${id}.csv`,
                  )
                }
                disabled={diagnosticos.length === 0}
              />
            </div>
            <DataList
              columnas={columnasDeDiagnosticos}
              datos={diagnosticos}
              vacio="No se registró ningún diagnóstico en esta jornada."
            />
          </section>

          <section className="reporte-seccion">
            <div className="reporte-cabecera-tabla">
              <h2 className="ec-seccion-titulo">Medicamentos más entregados</h2>
              <BotonExportarCSV
                onClick={() =>
                  descargarCSV(
                    columnasDeMedicamentos,
                    medicamentos,
                    `medicamentos-jornada-${id}.csv`,
                  )
                }
                disabled={medicamentos.length === 0}
              />
            </div>
            <DataList
              columnas={columnasDeMedicamentos}
              datos={medicamentos}
              vacio="No se entregó ningún medicamento en esta jornada."
            />
          </section>

          <section className="reporte-seccion">
            <div className="reporte-cabecera-tabla">
              <h2 className="ec-seccion-titulo">Personal participante</h2>
              {/* ISSUE #862: era la unica de las tres secciones sin su CSV. */}
              <BotonExportarCSV
                onClick={() =>
                  descargarCSV(columnasDePersonal, personal, `personal-jornada-${id}.csv`)
                }
                disabled={personal.length === 0}
              />
            </div>
            <DataList
              columnas={columnasDePersonal}
              datos={personal}
              vacio="Nadie registró consultas en esta jornada."
            />
          </section>
        </>
      )}

      {imprimiendo && ficha && (
        <ReporteImprimible
          titulo={ficha.nombre ?? "Resultados de la jornada"}
          periodo={periodo}
          totales={[
            { etiqueta: "Pacientes atendidos", valor: ficha.pacientes_atendidos },
            { etiqueta: "Consultas realizadas", valor: ficha.total_consultas },
            { etiqueta: "Diagnósticos distintos", valor: diagnosticos.length },
          ]}
          secciones={[
            {
              titulo: "Diagnósticos más frecuentes",
              columnas: columnasDeDiagnosticos,
              filas: diagnosticos,
            },
            {
              titulo: "Medicamentos más entregados",
              columnas: columnasDeMedicamentos,
              filas: medicamentos,
            },
            { titulo: "Personal participante", columnas: columnasDePersonal, filas: personal },
          ]}
          alTerminar={() => setImprimiendo(false)}
        />
      )}
    </ScreenContainer>
  );
}
