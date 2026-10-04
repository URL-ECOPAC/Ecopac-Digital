import { useState } from "react";
import { Alert } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

import {
  COLUMNAS_CATALOGO_CLINICAS,
  FILTROS_CATALOGO_CLINICAS,
  useCatalogoClinicas,
} from "@ecopac/shared";

import DataList from "../components/DataList";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalClinica from "./ModalClinica";
import "./pacientes.css";

// Pantalla del catalogo de clinicas (issue #927, 00183). Mismo patron que CatalogoAreasPage.jsx.
//
// Todos la ven. Crean y editan la administradora y quien tiene jornadas.gestionar; retirar,
// reactivar y eliminar es de la administradora. Quien decide de verdad es RLS.
export default function CatalogoClinicasPage() {
  const navigate = useNavigate();
  const { rol } = useSesionCompartida();
  const [modal, setModal] = useState(null); // null | { clinica: object|null }

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
    aviso,
    recargar,
    permitido,
    puedeMantener,
    puedeRetirar,
    campos,
    crear,
    editar,
    alternarVigencia,
    eliminar,
    catalogos,
  } = useCatalogoClinicas({ rol });

  const volver = { label: "Volver", onClick: () => navigate("/pacientes"), variant: "neutra" };
  const titulo = "Clínicas";

  if (!permitido || error) {
    return (
      <ScreenContainer>
        <div className="modulo-pacientes">
          <PageHeader title={titulo} actions={[volver]} />
          <ErrorState
            message={error ? error.mensaje : "No tienes acceso al catálogo de clínicas."}
            onRetry={error ? recargar : undefined}
          />
        </div>
      </ScreenContainer>
    );
  }

  const acciones = [volver];
  if (puedeMantener) {
    acciones.push({ label: "Nueva clínica", onClick: () => setModal({ clinica: null }) });
  }

  return (
    <ScreenContainer>
      <div className="modulo-pacientes">
        <PageHeader
          title={titulo}
          subtitle="Dónde se atienden las citas y cuántas salas tiene cada una"
          actions={acciones}
        />

        {aviso && (
          <Alert variant="info" className="py-2 px-3 small">
            {aviso}
          </Alert>
        )}

        <div className="pac-filtros">
          <FilterBar
            campos={FILTROS_CATALOGO_CLINICAS}
            valores={filtros}
            onChange={setFiltro}
            catalogos={catalogos}
          />
        </div>

        <p className="pac-rotulo mb-2">{total === 1 ? "1 clínica" : `${total} clínicas`}</p>

        <div className="ec-tabla">
          <DataList
            columnas={COLUMNAS_CATALOGO_CLINICAS}
            datos={filas}
            cargando={cargando}
            catalogos={catalogos}
            onRowPress={
              puedeMantener || puedeRetirar ? (fila) => setModal({ clinica: fila }) : undefined
            }
            vacio={
              hayFiltros ? (
                <EmptyState
                  message="Ninguna clínica coincide con la búsqueda."
                  actionLabel="Limpiar búsqueda"
                  onAction={limpiarFiltros}
                />
              ) : (
                <EmptyState message="Todavía no hay clínicas. Crea la primera." />
              )
            }
          />
        </div>

        {modal && (
          <ModalClinica
            visible
            clinica={modal.clinica}
            campos={campos}
            enviando={enviando}
            errores={erroresForm}
            puedeMantener={puedeMantener}
            puedeRetirar={puedeRetirar}
            onClose={() => setModal(null)}
            onCrear={crear}
            onEditar={editar}
            onAlternarVigencia={alternarVigencia}
            onEliminar={eliminar}
          />
        )}
      </div>
    </ScreenContainer>
  );
}
