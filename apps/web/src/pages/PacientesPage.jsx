import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  puedeFusionarPacientes,
  puedeRegistrarPaciente,
  puedeVerCatalogoComunidades,
  puedeVerCatalogoDiagnosticos,
  puedeVerCondiciones,
  usePacientesListado,
} from "@ecopac/shared";

import ErrorState from "../components/ErrorState";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalAltaPaciente from "./ModalAltaPaciente";
import "./pacientes.css";
import PanelPacientes from "./PanelPacientes";

// Pantalla principal del modulo de pacientes (issue #124). Solo presentacion: los datos, los
// filtros, la paginacion, el calculo de la edad y los catalogos salen de usePacientesListado(),
// en packages/shared/pacientes/. Aqui no se valida, no se formatea y no se decide ningun
// permiso, que es lo que fija el contrato de reutilizacion de la issue.
//
// Quien puede entrar lo decide el guard de rutas (#52) desde App.jsx.
//
// El panel de filtros sigue el wireframe de gestion de pacientes (Entregable Semana 6, p. 62):
// busqueda, Lugar, Genero y Rango de edad. La condicion cronica es un quinto filtro que el
// wireframe no dibuja pero que pide el criterio 3. Lo dibuja PanelPacientes, compartido con la
// ficha, para que elegir un paciente no haga desaparecer los filtros.
//
// Las dos cosas que la #124 dejo anotadas como pendientes ya existen: la cabecera ofrece
// registrar un paciente (#126, en un modal, sin ruta nueva) y cada fila navega a la ficha
// (#125, que si agrega su ruta en App.jsx).
//
// La version movil de esta misma pantalla es la #133 y consume el mismo hook con los mismos
// descriptores; lo unico que cambia es que DataList se dibuja como tarjetas.
export default function PacientesPage() {
  const navigate = useNavigate();
  const { rol } = useSesionCompartida();
  const [registrando, setRegistrando] = useState(false);
  const listado = usePacientesListado();

  const puedeRegistrar = puedeRegistrarPaciente(rol);

  const acciones = [];

  if (puedeVerCondiciones(rol)) {
    acciones.push({
      label: "Pacientes crónicos",
      onClick: () => navigate("/pacientes/cronicos"),
      variant: "secondary",
    });
  }

  if (puedeVerCatalogoDiagnosticos(rol)) {
    acciones.push({
      label: "Catalogo de diagnósticos",
      onClick: () => navigate("/pacientes/diagnosticos"),
      variant: "secondary",
    });
  }

  if (puedeVerCatalogoComunidades(rol)) {
    acciones.push({
      label: "Catalogo de comunidades",
      onClick: () => navigate("/pacientes/comunidades"),
      variant: "secondary",
    });
  }

  if (puedeFusionarPacientes(rol)) {
    acciones.push({
      label: "Posibles duplicados",
      onClick: () => navigate("/pacientes/duplicados"),
      variant: "secondary",
    });
  }

  if (puedeRegistrar) {
    acciones.push({ label: "Nuevo paciente", onClick: () => setRegistrando(true) });
  }

  if (listado.error) {
    return (
      <ScreenContainer>
        <div className="modulo-pacientes">
          <PageHeader title="Gestión de pacientes" accent="var(--accent-pacientes)" />
          <ErrorState message={listado.error.mensaje} onRetry={listado.recargar} />
        </div>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <div className="modulo-pacientes">
        <PageHeader
          title="Gestión de pacientes"
          subtitle="Expedientes clinicos electrónicos"
          accent="var(--accent-pacientes)"
          actions={acciones}
        />

        <PanelPacientes
          listado={listado}
          onSeleccionar={(fila) => navigate(`/pacientes/${fila.id}`)}
          onRegistrar={() => setRegistrando(true)}
          puedeRegistrar={puedeRegistrar}
        >
          <div className="ec-panel-vacio">
            <p className="mb-0">Selecciona un paciente de la lista para ver su ficha.</p>
          </div>
        </PanelPacientes>

        {registrando && (
          <ModalAltaPaciente
            rol={rol}
            onClose={() => setRegistrando(false)}
            onRegistrado={listado.recargar}
          />
        )}
      </div>
    </ScreenContainer>
  );
}
