import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  COLUMNAS_CATALOGO_CONDICIONES,
  FILTROS_CATALOGO_CONDICIONES,
  useCatalogoCondiciones,
} from "@ecopac/shared";

import DataList from "../components/DataList";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalCondicionCronica from "./ModalCondicionCronica";
import "./pacientes.css";

// Pantalla del catalogo de condiciones cronicas (issue #850). Mismo patron que
// CatalogoDiagnosticosPage.jsx: PageHeader + FilterBar + DataList y un modal de alta/edicion, sin
// ruta propia para el modal.
//
// LOS DOS PERMISOS NO SON EL MISMO
//
// `puedeCrear` (administrador, medico y voluntario general) decide si se ofrece "Nueva condicion":
// una condicion que falta se descubre en jornada y quien la ve es quien atiende. `puedeMantener`
// (solo administrador) decide si una fila se puede abrir para renombrarla o retirarla, que es
// curaduria del catalogo. Son las dos politicas de la 00140, y quien decide de verdad es RLS.
//
// Quien puede entrar lo decide el guard de rutas (App.jsx) con los roles amplios de /pacientes;
// `permitido` (puedeVerCatalogoDeCondiciones) es la puerta de esta pantalla.
export default function CatalogoCondicionesPage() {
  const navigate = useNavigate();
  const { rol } = useSesionCompartida();
  const [modal, setModal] = useState(null); // null | { condicion: object|null }

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
    puedeCrear,
    puedeMantener,
    crear,
    editar,
    alternarVigencia,
    catalogos,
  } = useCatalogoCondiciones({ rol });

  const volver = { label: "Volver", onClick: () => navigate("/pacientes"), variant: "neutra" };

  if (!permitido) {
    return (
      <ScreenContainer>
        <div className="modulo-pacientes">
          <PageHeader title="Catalogo de condiciones crónicas" actions={[volver]} />
          <ErrorState message="No tienes acceso al catalogo de condiciones cronicas." />
        </div>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <div className="modulo-pacientes">
          <PageHeader title="Catalogo de condiciones crónicas" actions={[volver]} />
          <ErrorState message={error.mensaje} onRetry={recargar} />
        </div>
      </ScreenContainer>
    );
  }

  const acciones = [volver];
  if (puedeCrear) {
    acciones.push({ label: "Nueva condición", onClick: () => setModal({ condicion: null }) });
  }

  return (
    <ScreenContainer>
      <div className="modulo-pacientes">
        <PageHeader
          title="Catalogo de condiciones crónicas"
          subtitle="Condiciones que se pueden asignar en la ficha del paciente"
          actions={acciones}
        />

        <div className="pac-filtros">
          <FilterBar
            campos={FILTROS_CATALOGO_CONDICIONES}
            valores={filtros}
            onChange={setFiltro}
            catalogos={catalogos}
          />
        </div>

        <p className="pac-rotulo mb-2">{total === 1 ? "1 condición" : `${total} condiciones`}</p>

        <div className="ec-tabla">
          <DataList
            columnas={COLUMNAS_CATALOGO_CONDICIONES}
            datos={filas}
            cargando={cargando}
            catalogos={catalogos}
            onRowPress={puedeMantener ? (fila) => setModal({ condicion: fila }) : undefined}
            vacio={
              hayFiltros ? (
                <EmptyState
                  message="Ninguna condicion coincide con la busqueda."
                  actionLabel="Limpiar busqueda"
                  onAction={limpiarFiltros}
                />
              ) : (
                <EmptyState message="Todavia no hay condiciones en el catalogo." />
              )
            }
          />
        </div>

        {modal && (
          <ModalCondicionCronica
            visible
            condicion={modal.condicion}
            enviando={enviando}
            errores={erroresForm}
            puedeMantener={puedeMantener}
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
