import { useState } from "react";

import {
  COLUMNAS_MIS_MOVIMIENTOS,
  FILTROS_MIS_MOVIMIENTOS,
  OPCIONES_TIPO_MOVIMIENTO,
  useMisMovimientos,
} from "@ecopac/shared";

import DataList from "../components/DataList";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalCorreccionMovimiento from "./ModalCorreccionMovimiento";

// Pantalla "Mis movimientos" (issue #756): editarMovimiento() (movimientos.api.js) existia desde
// la issue #625 sin ninguna pantalla que la llamara. Se monta embebida como una pestania mas de
// InventarioPage.jsx -mismo patron que BandejaValidacionPage.jsx para la pestania Validacion-, no
// como una pagina con ruta propia: el resto de pestanias de Inventario (Catalogo, Kardex,
// Administracion, Validacion) tampoco cambian de ventana al elegirse.
//
// Quien puede aprobar movimientos ve el filtro "Ver" (mios/todos); el resto siempre ve solo lo
// propio, sin ese control -RLS deja leer cualquier movimiento (00034/00079), asi que "todos" es
// una decision de que muestra la interfaz, no algo que el servidor le niegue a nadie, pero
// ofrecerlo a quien no aprueba no tiene utilidad y confunde el alcance de la pantalla.
export default function MisMovimientosPage() {
  const { perfil, rol } = useSesionCompartida();
  const [modal, setModal] = useState(null); // null | { movimiento: object }

  const {
    movimientos,
    total,
    filtros,
    setFiltro,
    cargando,
    error,
    recargar,
    editar,
    puedeVer,
    puedeVerTodos,
  } = useMisMovimientos({ usuarioId: perfil?.id, rolUsuario: rol });

  if (!puedeVer) {
    return <ErrorState message="No tienes acceso a esta pantalla." />;
  }

  if (error) {
    return <ErrorState message={error.mensaje} onRetry={recargar} />;
  }

  const campos = puedeVerTodos
    ? FILTROS_MIS_MOVIMIENTOS
    : FILTROS_MIS_MOVIMIENTOS.filter((campo) => campo.id !== "alcance");

  return (
    <div className="modulo-pacientes">
      <div className="mb-3">
        <h4 className="fw-bold mb-1">Mis movimientos</h4>
        <p className="text-muted small mb-0">
          Movimientos de inventario que registraste
          {puedeVerTodos && filtros.alcance === "todos" ? " (viendo los de todo el mundo)" : ""}
        </p>
      </div>

      <div className="pac-filtros">
        <FilterBar campos={campos} valores={filtros} onChange={setFiltro} />
      </div>

      <p className="pac-rotulo mb-2">
        {total === 1 ? "1 movimiento" : `${total} movimientos`}
      </p>

      <div className="pac-tabla">
        <DataList
          columnas={COLUMNAS_MIS_MOVIMIENTOS}
          datos={movimientos}
          cargando={cargando}
          catalogos={{ tiposMovimiento: OPCIONES_TIPO_MOVIMIENTO }}
          onRowPress={(fila) => setModal({ movimiento: fila })}
          vacio="No hay movimientos que coincidan con el filtro."
        />
      </div>

      {modal && (
        <ModalCorreccionMovimiento
          visible
          movimiento={modal.movimiento}
          onClose={() => setModal(null)}
          onGuardar={editar}
        />
      )}
    </div>
  );
}
