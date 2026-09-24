import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  aCadenaFechaLocal,
  formatearFechaCorta,
  useReporteMedicamentosPorVencer,
} from "@ecopac/shared";
import DashboardMetricasPage from "./DashboardMetricasPage";
import ReporteImprimible from "./ReporteImprimible";
import ReporteInventarioPage from "./ReporteInventarioPage";
import ReportePacientesPage from "./ReportePacientesPage";
import BotonExportarCSV from "../components/BotonExportarCSV";
import BotonImprimir from "../components/BotonImprimir";
import DataList from "../components/DataList";
import descargarCSV from "../components/descargarCSV";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import LoadingState from "../components/LoadingState";
import PageHeader, { AccionesDeCabecera } from "../components/PageHeader";
import Paginacion from "../components/Paginacion";
import ScreenContainer from "../components/ScreenContainer";
import StatCard from "../components/StatCard";
import Tabs from "../components/Tabs";
import { useSesionCompartida } from "../contexto/SesionProvider";
import "./reportes.css";

// Hub de reportes.
//
// CADA PESTANA ES UNA RUTA. "Pacientes atendidos" era un boton con aspecto de pestana que
// navegaba a otra pagina -ReportePacientesPage, con su propia cabecera y SIN las pestanas-, asi
// que desde ahi no habia forma de volver a las otras dos salvo el boton "atras" del navegador.
// Ahora las cuatro pestanas viven aqui y cada una tiene su direccion: el boton "atras" sigue
// funcionando, una pestana se puede enlazar, y la fila de pestanas no desaparece nunca.
//
// "Inventario actual" (/reportes/inventario-actual) era una ruta sin ningun enlace que llevara a
// ella: el reporte existia y nadie podia abrirlo sin escribir la direccion a mano.
const PESTANAS = [
  { id: "dashboard", label: "Dashboard de impacto", ruta: "/reportes" },
  {
    id: "vencimientos",
    label: "Medicamentos por vencer",
    ruta: "/reportes/medicamentos-por-vencer",
  },
  { id: "pacientes", label: "Pacientes atendidos", ruta: "/reportes/pacientes-atendidos" },
  { id: "inventario", label: "Inventario actual", ruta: "/reportes/inventario-actual" },
];

/** La pestana que corresponde a una ruta. `/reportes` y `/reportes/dashboard` son el panel. */
function pestanaDeRuta(pathname = "") {
  const encontrada = PESTANAS.find(
    (pestana) => pestana.id !== "dashboard" && pathname.startsWith(pestana.ruta),
  );
  return encontrada?.id ?? "dashboard";
}

export default function ReportesPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pestanaActiva = pestanaDeRuta(pathname);

  const cambiarPestana = (id) => {
    const destino = PESTANAS.find((pestana) => pestana.id === id);
    if (destino && destino.id !== pestanaActiva) navigate(destino.ruta);
  };

  return (
    <ScreenContainer>
      <PageHeader
        title="Reportes e impacto"
        subtitle="Métricas, estadísticas y volumen de atención"
      />

      <Tabs tabs={PESTANAS} activo={pestanaActiva} onChange={cambiarPestana}>
        {pestanaActiva === "dashboard" && <DashboardMetricasPage />}
        {pestanaActiva === "vencimientos" && <PestanaMedicamentosPorVencer />}
        {pestanaActiva === "pacientes" && <ReportePacientesPage incrustado />}
        {pestanaActiva === "inventario" && <ReporteInventarioPage incrustado />}
      </Tabs>
    </ScreenContainer>
  );
}

/**
 * Pestana de medicamentos proximos a vencer.
 *
 * ISSUE #862. Era la unica pantalla del modulo que dibujaba su propia <Table> de react-bootstrap
 * y sus propios <select>, fuera de DataList y fuera de todo descriptor -- porque columnas.js
 * afirmaba que la API de este reporte "todavia no existe", cosa que dejo de ser cierta hace
 * tiempo. Ahora usa FilterBar + DataList + Paginacion como las demas, con COLUMNAS_VENCIMIENTO y
 * FILTROS_VENCIMIENTOS, y gana el "Exportar CSV" que era la unica pestana sin el.
 */
