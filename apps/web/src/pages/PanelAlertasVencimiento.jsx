import { useState } from "react";
import { ETIQUETAS_ACCION_ALERTA, useAlertasVencimiento } from "@ecopac/shared";
import DataList from "../components/DataList";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
//import ModalAtencionAlerta from "./ModalAtencionAlerta";

/**
 * Una alerta atendida con una sola acción trae `accion`; con varias (issue #143) esa columna
 * queda NULL y el desglose vive en `detalle`. `bodegas` traduce bodegaDestinoId a nombre para
 * un reubicado.
 */
function etiquetaAccionTomada(fila, bodegas) {
  if (fila.accion) return ETIQUETAS_ACCION_ALERTA[fila.accion] ?? fila.accion;

  if (fila.detalle?.length > 0) {
    return fila.detalle
      .map((item) => {
        const etiqueta = ETIQUETAS_ACCION_ALERTA[item.accion] ?? item.accion;
        const bodega = item.bodegaDestinoId
          ? bodegas.find((b) => b.id === item.bodegaDestinoId)?.nombre
          : null;
        return `${etiqueta} (${item.cantidad}${bodega ? ` → ${bodega}` : ""})`;
      })
      .join(", ");
  }

  return "—";
}

export default function PanelAlertasVencimiento() {
  const {
    porVencer = [],
    vencidas = [],
    atendidas = [],
    bodegas = [],
    cargando,
    error,
    recargar,
    setBusqueda,
  } = useAlertasVencimiento();

  const [alertaSeleccionada, setAlertaSeleccionada] = useState(null);

  if (cargando) {
    return (
      <ScreenContainer>
        <PageHeader title="Alertas de vencimiento" />
        <LoadingState mensaje="Cargando alertas…" />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <PageHeader title="Alertas de vencimiento" />
        <ErrorState mensaje={error.mensaje} onReintentar={recargar} />
      </ScreenContainer>
    );
  }

  const hayPendientes = porVencer.length > 0 || vencidas.length > 0;

  return (
    <ScreenContainer>
      <PageHeader title="Alertas de vencimiento" />

      {/* Buscador */}
      <div className="mb-3">
        <input
          type="search"
          className="form-control"
          placeholder="Buscar por lote, producto o bodega…"
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {!hayPendientes && atendidas.length === 0 ? (
        <EmptyState mensaje="No hay alertas de vencimiento." />
      ) : (
        <>
          {/*  Bloque 1: Por vencer */}
          {porVencer.length > 0 && (
            <div className="mb-5">
              <h3 className="h5 mb-3">Por vencer ({porVencer.length})</h3>
              <DataList
                columnas={[
                  { id: "numeroLote", label: "Lote" },
                  { id: "medicamento", label: "Producto" },
                  { id: "cantidadDisponible", label: "Cantidad", tipo: "numero" },
                  { id: "fechaVencimiento", label: "Vencimiento", tipo: "fecha" },
                ]}
                datos={porVencer}
                onRowPress={setAlertaSeleccionada}
              />
            </div>
          )}

          {/*  Bloque 2: Vencidas */}
          {vencidas.length > 0 && (
            <div className="mb-5">
              <h3 className="h5 mb-3 text-danger">Vencidas ({vencidas.length})</h3>
              <DataList
                columnas={[
                  { id: "numeroLote", label: "Lote" },
                  { id: "medicamento", label: "Producto" },
                  { id: "cantidadDisponible", label: "Cantidad", tipo: "numero" },
                  { id: "fechaVencimiento", label: "Vencimiento", tipo: "fecha" },
                ]}
                datos={vencidas}
                onRowPress={setAlertaSeleccionada}
              />
            </div>
          )}

          {/*  Bloque 3: Atendidas con acción y responsable */}
          {atendidas.length > 0 && (
            <div className="mt-6">
              <h3 className="h5 mb-3">Atendidas ({atendidas.length})</h3>
              <DataList
                columnas={[
                  { id: "numeroLote", label: "Lote" },
                  { id: "medicamento", label: "Producto" },
                  {
                    id: "accion",
                    label: "Acción tomada",
                    formatear: (fila) => etiquetaAccionTomada(fila, bodegas),
                  },
                  {
                    id: "atendidaPorNombre",
                    label: "Atendido por",
                    formatear: (fila) => fila.atendidaPorNombre || "—",
                  },
                ]}
                datos={atendidas}
                vacio={null}
              />
            </div>
          )}

          {!hayPendientes && atendidas.length === 0 && (
            <EmptyState mensaje="No hay alertas pendientes ni atendidas." />
          )}
        </>
      )}
    </ScreenContainer>
  );
}
