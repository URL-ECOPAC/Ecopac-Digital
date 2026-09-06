import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  COLUMNAS_CATALOGO_DIAGNOSTICOS,
  FILTROS_CATALOGO_DIAGNOSTICOS,
  useCatalogoDiagnosticos,
} from "@ecopac/shared";

import DataList from "../components/DataList";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilterBar from "../components/FilterBar";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalDiagnostico from "./ModalDiagnostico";
import "./pacientes.css";

// Pantalla del catalogo de diagnosticos (issue #639). Mismo patron que PacientesCronicosPage.jsx:
// PageHeader + FilterBar + DataList, sin maestro-detalle porque aqui no hay una ficha a la que
// navegar, solo un modal de alta/edicion.
//
// Quien puede entrar lo decide el guard de rutas (App.jsx) con los roles amplios de /pacientes;
// puedeVerCatalogoDiagnosticos(rol) (permisos.js) es la puerta real -- medico y administrador,
// espejo de la politica de SELECT de diagnosticos (00033) -- y puedeAdministrarDiagnosticos(rol)
// decide si se ofrece dar de alta, editar o retirar (00105: solo administrador).
export default function CatalogoDiagnosticosPage() {
  const navigate = useNavigate();
  const { rol } = useSesionCompartida();
  const [modal, setModal] = useState(null); // null | { diagnostico: object|null }

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
    permitido,
    puedeAdministrar,
    alternarActivo,
    catalogos,
  } = useCatalogoDiagnosticos({ rol });

  if (!permitido) {
    return (
      <ScreenContainer>
        <div className="modulo-pacientes">
          <PageHeader
            title="Catalogo de diagnosticos"
            actions={[
              { label: "Volver", onClick: () => navigate("/pacientes"), variant: "secondary" },
            ]}
          />
          <ErrorState message="No tienes acceso al catalogo de diagnosticos." />
        </div>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <div className="modulo-pacientes">
          <PageHeader
            title="Catalogo de diagnosticos"
            actions={[
              { label: "Volver", onClick: () => navigate("/pacientes"), variant: "secondary" },
            ]}
          />
          <ErrorState message={error.mensaje} onRetry={recargar} />
        </div>
      </ScreenContainer>
    );
  }

  const acciones = [
    { label: "Volver", onClick: () => navigate("/pacientes"), variant: "secondary" },
  ];
  if (puedeAdministrar) {
    acciones.push({ label: "Nuevo diagnostico", onClick: () => setModal({ diagnostico: null }) });
  }

  return (
    <ScreenContainer>
      <div className="modulo-pacientes">
        <PageHeader
          title="Catalogo de diagnosticos"
          subtitle="Diagnosticos disponibles para la consulta medica"
          actions={acciones}
        />

        <div className="pac-filtros">
          <FilterBar
            campos={FILTROS_CATALOGO_DIAGNOSTICOS}
            valores={filtros}
            onChange={setFiltro}
            catalogos={catalogos}
          />
        </div>

        <p className="pac-rotulo mb-2">{total === 1 ? "1 diagnostico" : `${total} diagnosticos`}</p>

        <div className="pac-tabla">
          <DataList
            columnas={COLUMNAS_CATALOGO_DIAGNOSTICOS}
            datos={filas}
            cargando={cargando}
            catalogos={catalogos}
            onRowPress={puedeAdministrar ? (fila) => setModal({ diagnostico: fila }) : undefined}
            vacio={
              hayFiltros ? (
                <EmptyState
                  message="Ningun diagnostico coincide con la busqueda."
                  actionLabel="Limpiar busqueda"
                  onAction={limpiarFiltros}
                />
              ) : (
                <EmptyState message="Todavia no hay diagnosticos en el catalogo." />
              )
            }
          />
        </div>

        {modal && (
          <ModalDiagnostico
            visible
            diagnostico={modal.diagnostico}
            onClose={() => setModal(null)}
            onGuardado={recargar}
            onAlternarActivo={alternarActivo}
          />
        )}
      </div>
    </ScreenContainer>
  );
}
