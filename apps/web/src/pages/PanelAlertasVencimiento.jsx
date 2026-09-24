import { useState } from "react";
import { atenderAlerta, marcarComoAtendida, useAlertasVencimiento } from "@ecopac/shared";
import DataList from "../components/DataList";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import ModalAtencionAlerta from "./ModalAtencionAlerta";

// Etiquetas de acción
const ETIQUETAS_ACCION = {
  consumir: "Consumido",
  descartar: "Descartado / dado de baja",
  reubicar: "Reubicado",
};

export default function PanelAlertasVencimiento() {
  const {
    porVencer = [],
    vencidas = [],
    atendidas = [],
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
                  { id: "lote", label: "Lote" },
                  { id: "producto", label: "Producto" },
                  { id: "bodega", label: "Bodega" },
                  { id: "cantidad", label: "Cantidad", tipo: "numero" },
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
                  { id: "lote", label: "Lote" },
                  { id: "producto", label: "Producto" },
                  { id: "bodega", label: "Bodega" },
                  { id: "cantidad", label: "Cantidad", tipo: "numero" },
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
                  { id: "lote", label: "Lote" },
                  { id: "producto", label: "Producto" },
                  {
                    id: "accion",
                    label: "Acción tomada",
                    formatear: (fila) => ETIQUETAS_ACCION[fila.accionTomada] || fila.accionTomada,
                  },
                  {
                    id: "atendidoPor",
                    label: "Atendido por",
                    formatear: (fila) => fila.nombreResponsable || "—",
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

      {alertaSeleccionada && (
        <ModalAtencionAlerta
          alerta={alertaSeleccionada}
          onCerrar={() => setAlertaSeleccionada(null)}
          onConfirmar={async (datosAtencion) => {
            await marcarComoAtendida(alertaSeleccionada.id, datosAtencion);
            setAlertaSeleccionada(null);
            recargar();
          }}
        />
      )}
    </ScreenContainer>
  );
}