function PestanaMedicamentosPorVencer() {
  const { rol } = useSesionCompartida();
  const [imprimiendo, setImprimiendo] = useState(false);

  const {
    tieneAcceso,
    cargando,
    error,
    renglones,
    total,
    totalUnidadesEnRiesgo,
    columnas,
    definicionDeFiltros,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros,
    catalogos,
    orden,
    alternarOrden,
    numeroDePagina,
    totalPaginas,
    irAPagina,
    recargar,
  } = useReporteMedicamentosPorVencer({ rol });

  if (!tieneAcceso) {
    return <ErrorState message="Se necesita una sesión activa para consultar los vencimientos." />;
  }

  // aCadenaFechaLocal y no toISOString(): en Guatemala, despues de las 18:00 el dia UTC ya es
  // manana, y el reporte saldria fechado con el dia siguiente (issue #840).
  const periodo = `Horizonte de ${filtros.horizonteDias} días · al ${formatearFechaCorta(
    aCadenaFechaLocal(),
  )}`;

  return (
    <>
      <div className="reporte-barra">
        <p className="reporte-barra-texto">
          Un renglón por lote y bodega, del más urgente al que más plazo tiene.
        </p>
        <AccionesDeCabecera
          actions={[
            {
              key: "csv",
              custom: (
                <BotonExportarCSV
                  onClick={() =>
                    descargarCSV(columnas, renglones, "medicamentos-por-vencer.csv", catalogos)
                  }
                  disabled={renglones.length === 0}
                />
              ),
            },
            {
              key: "imprimir",
              custom: (
                <BotonImprimir
                  onClick={() => setImprimiendo(true)}
                  disabled={renglones.length === 0}
                />
              ),
            },
          ]}
        />
      </div>

      <FilterBar
        campos={definicionDeFiltros}
        valores={filtros}
        onChange={setFiltro}
        catalogos={catalogos}
        onLimpiar={limpiarFiltros}
        hayFiltros={hayFiltros}
      />

      {error ? (
        <ErrorState message={error.mensaje} onRetry={recargar} />
      ) : cargando ? (
        <LoadingState />
      ) : (
        <>
          {/* El total en riesgo va arriba y no al pie: es la cifra por la que se abre este
              reporte, y al pie de una tabla paginada quedaria escondida. */}
          <div className="ec-kpis">
            <StatCard
              label="Unidades en riesgo"
              value={totalUnidadesEnRiesgo.toLocaleString("es-GT")}
              accent="var(--color-warning)"
              caption={`en ${total} ${total === 1 ? "renglón" : "renglones"}`}
            />
          </div>

          <p className="ec-rotulo reporte-conteo">
            {total} {total === 1 ? "renglón" : "renglones"}
          </p>

          <DataList
            columnas={columnas}
            datos={renglones}
            catalogos={catalogos}
            ordenarPor={orden}
            onOrdenar={alternarOrden}
            vacio={
              <EmptyState
                message={
                  hayFiltros
                    ? "Ningún lote coincide con los filtros aplicados."
                    : "Ningún lote vence dentro del horizonte elegido."
                }
                actionLabel={hayFiltros ? "Limpiar filtros" : undefined}
                onAction={hayFiltros ? limpiarFiltros : undefined}
              />
            }
          />

          <Paginacion pagina={numeroDePagina} totalPaginas={totalPaginas} onCambiar={irAPagina} />
        </>
      )}

      {imprimiendo && (
        <ReporteImprimible
          titulo="Medicamentos próximos a vencer"
          periodo={periodo}
          filtrosAplicados={filtrosParaPapel(filtros, catalogos)}
          totales={[
            {
              etiqueta: "Unidades en riesgo",
              valor: totalUnidadesEnRiesgo.toLocaleString("es-GT"),
            },
            { etiqueta: "Renglones", valor: total },
          ]}
          secciones={[{ columnas, filas: renglones }]}
          catalogos={catalogos}
          alTerminar={() => setImprimiendo(false)}
        />
      )}
    </>
  );
}

/** Los criterios aplicados, en texto, para que el papel diga de que es el recorte. */
function filtrosParaPapel(filtros, catalogos) {
  const etiqueta = (lista, valor) => lista?.find((o) => o.value === valor)?.label;

  return [
    { etiqueta: "Horizonte", valor: `${filtros.horizonteDias} días` },
    filtros.bodega && {
      etiqueta: "Bodega",
      valor: etiqueta(catalogos.bodegas, filtros.bodega) ?? filtros.bodega,
    },
    filtros.medicamento && {
      etiqueta: "Medicamento",
      valor: etiqueta(catalogos.medicamentos, filtros.medicamento) ?? filtros.medicamento,
    },
    filtros.estadoVencimiento && {
      etiqueta: "Estado",
      valor:
        etiqueta(catalogos.estadosDeVencimientoReporte, filtros.estadoVencimiento) ??
        filtros.estadoVencimiento,
    },
  ].filter(Boolean);
}
