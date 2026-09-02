import { useMemo, useState } from "react";
import {
  COLUMNAS_GASTO,
  ESTADOS_DE_GASTO,
  ETIQUETAS_ESTADO_GASTO,
  FILTROS_GASTO,
} from "@ecopac/shared";

import { DataList, ErrorState, FilterBar, PrimaryButton, Tabs } from "../components";
import ModalGasto from "./ModalGasto";

// Pestaña "Gastos" de PresupuestosPage.jsx (issue #302). Los datos, columnas y filtros salen de
// useEjecucionPresupuestal() y de los descriptores de shared; este archivo solo dibuja.
//
// Tabs (criterio 2) mapean directo al `filtroEstado` del hook: "Todos" es filtroEstado === "".
// El resto de filtros (criterio 3: categoria, proyecto, rango de fecha) usa FilterBar con
// FILTROS_GASTO menos el de estado -ese ya lo cubren los tabs- y menos el de busqueda -
// listarGastos() no acepta texto libre, mismo criterio que JornadasPage.jsx aplica a
// FILTROS_JORNADA-.
const TABS_ESTADO = [
  { id: "", label: "Todos" },
  { id: ESTADOS_DE_GASTO.APROBADO, label: ETIQUETAS_ESTADO_GASTO[ESTADOS_DE_GASTO.APROBADO] },
  { id: ESTADOS_DE_GASTO.PENDIENTE, label: ETIQUETAS_ESTADO_GASTO[ESTADOS_DE_GASTO.PENDIENTE] },
  { id: ESTADOS_DE_GASTO.RECHAZADO, label: ETIQUETAS_ESTADO_GASTO[ESTADOS_DE_GASTO.RECHAZADO] },
];

const FILTROS_SIN_ESTADO_NI_BUSQUEDA = FILTROS_GASTO.filter(
  (filtro) => filtro.id !== "estado" && filtro.id !== "busqueda",
);

export default function TablaGastos({
  gastos,
  catalogos,
  filtroEstado,
  cambiarFiltroEstado,
  cargando,
  error,
  recargar,
  puedeCrear,
  usuarioId,
  rol,
}) {
  const [filtrosAdicionales, setFiltrosAdicionales] = useState({});
  const [gastoEnEdicion, setGastoEnEdicion] = useState(null);
  const [mostrarAlta, setMostrarAlta] = useState(false);

  const cambiarFiltro = (id, valor) => {
    setFiltrosAdicionales((anteriores) => ({ ...anteriores, [id]: valor }));
  };

  // El filtrado por categoria/proyecto/rango de fecha ocurre en el cliente: useEjecucionPresupuestal()
  // solo aplica filtroEstado en su listarGastos() (ver seccion 1 del PLAN.md, no se toco el
  // contrato del hook mas alla de agregar catalogos). Filtrar aca, sobre lo que el hook ya trajo,
  // evita duplicar la logica de filtrado de la base en el cliente.
  const gastosFiltrados = useMemo(() => {
    return gastos.filter((gasto) => {
      if (filtrosAdicionales.categoria && gasto.categoria !== filtrosAdicionales.categoria) {
        return false;
      }
      if (filtrosAdicionales.proyecto_id && gasto.proyecto_id !== filtrosAdicionales.proyecto_id) {
        return false;
      }
      if (filtrosAdicionales.jornada_id && gasto.jornada_id !== filtrosAdicionales.jornada_id) {
        return false;
      }
      const rango = filtrosAdicionales.fecha;
      if (rango?.min && gasto.fecha < rango.min) return false;
      if (rango?.max && gasto.fecha > rango.max) return false;
      return true;
    });
  }, [gastos, filtrosAdicionales]);

  if (error) return <ErrorState message={error.mensaje} onRetry={recargar} />;

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <Tabs
          tabs={TABS_ESTADO}
          activo={filtroEstado || ""}
          onChange={(id) => cambiarFiltroEstado(id)}
        />
        {puedeCrear && (
          <PrimaryButton title="Registrar gasto" onClick={() => setMostrarAlta(true)} />
        )}
      </div>

      <FilterBar
        campos={FILTROS_SIN_ESTADO_NI_BUSQUEDA}
        valores={filtrosAdicionales}
        onChange={cambiarFiltro}
        catalogos={catalogos}
      />

      <DataList
        columnas={COLUMNAS_GASTO}
        datos={gastosFiltrados}
        cargando={cargando}
        vacio="No hay gastos que coincidan con estos filtros."
        catalogos={catalogos}
        onRowPress={(gasto) => setGastoEnEdicion(gasto)}
      />

      {mostrarAlta && (
        <ModalGasto
          usuarioId={usuarioId}
          rol={rol}
          onClose={() => setMostrarAlta(false)}
          onGuardado={() => {
            setMostrarAlta(false);
            recargar();
          }}
        />
      )}

      {gastoEnEdicion && (
        <ModalGasto
          key={gastoEnEdicion.id}
          gasto={gastoEnEdicion}
          usuarioId={usuarioId}
          rol={rol}
          onClose={() => setGastoEnEdicion(null)}
          onGuardado={() => {
            setGastoEnEdicion(null);
            recargar();
          }}
        />
      )}
    </div>
  );
}
