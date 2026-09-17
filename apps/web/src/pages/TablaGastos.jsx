import { useMemo, useState } from "react";
import { COLUMNAS_GASTO, FILTROS_GASTO } from "@ecopac/shared";

import { DataList, ErrorState, FilterBar, PrimaryButton } from "../components";
import ModalGasto from "./ModalGasto";

// Pestaña "Gastos" de PresupuestosPage.jsx (issue #302). Los datos, columnas y filtros salen de
// useEjecucionPresupuestal() y de los descriptores de shared; este archivo solo dibuja.
//
// Tabs (criterio 2) mapean directo al `filtroEstado` del hook: "Todos" es filtroEstado === "".
// El resto de filtros (criterio 3: categoria, proyecto, rango de fecha) usa FilterBar con
// FILTROS_GASTO menos el de estado -ese ya lo cubren los tabs- y menos el de busqueda -
// listarGastos() no acepta texto libre, mismo criterio que JornadasPage.jsx aplica a
// FILTROS_JORNADA-.
// EL ESTADO ERA UNA SEGUNDA FILA DE PESTANIAS, DENTRO DE LA PESTANIA "GASTOS".
//
// PresupuestosPage ya usa <Tabs> para su nivel superior (Resumen / Gastos / Aprobaciones), y
// esta pantalla montaba otro <Tabs> identico justo debajo para filtrar por estado. Dos filas de
// pestanias iguales, una dentro de la otra, sin nada que dijera cual manda: era la razon
// principal de que presupuestos no se pareciera a ningun otro modulo, donde un listado tiene
// UNA barra de filtros y punto.
//
// El estado no es una seccion de la pantalla, es un filtro mas -y FILTROS_GASTO ya lo declara
// como tal-, asi que vuelve a la barra de filtros con los otros cuatro. Lo unico que lo
// distingue es que este si viaja al servidor: useEjecucionPresupuestal() lo pasa a
// listarGastos(), mientras que los demas se aplican en el cliente sobre lo ya traido.
const FILTROS_SIN_BUSQUEDA = FILTROS_GASTO.filter((filtro) => filtro.id !== "busqueda");

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

  // El estado es el unico filtro que viaja al servidor; el resto se aplica aqui abajo sobre lo
  // que el hook ya trajo. Desde fuera se manejan igual, que es lo que importa para quien usa la
  // pantalla.
  const cambiarFiltro = (id, valor) => {
    if (id === "estado") {
      cambiarFiltroEstado(valor ?? "");
      return;
    }
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

  const valoresDeFiltro = { ...filtrosAdicionales, estado: filtroEstado || null };

  const hayFiltros =
    Boolean(filtroEstado) ||
    Object.values(filtrosAdicionales).some((valor) =>
      valor && typeof valor === "object" ? Boolean(valor.min || valor.max) : Boolean(valor),
    );

  const limpiarFiltros = () => {
    setFiltrosAdicionales({});
    cambiarFiltroEstado("");
  };

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex justify-content-end">
        {puedeCrear && (
          <PrimaryButton title="Registrar gasto" onClick={() => setMostrarAlta(true)} />
        )}
      </div>

      {/* Misma tarjeta de filtros que el listado de pacientes, para que los dos listados del
        sistema se manejen igual. */}
      <FilterBar
        campos={FILTROS_SIN_BUSQUEDA}
        valores={valoresDeFiltro}
        onChange={cambiarFiltro}
        catalogos={catalogos}
        onLimpiar={limpiarFiltros}
        hayFiltros={hayFiltros}
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
