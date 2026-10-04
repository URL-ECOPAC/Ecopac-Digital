import { useCambioEstadoCita, usePaciente } from "@ecopac/shared";

import LoadingState from "../components/LoadingState";
import Modal from "../components/Modal";
import ModalCita from "./ModalCita";
import ModalConsulta from "./ModalConsulta";
import ModalDetalleCita from "./ModalDetalleCita";

// Los modales de una cita, en un solo lugar para la agenda y la ficha del paciente (issue #927):
// detalle, alta o edicion, y la consulta que se abre con Atender.
//
// `abierto` lo maneja quien lo monta:
//   { tipo: "detalle", cita } | { tipo: "nueva", inicial } | { tipo: "editar", cita }
//   | { tipo: "consulta", cita, paraConsulta } | null

/** La consulta de una cita necesita al paciente completo: se carga aqui. */
function ConsultaDeCita({ pacienteId, cita, rol, perfilId, onClose, onGuardada }) {
  const { paciente, cargando, error } = usePaciente(pacienteId, { rol });

  if (!paciente) {
    return (
      <Modal visible onClose={onClose} title="Consulta agendada">
        {cargando ? (
          <LoadingState message="Cargando al paciente..." />
        ) : (
          <div className="alert alert-danger" role="alert">
            {error?.mensaje ?? "No se pudo cargar al paciente."}
          </div>
        )}
      </Modal>
    );
  }

  return (
    <ModalConsulta
      paciente={paciente}
      cita={cita}
      rol={rol}
      perfilId={perfilId}
      onClose={onClose}
      onGuardada={onGuardada}
    />
  );
}

export default function FlujoDeCita({
  abierto,
  setAbierto,
  rol,
  perfilId,
  onCambio,
  onVerPaciente,
}) {
  const estado = useCambioEstadoCita({ rol, perfilId });

  if (!abierto) return null;

  const cerrar = () => {
    estado.limpiarError();
    setAbierto(null);
  };

  const trasCambio = async (cita) => {
    await onCambio?.();
    setAbierto(cita ? { tipo: "detalle", cita } : null);
  };

  if (abierto.tipo === "nueva" || abierto.tipo === "editar") {
    return (
      <ModalCita
        rol={rol}
        cita={abierto.tipo === "editar" ? abierto.cita : null}
        inicial={abierto.inicial}
        onClose={() =>
          abierto.cita ? setAbierto({ tipo: "detalle", cita: abierto.cita }) : cerrar()
        }
        onGuardada={trasCambio}
      />
    );
  }

  if (abierto.tipo === "consulta") {
    return (
      <ConsultaDeCita
        pacienteId={abierto.cita.pacienteId}
        cita={abierto.paraConsulta}
        rol={rol}
        perfilId={perfilId}
        // Cerrar sin guardar deja la cita en atencion; se puede volver a abrir o regresar.
        onClose={async () => {
          await onCambio?.();
          cerrar();
        }}
        onGuardada={onCambio}
      />
    );
  }

  const { cita } = abierto;
  return (
    <ModalDetalleCita
      // Otra cita u otro estado: el detalle empieza de nuevo (sin el formulario de cancelar abierto).
      key={`${cita.id}-${cita.estado}`}
      cita={cita}
      acciones={estado.acciones(cita)}
      enviando={estado.enviando}
      error={estado.error}
      errores={estado.errores}
      onClose={cerrar}
      onVerPaciente={onVerPaciente ? () => onVerPaciente(cita) : undefined}
      onEditar={() => setAbierto({ tipo: "editar", cita })}
      onAtender={async () => {
        const resultado = await estado.atender(cita);
        if (resultado.ok) {
          setAbierto({
            tipo: "consulta",
            cita: resultado.cita,
            paraConsulta: resultado.paraConsulta,
          });
        }
      }}
      onRegresar={async () => {
        const resultado = await estado.regresar(cita);
        if (resultado.ok) await trasCambio(resultado.cita);
      }}
      onCancelar={async (motivo) => {
        const resultado = await estado.cancelar(cita, motivo);
        if (resultado.ok) await trasCambio(resultado.cita);
      }}
    />
  );
}
