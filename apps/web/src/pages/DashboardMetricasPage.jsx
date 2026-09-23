import { useState } from "react";
import { Form } from "react-bootstrap";

import { aCadenaFechaLocal, METAS_DE_IMPACTO, useDashboardMetricas } from "@ecopac/shared";
import BotonExportarCSV from "../components/BotonExportarCSV";
import BotonImprimir from "../components/BotonImprimir";
import Card from "../components/Card";
import descargarCSV from "../components/descargarCSV";
import ErrorState from "../components/ErrorState";
import GraficaDeBarras from "../components/GraficaDeBarras";
import LoadingState from "../components/LoadingState";
import { AccionesDeCabecera } from "../components/PageHeader";
import Selector from "../components/Selector";
import StatCard from "../components/StatCard";
import ReporteImprimible from "./ReporteImprimible";
import { useSesionCompartida } from "../contexto/SesionProvider";
import "./reportes.css";

// Panel de indicadores de impacto. Es la pestana por defecto de /reportes.
//
// ISSUE #862. Era la unica pantalla del modulo que se salia del catalogo: montaba
// `<div className="alert alert-danger">`, `<div className="card"><div className="card-body">` y
// `btn btn-sm btn-primary` a pelo, en vez de ErrorState, Card y los botones del sistema. Ademas:
//
//   - `metrica` y `setMetrica` se desestructuraban del hook y NO SE USABAN: el hook expone cinco
//     metricas y la pantalla no tenia selector, asi que siempre se veia "pacientes atendidos".
//   - Las metas estaban escritas como literales en el JSX (meta="3000", "50", "1500", "5000").
//     Ahora salen de METAS_DE_IMPACTO, en shared.
//   - La grafica eran divs con alto fijo de 180px y una barra `flex: 1` por punto, sin eje Y ni
//     alternativa accesible. Ver GraficaDeBarras.jsx.

/** StatCard con la barra de avance hacia la meta como pie. */
function TarjetaMetrica({ etiqueta, valor, meta, acento }) {
  const progreso = meta ? Math.min((Number(valor) / Number(meta)) * 100, 100) : 0;
  return (
    <StatCard
      label={etiqueta}
      value={valor}
      accent={acento}
      caption={
        meta ? (
          <span className="reporte-meta">
            <span className="reporte-meta-barra" aria-hidden="true">
              <span style={{ width: `${progreso}%` }} />
            </span>
            meta: {Number(meta).toLocaleString("es-GT")}
          </span>
        ) : undefined
      }
    />
  );
}

const COLUMNAS_DE_SERIE = [
  { id: "etiqueta", label: "Período / grupo" },
  { id: "valor", label: "Valor" },
  { id: "comparado", label: "Comparado" },
  { id: "variacion", label: "Variación %" },
];

