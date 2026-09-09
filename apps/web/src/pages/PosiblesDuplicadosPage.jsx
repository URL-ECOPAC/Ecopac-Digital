import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { COLUMNAS_DUPLICADOS_PACIENTE, useDuplicadosPacientes } from "@ecopac/shared";

import DataList from "../components/DataList";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalFusionPacientes from "./ModalFusionPacientes";
import "./pacientes.css";

// Pantalla de posibles duplicados (issue #637). Mismo patron que CatalogoDiagnosticosPage.jsx:
// PageHeader + DataList, gate de `permitido` adentro de la pagina (el guard de rutas de App.jsx
// usa los roles amplios de /pacientes).
//
// Se muestra solo a quien puede fusionar (administrador, puedeFusionarPacientes en permisos.js),
// no a medico en solo-lectura: una cola de candidatos sobre la que nadie mas puede actuar no
// tiene destino en esta pantalla (PLAN.md de #637, pregunta 4).
//
// LIMITACION CONOCIDA (a decidir en un issue aparte, no en #637): esta lista sale de
// listarPosiblesDuplicados() -> fn_detectar_pacientes_duplicados() (00101), que solo propone
// pares con la MISMA fecha de nacimiento y nombre similar. fusionarPacientes() en si acepta
// cualquier par de ids, pero hoy no hay ninguna pantalla que permita elegir un par arbitrario: un
// duplicado real cuya fecha de nacimiento se tecleo distinta en cada registro no va a aparecer
// aca, y hoy no habria forma de fusionarlo desde la interfaz.
export default function PosiblesDuplicadosPage() {
  const navigate = useNavigate();
  const { rol } = useSesionCompartida();
  const [parSeleccionado, setParSeleccionado] = useState(null);

  const { filas, total, cargando, error, recargar, permitido } = useDuplicadosPacientes({ rol });

  if (!permitido) {
    return (
      <ScreenContainer>
        <div className="modulo-pacientes">
          <PageHeader
            title="Posibles duplicados"
            actions={[
              { label: "Volver", onClick: () => navigate("/pacientes"), variant: "secondary" },
            ]}
          />
          <ErrorState message="No tienes acceso a la fusion de expedientes duplicados." />
        </div>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <div className="modulo-pacientes">
          <PageHeader
            title="Posibles duplicados"
            actions={[
              { label: "Volver", onClick: () => navigate("/pacientes"), variant: "secondary" },
            ]}
          />
          <ErrorState message={error.mensaje} onRetry={recargar} />
        </div>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <div className="modulo-pacientes">
        <PageHeader
          title="Posibles duplicados"
          subtitle={`${total} ${total === 1 ? "par sugerido" : "pares sugeridos"} por nombre similar y misma fecha de nacimiento`}
          actions={[
            { label: "Volver", onClick: () => navigate("/pacientes"), variant: "secondary" },
          ]}
        />

        <DataList
          columnas={COLUMNAS_DUPLICADOS_PACIENTE}
          datos={filas}
          cargando={cargando}
          onRowPress={(fila) => setParSeleccionado(fila)}
          vacio={
            <EmptyState message="No se encontraron posibles duplicados con los datos actuales." />
          }
        />

        {parSeleccionado && (
          <ModalFusionPacientes
            pacienteAId={parSeleccionado.pacienteAId}
            pacienteBId={parSeleccionado.pacienteBId}
            rol={rol}
            onClose={() => setParSeleccionado(null)}
            onFusionado={async () => {
              setParSeleccionado(null);
              await recargar();
            }}
          />
        )}
      </div>
    </ScreenContainer>
  );
}
