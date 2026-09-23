import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  AGRUPACIONES_DE_PACIENTES,
  resolverFiltrosReportesDesdeParametros,
  useReportePacientes,
} from "@ecopac/shared";
import BotonExportarCSV from "../components/BotonExportarCSV";
import BotonImprimir from "../components/BotonImprimir";
import DataList from "../components/DataList";
import descargarCSV from "../components/descargarCSV";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import LoadingState from "../components/LoadingState";
import Paginacion from "../components/Paginacion";
import SecondaryButton from "../components/SecondaryButton";
import Selector from "../components/Selector";
import StatCard from "../components/StatCard";
import CabeceraDeReporte, { ContenedorDeReporte } from "./CabeceraDeReporte";
import ReporteImprimible from "./ReporteImprimible";
import { useSesionCompartida } from "../contexto/SesionProvider";
import "./reportes.css";

// Reporte de pacientes atendidos (issues #202 / #211, reconectado por #693).
//
// ISSUE #862: ordenar, paginar, contador de resultados, vacio contextual, presets de rango y
// salida a papel. El "Exportar PDF" que habia no funcionaba -- ver ReporteImprimible.jsx.
const OPCIONES_DE_AGRUPACION = [
  { value: AGRUPACIONES_DE_PACIENTES.JORNADA, label: "Por jornada" },
  { value: AGRUPACIONES_DE_PACIENTES.COMUNIDAD, label: "Por comunidad" },
  { value: AGRUPACIONES_DE_PACIENTES.PERIODO, label: "Por período" },
];