export default function DashboardMetricasPage() {
  const { rol } = useSesionCompartida();
  const [imprimiendo, setImprimiendo] = useState(false);

  const {
    tieneAcceso,
    cargando,
    error,
    indicadores,
    seriePrincipal = [],
    serieComparacion = [],
    calcularVariacion,
    rangosDisponibles,
    rangoSeleccionado,
    setRangoSeleccionado,
    agrupamientosDisponibles,
    agruparPor,
    setAgruparPor,
    metricasDisponibles,
    metrica,
    setMetrica,
    comunidadId,
    setComunidadId,
    modoComparacion,
    setModoComparacion,
    comunidadCompararId,
    setComunidadCompararId,
    listaComunidades = [],
    valoresEspeciales: { TODAS, NINGUNA },
    recargar,
  } = useDashboardMetricas({ rol });

  if (!tieneAcceso) {
    return (
      <ErrorState message="Solo administración y los roles consultivos consultan los indicadores de impacto." />
    );
  }

  if (cargando) return <LoadingState message="Calculando métricas..." />;
  if (error) return <ErrorState message={error.mensaje} onRetry={recargar} />;

  const tieneComparacion = serieComparacion.length > 0;

  const etiquetaDeMetrica = metricasDisponibles.find((m) => m.value === metrica)?.label ?? "Valor";
  const etiquetaDeAgrupacion =
    agrupamientosDisponibles.find((a) => a.value === agruparPor)?.label ?? agruparPor;

  // El hueco se deja VACIO y no como "-". Un valor que empieza por guion es un prefijo de formula
  // y csv.js lo neutraliza anteponiendo un apostrofo (issue #698), asi que en el archivo salia
  // literalmente `'-`. Una celda vacia se lee como "sin dato" en cualquier hoja de calculo y no
  // necesita que nadie la desactive.
  const filasDeSerie = seriePrincipal.map((punto, indice) => {
    const comparado = serieComparacion[indice];
    const variacion = comparado ? calcularVariacion(punto.valor, comparado.valor) : null;
    return {
      id: punto.etiqueta ?? indice,
      etiqueta: punto.etiqueta,
      valor: punto.valor,
      comparado: comparado?.valor ?? "",
      variacion: variacion !== null ? `${variacion >= 0 ? "+" : ""}${variacion.toFixed(1)}%` : "",
    };
  });

  const nombreDeComunidad = (id) => listaComunidades.find((c) => c.id === id)?.nombre ?? "";

  return (
    <div>
      <div className="reporte-barra">
        <p className="reporte-barra-texto">
          Volumen de atención por periodo y comunidad, con comparación opcional.
        </p>
        <AccionesDeCabecera
          actions={[
            {
              key: "csv",
              custom: (
                <BotonExportarCSV
                  onClick={() =>
                    descargarCSV(
                      COLUMNAS_DE_SERIE,
                      filasDeSerie,
                      `panel-impacto-${aCadenaFechaLocal()}.csv`,
                    )
                  }
                  disabled={filasDeSerie.length === 0}
                />
              ),
            },
            {
              key: "imprimir",
              custom: (
                <BotonImprimir
                  onClick={() => setImprimiendo(true)}
                  disabled={filasDeSerie.length === 0}
                />
              ),
            },
          ]}
        />
      </div>

      <Card>
        <span className="ec-rotulo">Rango de fechas</span>
        <div className="reporte-presets">
          {rangosDisponibles.map((rango) => (
            <button
              key={rango.value}
              type="button"
              onClick={() => setRangoSeleccionado(rango.value)}
              aria-pressed={rangoSeleccionado === rango.value}
              className={`btn btn-sm ${
                rangoSeleccionado === rango.value ? "btn-primary" : "btn-outline-secondary"
              }`}
            >
              {rango.label}
            </button>
          ))}
        </div>

        <div className="reporte-filtros">
          {/* ISSUE #862: este selector no existia. El hook expone cinco metricas y la pantalla
              mostraba siempre la primera. */}
          <Selector
            label="Métrica"
            value={metrica}
            options={metricasDisponibles}
            onSelect={setMetrica}
          />

          <Selector
            label="Agrupar por"
            value={agruparPor}
            options={agrupamientosDisponibles}
            onSelect={setAgruparPor}
          />

          <Selector
            label="Comunidad"
            value={comunidadId}
            options={[
              { value: TODAS, label: "Todas las comunidades" },
              ...listaComunidades.map((c) => ({ value: c.id, label: c.nombre })),
            ]}
            onSelect={setComunidadId}
          />

          {/* Misma estructura que Selector -Form.Group + Form.Label + control- y no un <div> con
              un <label> suelto: con el `align-items: end` de .reporte-filtros, un item construido
              distinto no alinea su rotulo con el de los demas, y este quedaba descolgado. */}
          <Form.Group className="mb-3">
            <Form.Label htmlFor="impacto-comparar">Comparar con</Form.Label>
            <div className="d-flex align-items-center gap-2">
              <Form.Check
                type="checkbox"
                className="mb-0"
                aria-label="Activar la comparación"
                checked={modoComparacion}
                onChange={(evento) => setModoComparacion(evento.target.checked)}
              />
              <Form.Select
                id="impacto-comparar"
                aria-label="Comunidad con la que comparar"
                value={comunidadCompararId}
                onChange={(evento) => setComunidadCompararId(evento.target.value)}
                disabled={!modoComparacion}
              >
                <option value={NINGUNA}>— Ninguna —</option>
                {listaComunidades.map((comunidad) => (
                  <option key={comunidad.id} value={comunidad.id}>
                    {comunidad.nombre}
                  </option>
                ))}
              </Form.Select>
            </div>
          </Form.Group>
        </div>
      </Card>

      <div className="ec-kpis">
        <TarjetaMetrica
          etiqueta="Pacientes atendidos"
          valor={indicadores?.pacientesAtendidos || 0}
          meta={METAS_DE_IMPACTO.pacientesAtendidos}
          acento="var(--color-primary)"
        />
        <TarjetaMetrica
          etiqueta="Consultas realizadas"
          valor={indicadores?.consultasRealizadas || 0}
          acento="var(--color-info)"
        />
        <TarjetaMetrica
          etiqueta="Comunidades beneficiadas"
          valor={indicadores?.comunidadesBeneficiadas || 0}
          meta={METAS_DE_IMPACTO.comunidadesBeneficiadas}
          acento="var(--color-info)"
        />
        <TarjetaMetrica
          etiqueta="Tratamientos entregados"
          valor={indicadores?.tratamientosEntregados || 0}
          meta={METAS_DE_IMPACTO.tratamientosEntregados}
          acento="var(--color-warning)"
        />
        <TarjetaMetrica
          etiqueta="Medicamentos utilizados"
          valor={indicadores?.medicamentosUtilizados || 0}
          meta={METAS_DE_IMPACTO.medicamentosUtilizados}
          acento="var(--color-danger)"
        />
      </div>

      <div
        className={
          tieneComparacion ? "reporte-graficas reporte-graficas--doble" : "reporte-graficas"
        }
      >
        <Card>
          <GraficaDeBarras
            titulo={`${etiquetaDeMetrica} · ${etiquetaDeAgrupacion}`}
            serie={seriePrincipal}
            serieComparacion={serieComparacion}
            nombreSerie={comunidadId === TODAS ? "Todas" : nombreDeComunidad(comunidadId)}
            nombreComparacion={nombreDeComunidad(comunidadCompararId)}
          />
        </Card>

        {tieneComparacion && (
          <Card>
            <h2 className="ec-seccion-titulo">Variación porcentual</h2>
            <div className="d-flex flex-column gap-2">
              {seriePrincipal.map((punto, indice) => {
                const comparado = serieComparacion[indice];
                if (!comparado) return null;
                const variacion = calcularVariacion(punto.valor, comparado.valor);
                if (variacion === null) return null;
                return (
                  <div
                    key={punto.etiqueta ?? indice}
                    className={`reporte-variacion ${
                      variacion >= 0 ? "reporte-variacion--sube" : "reporte-variacion--baja"
                    }`}
                  >
                    <span>{punto.etiqueta}</span>
                    <strong>
                      {variacion >= 0 ? "↑" : "↓"} {Math.abs(variacion).toFixed(1)}%
                    </strong>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {imprimiendo && (
        <ReporteImprimible
          titulo="Indicadores de impacto"
          periodo={`${etiquetaDeMetrica} · ${etiquetaDeAgrupacion}`}
          totales={[
            { etiqueta: "Pacientes atendidos", valor: indicadores?.pacientesAtendidos ?? 0 },
            { etiqueta: "Consultas realizadas", valor: indicadores?.consultasRealizadas ?? 0 },
            {
              etiqueta: "Comunidades beneficiadas",
              valor: indicadores?.comunidadesBeneficiadas ?? 0,
            },
            {
              etiqueta: "Tratamientos entregados",
              valor: indicadores?.tratamientosEntregados ?? 0,
            },
            {
              etiqueta: "Medicamentos utilizados",
              valor: indicadores?.medicamentosUtilizados ?? 0,
            },
          ]}
          secciones={[{ columnas: COLUMNAS_DE_SERIE, filas: filasDeSerie }]}
          alTerminar={() => setImprimiendo(false)}
        />
      )}
    </div>
  );
}
