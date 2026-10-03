import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { COLUMNAS_CATALOGO_AREAS, FILTROS_CATALOGO_AREAS, useCatalogoAreas } from "@ecopac/shared";

import DataList from "../components/DataList";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalAreaAtencion from "./ModalAreaAtencion";
import "./pacientes.css";

// Pantalla del catalogo de areas de atencion (issue #927, 00182). Mismo patron que
// CatalogoCondicionesPage.jsx: PageHeader + FilterBar + DataList y un modal de alta/edicion sin
// ruta propia.
//
// Todos la ven; solo la administradora crea, edita, retira y reactiva (`puedeGestionar`, espejo de
// las politicas de 00182: quien decide de verdad es RLS).
export default function CatalogoAreasPage() {
  const navigate = useNavigate();
  const { rol } = useSesionCompartida();
  const [modal, setModal] = useState(null); // null | { area: object|null }

  const {
    filas,
    total,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros,
    cargando,
    error,
    enviando,
    erroresForm,
    recargar,
    permitido,
    puedeGestionar,
    campos,
    crear,
    editar,
    alternarVigencia,
    catalogos,
  } = useCatalogoAreas({ rol });

  const volver = { label: "Volver", onClick: () => navigate("/pacientes"), variant: "neutra" };
  const titulo = "Áreas de atención";

  if (!permitido || error) {
    return (
      <ScreenContainer>
        <div className="modulo-pacientes">
          <PageHeader title={titulo} actions={[volver]} />
          <ErrorState
            message={error ? error.mensaje : "No tienes acceso al catalogo de areas."}
            onRetry={error ? recargar : undefined}
          />
        </div>
      </ScreenContainer>
    );
  }

  const acciones = [volver];
  if (puedeGestionar) {
    acciones.push({ label: "Nueva área", onClick: () => setModal({ area: null }) });
  }

  return (
    <ScreenContainer>
      <div className="modulo-pacientes">
        <PageHeader
          title={titulo}
          subtitle="Áreas en las que se atiende a los pacientes y se agendan las citas"
          actions={acciones}
        />

        <div className="pac-filtros">
          <FilterBar
            campos={FILTROS_CATALOGO_AREAS}
            valores={filtros}
            onChange={setFiltro}
            catalogos={catalogos}
          />
        </div>

        <p className="pac-rotulo mb-2">{total === 1 ? "1 área" : `${total} áreas`}</p>

        <div className="ec-tabla">
          <DataList
            columnas={COLUMNAS_CATALOGO_AREAS}
            datos={filas}
            cargando={cargando}
            catalogos={catalogos}
            onRowPress={puedeGestionar ? (fila) => setModal({ area: fila }) : undefined}
            vacio={
              hayFiltros ? (
                <EmptyState
                  message="Ningún área coincide con la búsqueda."
                  actionLabel="Limpiar búsqueda"
                  onAction={limpiarFiltros}
                />
              ) : (
                <EmptyState message="Todavía no hay áreas en el catálogo." />
              )
            }
          />
        </div>

        {modal && (
          <ModalAreaAtencion
            visible
            area={modal.area}
            campos={campos}
            enviando={enviando}
            errores={erroresForm}
            onClose={() => setModal(null)}
            onCrear={crear}
            onEditar={editar}
            onAlternarVigencia={alternarVigencia}
          />
        )}
      </div>
    </ScreenContainer>
  );
}
