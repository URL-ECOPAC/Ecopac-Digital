import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  COLUMNAS_PRINCIPIO_ACTIVO,
  FILTROS_PRINCIPIOS_ACTIVOS,
  useCatalogoPrincipiosActivos,
} from "@ecopac/shared";

import DataList from "../components/DataList";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalPrincipioActivo from "./ModalPrincipioActivo";
import "./pacientes.css";

// Pantalla del catalogo de principios activos (issue #640). api.js y permisos.js del catalogo
// ya existian (issue #141): esta issue solo pedia la pantalla. Mismo patron que
// CatalogoDiagnosticosPage.jsx: PageHeader + FilterBar + DataList, sin maestro-detalle.
export default function CatalogoPrincipiosActivosPage() {
  const navigate = useNavigate();
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
    return (
      <ScreenContainer>
        <div className="modulo-pacientes">
          <PageHeader
            title="Catalogo de principios activos"
            actions={[
              { label: "Volver", onClick: () => navigate("/inventario"), variant: "secondary" },
            ]}
          />
          <ErrorState message="No tienes acceso al catalogo de principios activos." />
        </div>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <div className="modulo-pacientes">
          <PageHeader
            title="Catalogo de principios activos"
            actions={[
              { label: "Volver", onClick: () => navigate("/inventario"), variant: "secondary" },
            ]}
          />
          <ErrorState message={error.mensaje} onRetry={recargar} />
        </div>
      </ScreenContainer>
    );
  }

  const acciones = [
    { label: "Volver", onClick: () => navigate("/inventario"), variant: "secondary" },
  ];
  if (permisos.puedeCrear) {
    acciones.push({
      label: "Nuevo principio activo",
      onClick: () => setModal({ principioActivo: null }),
    });
  }

  return (
    <ScreenContainer>
      <div className="modulo-pacientes">
        <PageHeader
          title="Catalogo de principios activos"
          subtitle="Principios activos disponibles para el catalogo de medicamentos"
          actions={acciones}
        />

        <div className="pac-filtros">
          <FilterBar campos={FILTROS_PRINCIPIOS_ACTIVOS} valores={filtros} onChange={setFiltro} />
        </div>

        <p className="pac-rotulo mb-2">
          {total === 1 ? "1 principio activo" : `${total} principios activos`}
        </p>

        <div className="pac-tabla">
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
    </ScreenContainer>
  );
}