export default function ReportePacientesPage({ incrustado = false }) {
  const { rol } = useSesionCompartida();
  const [imprimiendo, setImprimiendo] = useState(false);
  const [parametros, setParametros] = useSearchParams();

  // Solo en el primer render: a partir de ahi el estado lo manda el hook y la URL lo sigue. Leerla
  // en cada render haria que escribir la URL y reaccionar a ella se pelearan.
  const valoresIniciales = useMemo(
    () => resolverFiltrosReportesDesdeParametros(Object.fromEntries(parametros)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const {
    tieneAcceso,
    cargando,
    error,
    grupos,
    gruposCompletos,
    total,
    totales,
    columnas,
    definicionDeFiltros,
    valores,
    presetActivo,
    presets,
    parametrosDeUrl,
    setFiltro,
    setPreset,
    limpiarFiltros,
    hayFiltros,
    catalogos,
    agruparPor,
    setAgruparPor,
    orden,
    alternarOrden,
    numeroDePagina,
    totalPaginas,
    irAPagina,
    recargar,
  } = useReportePacientes({ rol, valoresIniciales });

  // ISSUE #862: los filtros viajan en la barra de direcciones, asi que un reporte recortado se
  // puede enlazar y compartir -que es lo que pide el criterio de "util para la operacion real"-.
  // `replace` y no `push`: cada tecleo en un campo de fecha crearia una entrada de historial y el
  // boton "atras" tendria que pulsarse veinte veces para salir de la pantalla.
  //
  // SE DEPENDE DE LA CADENA, NO DEL OBJETO. `parametrosDeUrl` lo construye el hook en cada render,
  // asi que es una referencia nueva siempre: usarlo como dependencia hacia que el efecto corriera
  // en cada render, setParametros provocara otro render, y de ahi el "Maximum update depth
  // exceeded" que aparecia en consola y que se disparaba al cambiar de pestana rapido. Comparar
  // la cadena ya serializada corta el ciclo: solo se escribe la URL cuando los filtros de verdad
  // cambiaron.
  const consultaDeUrl = new URLSearchParams(parametrosDeUrl).toString();

  useEffect(() => {
    setParametros(consultaDeUrl, { replace: true });
  }, [consultaDeUrl, setParametros]);

  if (!tieneAcceso) {
    return (
      <ContenedorDeReporte incrustado={incrustado}>
        <CabeceraDeReporte incrustado={incrustado} title="Pacientes atendidos" />
        {/* El texto decia "Solo administración y junta directiva", que dejo de ser cierto en la
            migracion 00080: socio fundador tambien puede (issue #862). */}
        <ErrorState message="Solo administración y los roles consultivos consultan el reporte de pacientes." />
      </ContenedorDeReporte>
    );
  }

  const rotuloDePeriodo =
    valores.periodo?.min || valores.periodo?.max
      ? `${valores.periodo?.min ?? "inicio"} al ${valores.periodo?.max ?? "hoy"}`
      : "Todo el histórico";

  return (
    <ContenedorDeReporte incrustado={incrustado}>
      <CabeceraDeReporte
        incrustado={incrustado}
        title="Pacientes atendidos"
        subtitle="Agregados por jornada, comunidad o período. Ninguna fila identifica a un paciente."
        actions={[
          {
            key: "csv",
            custom: (
              <BotonExportarCSV
                // El CSV lleva el conjunto ENTERO, no la pagina que se esta viendo: quien exporta
                // quiere los datos, no el recorte de la pantalla.
                onClick={() => descargarCSV(columnas, gruposCompletos, "pacientes-atendidos.csv")}
                disabled={gruposCompletos.length === 0}
              />
            ),
          },
          {
            key: "imprimir",
            custom: (
              <BotonImprimir
                onClick={() => setImprimiendo(true)}
                disabled={gruposCompletos.length === 0}
              />
            ),
          },
        ]}
      />

      {/* Los presets de rango estaban escritos y probados en useFiltrosReportes desde la issue
          #208, y ninguna pantalla los dibujaba. */}
      <div className="reporte-presets">
        {presets.map((preset) => (
          <SecondaryButton
            key={preset.value}
            size="sm"
            title={preset.label}
            variant={presetActivo === preset.value ? "outline" : "neutra"}
            onClick={() => setPreset(preset.value)}
          />
        ))}
      </div>

      <FilterBar
        campos={definicionDeFiltros}
        valores={valores}
        onChange={setFiltro}
        catalogos={catalogos}
        onLimpiar={limpiarFiltros}
        // ISSUE #862: faltaba, asi que FilterBar tomaba su defecto `true` y "Limpiar filtros"
        // nunca se veia deshabilitado, ni siquiera recien abierta la pantalla.
        hayFiltros={hayFiltros}
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
        <>
          {totales && (
            <section className="reporte-seccion">
              <div className="ec-kpis">
                <StatCard label="Pacientes atendidos" value={totales.pacientes} />
                <StatCard label="Nuevos" value={totales.nuevos} />
                <StatCard label="Recurrentes" value={totales.recurrentes} />
                <StatCard label="Grupos" value={total} />
              </div>
            </section>
          )}

          <section className="reporte-seccion">
            <p className="ec-rotulo reporte-conteo">
              {total} {total === 1 ? "grupo" : "grupos"}
            </p>

            <DataList
              columnas={columnas}
              datos={grupos}
              ordenarPor={orden}
              onOrdenar={alternarOrden}
              vacio={
                <EmptyState
                  message={
                    hayFiltros
                      ? "Ningún grupo coincide con los filtros aplicados."
                      : "No hay atenciones registradas todavía."
                  }
                  actionLabel={hayFiltros ? "Limpiar filtros" : undefined}
                  onAction={hayFiltros ? limpiarFiltros : undefined}
                />
              }
            />

            <Paginacion pagina={numeroDePagina} totalPaginas={totalPaginas} onCambiar={irAPagina} />
          </section>
        </>
      )}

      {imprimiendo && (
        <ReporteImprimible
          titulo="Pacientes atendidos"
          periodo={rotuloDePeriodo}
          totales={
            totales
              ? [
                  { etiqueta: "Pacientes atendidos", valor: totales.pacientes },
                  { etiqueta: "Nuevos", valor: totales.nuevos },
                  { etiqueta: "Recurrentes", valor: totales.recurrentes },
                  { etiqueta: "Grupos", valor: total },
                ]
              : []
          }
          secciones={[{ columnas, filas: gruposCompletos }]}
          alTerminar={() => setImprimiendo(false)}
        />
      )}
    </ContenedorDeReporte>
  );
}
