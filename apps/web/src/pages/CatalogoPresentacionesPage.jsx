import { useState } from "react";

import { COLUMNAS_PRESENTACION, FILTROS_PRESENTACIONES, useCatalogoPresentaciones } from "@ecopac/shared";

import DataList from "../components/DataList";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalPresentacion from "./ModalPresentacion";
import "./pacientes.css";
import SectionHeader from "../components/SectionHeader";

// Pantalla del catalogo de presentaciones (PLAN.md punto 11, 00144). Mismo patron exacto que
// CatalogoPrincipiosActivosPage.jsx: se monta embebida como una pestania mas de
// InventarioPage.jsx, sin ScreenContainer ni "Volver" propios.
export default function CatalogoPresentacionesPage() {
  const { rol } = useSesionCompartida();
  const [modal, setModal] = useState(null); // null | { presentacion: object|null }

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
  } = useCatalogoPresentaciones({ rol });

  if (!permisos.puedeVer) {
    return <ErrorState message="No tienes acceso al catálogo de presentaciones." />;
  }

  if (error) {
    return <ErrorState message={error.mensaje} onRetry={recargar} />;
  }

  return (
    <div className="modulo-pacientes">
      <SectionHeader
        title="Catálogo de presentaciones"
        subtitle="Presentaciones disponibles para el catálogo de medicamentos"
        actions={
          permisos.puedeCrear
            ? [
                {
                  label: "Nueva presentación",
                  onClick: () => setModal({ presentacion: null }),
                },
              ]
            : []
        }
      />

      <div className="pac-filtros">
        <FilterBar campos={FILTROS_PRESENTACIONES} valores={filtros} onChange={setFiltro} />
      </div>

      <p className="pac-rotulo mb-2">
        {total === 1 ? "1 presentación" : `${total} presentaciones`}
      </p>

      <div className="ec-tabla">
        <DataList
          columnas={COLUMNAS_PRESENTACION}
          datos={filas}
          cargando={cargando}
          onRowPress={permisos.puedeEditar ? (fila) => setModal({ presentacion: fila }) : undefined}
          vacio={
            hayFiltros ? (
              <EmptyState
                message="Ninguna presentación coincide con la búsqueda."
                actionLabel="Limpiar búsqueda"
                onAction={limpiarFiltros}
              />
            ) : (
              <EmptyState message="Todavía no hay presentaciones en el catálogo." />
            )
          }
        />
      </div>

      {modal && (
        <ModalPresentacion
          visible
          presentacion={modal.presentacion}
          onClose={() => setModal(null)}
          onGuardar={guardar}
          onEliminar={eliminar}
        />
      )}
    </div>
  );
}
