import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { COLUMNAS_COMUNIDAD, FILTROS_COMUNIDADES, useCatalogoComunidades } from "@ecopac/shared";

import DataList from "../components/DataList";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalComunidad from "./ModalComunidad";
import "./pacientes.css";

// Pantalla del catalogo de comunidades (issue #756): la 00008 creo comunidades con
// latitud/longitud/referencia_acceso y ningun modulo capturaba ni corregia esas columnas, ni
// tampoco nombre/municipio/es_vigente una vez creada la fila -- solo existia el alta implicita
// desde el registro de paciente (useRegistroPaciente.js). Mismo patron que
// CatalogoPrincipiosActivosPage.jsx: PageHeader + FilterBar + DataList, sin maestro-detalle.
export default function CatalogoComunidadesPage() {
  const navigate = useNavigate();
  const { rol } = useSesionCompartida();
  const [modal, setModal] = useState(null); // null | { comunidad: object|null }

  const {
    comunidades,
    total,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros,
    cargando,
    error,
    recargar,
    guardar,
    erroresForm,
    permisos,
    catalogos,
  } = useCatalogoComunidades({ rol });

  if (!permisos.puedeVer) {
    return (
      <ScreenContainer>
        <div className="modulo-pacientes">
          <PageHeader
            title="Catalogo de comunidades"
            actions={[
              { label: "Volver", onClick: () => navigate("/pacientes"), variant: "neutra" },
            ]}
          />
          <ErrorState message="No tienes acceso al catalogo de comunidades." />
        </div>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <div className="modulo-pacientes">
          <PageHeader
            title="Catalogo de comunidades"
            actions={[
              { label: "Volver", onClick: () => navigate("/pacientes"), variant: "neutra" },
            ]}
          />
          <ErrorState message={error.mensaje} onRetry={recargar} />
        </div>
      </ScreenContainer>
    );
  }

  const acciones = [{ label: "Volver", onClick: () => navigate("/pacientes"), variant: "neutra" }];
  if (permisos.puedeCrear) {
    acciones.push({ label: "Nueva comunidad", onClick: () => setModal({ comunidad: null }) });
  }

  return (
    <ScreenContainer>
      <div className="modulo-pacientes">
        <PageHeader
          title="Catalogo de comunidades"
          subtitle="Comunidades del catalogo territorial, con su ubicación en el mapa"
          actions={acciones}
        />

        <div className="pac-filtros">
          <FilterBar
            campos={FILTROS_COMUNIDADES}
            valores={filtros}
            onChange={setFiltro}
            catalogos={catalogos}
          />
        </div>

        <p className="pac-rotulo mb-2">{total === 1 ? "1 comunidad" : `${total} comunidades`}</p>

        <div className="ec-tabla">
          <DataList
            columnas={COLUMNAS_COMUNIDAD}
            datos={comunidades}
            cargando={cargando}
            catalogos={catalogos}
            onRowPress={permisos.puedeEditar ? (fila) => setModal({ comunidad: fila }) : undefined}
            vacio={
              hayFiltros ? (
                <EmptyState
                  message="Ninguna comunidad coincide con la busqueda."
                  actionLabel="Limpiar busqueda"
                  onAction={limpiarFiltros}
                />
              ) : (
                <EmptyState message="Todavia no hay comunidades en el catalogo." />
              )
            }
          />
        </div>

        {modal && (
          <ModalComunidad
            visible
            comunidad={modal.comunidad}
            onClose={() => setModal(null)}
            onGuardar={guardar}
            erroresForm={erroresForm}
          />
        )}
      </div>
    </ScreenContainer>
  );
}
