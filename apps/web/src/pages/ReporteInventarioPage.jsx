import { useState } from "react";

import { FILTROS_INVENTARIO_REPORTE, formatearMoneda, useReporteInventario } from "@ecopac/shared";
import BotonExportarCSV from "../components/BotonExportarCSV";
import BotonImprimir from "../components/BotonImprimir";
import DataList from "../components/DataList";
import descargarCSV from "../components/descargarCSV";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import LoadingState from "../components/LoadingState";
import Modal from "../components/Modal";
import Paginacion from "../components/Paginacion";
import StatCard from "../components/StatCard";
import CabeceraDeReporte, { ContenedorDeReporte } from "./CabeceraDeReporte";
import ReporteImprimible from "./ReporteImprimible";
import { useSesionCompartida } from "../contexto/SesionProvider";
import "./reportes.css";

// Reporte de inventario actual (issue #212, reconectado por #693).
//
// ISSUE #862. El desglose por lote se dibujaba como UNA SECCION CON SU PROPIA TABLA POR CADA
// MEDICAMENTO, una debajo de otra y sin plegar: con doscientos medicamentos eran doscientas
// tablas apiladas en la misma pagina. Ahora cada fila lleva "Ver lotes" y el desglose se abre en
// un modal, que es el patron de BitacoraAuditoriaPage.

export default function ReporteInventarioPage({ incrustado = false }) {
  const { rol } = useSesionCompartida();
  const [imprimiendo, setImprimiendo] = useState(false);
  const [medicamentoEnDetalle, setMedicamentoEnDetalle] = useState(null);

  const {
    tieneAcceso,
    cargando,
    error,
    medicamentos,
    medicamentosCompletos,
    total,
    totales,
    columnas,
    camposDeLote,
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
    tieneAccesoValorizacion,
    cargandoValorizacion,
    errorValorizacion,
    valorizacion,
    valorizacionPorOrigen,
    columnasValorizacionPorOrigen,
    recargarValorizacion,
  } = useReporteInventario({ rol });

  if (!tieneAcceso) {
    return (
      <ContenedorDeReporte incrustado={incrustado}>
        <CabeceraDeReporte incrustado={incrustado} title="Inventario actual" />
        <ErrorState message="Se necesita una sesion activa para consultar el inventario." />
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
            key: "csv",
            custom: (
              <BotonExportarCSV
                onClick={() =>
                  descargarCSV(columnas, medicamentosCompletos, "inventario-actual.csv", catalogos)
                }
                disabled={medicamentosCompletos.length === 0}
              />
            ),
          },
          {
            key: "imprimir",
            custom: (
              <BotonImprimir
                onClick={() => setImprimiendo(true)}
                disabled={medicamentosCompletos.length === 0}
              />
            ),
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
        <>
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
            <p className="ec-rotulo reporte-conteo">
              {total} {total === 1 ? "medicamento" : "medicamentos"}
            </p>

            <DataList
              columnas={columnas}
              datos={medicamentos}
              catalogos={catalogos}
              ordenarPor={orden}
              onOrdenar={alternarOrden}
              accionSecundaria={{
                label: "Ver lotes",
                onClick: (medicamento) => setMedicamentoEnDetalle(medicamento),
              }}
              vacio={
                <EmptyState
                  message={
                    hayFiltros
                      ? "No hay existencias que coincidan con estos filtros."
                      : "No hay existencias registradas."
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

      <Modal
        visible={Boolean(medicamentoEnDetalle)}
        onClose={() => setMedicamentoEnDetalle(null)}
        title={
          medicamentoEnDetalle
            ? `${medicamentoEnDetalle.medicamento} · ${medicamentoEnDetalle.lotes?.length ?? 0} lotes`
            : ""
        }
      >
        <DataList
          columnas={camposDeLote}
          datos={medicamentoEnDetalle?.lotes ?? []}
          catalogos={catalogos}
          vacio="Sin lotes registrados."
        />
      </Modal>

      {imprimiendo && (
        <ReporteImprimible
          titulo="Inventario actual"
          totales={[
            { etiqueta: "Unidades disponibles", valor: totales.unidadesDisponibles },
            { etiqueta: "Unidades vencidas", valor: totales.unidadesVencidas },
            { etiqueta: "Medicamentos distintos", valor: totales.medicamentosDistintos },
            { etiqueta: "Renglones", valor: totales.renglonesDeInventario },
          ]}
          secciones={[{ columnas, filas: medicamentosCompletos }]}
          catalogos={catalogos}
          alTerminar={() => setImprimiendo(false)}
        />
      )}
    </ContenedorDeReporte>
  );
}
