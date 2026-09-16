import { useState } from "react";

import {
  COLUMNAS_PRINCIPIO_ACTIVO,
  FILTROS_PRINCIPIOS_ACTIVOS,
  useCatalogoPrincipiosActivos,
} from "@ecopac/shared";

import DataList from "../components/DataList";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalPrincipioActivo from "./ModalPrincipioActivo";
import "./pacientes.css";

// Pantalla del catalogo de principios activos (issue #640). api.js y permisos.js del catalogo
// ya existian (issue #141): esta issue solo pedia la pantalla.
//
// Se monta embebida como una pestania mas de InventarioPage.jsx -mismo patron que
// BandejaValidacionPage.jsx para la pestania Validacion- desde la issue #756: antes tenia su
// propia ruta y su propio ScreenContainer/"Volver", asi que elegirla desde la barra de pestanias
// cambiaba de pantalla en vez de quedarse en el mismo Inventario, a diferencia de Catalogo,
// Kardex, Administracion y Validacion. Sin ScreenContainer ni "Volver" el componente ya no es
// una pagina de nivel superior por si solo: quien lo necesite para otra cosa lo envuelve.
export default function CatalogoPrincipiosActivosPage() {
  const { rol } = useSesionCompartida();
  const [modal, setModal] = useState(null); // null | { principioActivo: object|null }

  const {
    filas,
    total,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros,
    cargando,
    error,
    recargar,
    guardar,
    eliminar,
    permisos,
  } = useCatalogoPrincipiosActivos({ rol });

  if (!permisos.puedeVer) {
    return <ErrorState message="No tienes acceso al catalogo de principios activos." />;
  }

  if (error) {
    return <ErrorState message={error.mensaje} onRetry={recargar} />;
  }

  return (
    <div className="modulo-pacientes">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h4 className="fw-bold mb-1">Catalogo de principios activos</h4>
          <p className="text-muted small mb-0">
            Principios activos disponibles para el catalogo de medicamentos
          </p>
        </div>
        {permisos.puedeCrear && (
          <button
            type="button"
            className="btn btn-success"
            onClick={() => setModal({ principioActivo: null })}
          >
            Nuevo principio activo
          </button>
        )}
      </div>

      <div className="pac-filtros">
        <FilterBar campos={FILTROS_PRINCIPIOS_ACTIVOS} valores={filtros} onChange={setFiltro} />
      </div>

      <p className="pac-rotulo mb-2">
        {total === 1 ? "1 principio activo" : `${total} principios activos`}
      </p>

      <div className="ec-tabla">
        <DataList
          columnas={COLUMNAS_PRINCIPIO_ACTIVO}
          datos={filas}
          cargando={cargando}
          onRowPress={
            permisos.puedeEditar ? (fila) => setModal({ principioActivo: fila }) : undefined
          }
          vacio={
            hayFiltros ? (
              <EmptyState
                message="Ningun principio activo coincide con la busqueda."
                actionLabel="Limpiar busqueda"
                onAction={limpiarFiltros}
              />
            ) : (
              <EmptyState message="Todavia no hay principios activos en el catalogo." />
            )
          }
        />
      </div>

      {modal && (
        <ModalPrincipioActivo
          visible
          principioActivo={modal.principioActivo}
          onClose={() => setModal(null)}
          onGuardar={guardar}
          onEliminar={eliminar}
        />
      )}
    </div>
  );
}
