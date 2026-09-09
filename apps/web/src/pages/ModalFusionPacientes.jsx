import { useEffect } from "react";

import {
  cabeceraDePaciente,
  CAMPOS_FICHA_PACIENTE,
  textoDeCampoDeFicha,
  useFusionPacientes,
  valoresDeFichaPaciente,
} from "@ecopac/shared";

import LoadingState from "../components/LoadingState";
import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import StatusChip from "../components/StatusChip";
import "./pacientes.css";

// Comparacion lado a lado + confirmacion de fusion (issue #637, criterios 1 y 3). Mismo patron de
// dialogo de confirmacion destructiva que ModalConfirmarDesactivacion.jsx: Modal + PrimaryButton +
// SecondaryButton, con un hook de packages/shared llevando el estado (useFusionPacientes).
//
// Las dos columnas recorren CAMPOS_FICHA_PACIENTE, el mismo descriptor que ya pinta la pestania
// "Datos generales" de FichaPacientePage.jsx: side by side y en el mismo orden, las diferencias
// entre los dos expedientes se ven directamente comparando ambas columnas, sin una regla de
// comparacion nueva.
export default function ModalFusionPacientes({ pacienteAId, pacienteBId, rol, onClose, onFusionado }) {
  const {
    pacienteA,
    pacienteB,
    sobrevivienteId,
    cargando,
    enviando,
    error,
    abrir,
    elegirSobreviviente,
    confirmar,
  } = useFusionPacientes({ rol });

  useEffect(() => {
    abrir(pacienteAId, pacienteBId);
    // Solo se evalua una vez, al abrir el dialogo con el par que llego por props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteAId, pacienteBId]);

  const confirmarAccion = async () => {
    const resultado = await confirmar();
    if (resultado.ok) await onFusionado?.(resultado.fusion);
  };

  const cabeceraA = cabeceraDePaciente(pacienteA);
  const cabeceraB = cabeceraDePaciente(pacienteB);
  const valoresA = valoresDeFichaPaciente(pacienteA);
  const valoresB = valoresDeFichaPaciente(pacienteB);
  const listoParaComparar = !cargando && pacienteA && pacienteB;

  return (
    <Modal visible onClose={onClose} title="Comparar y fusionar expedientes" size="xl">
      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      {cargando && <LoadingState />}

      {listoParaComparar && (
        <>
          <div className="alert alert-warning" role="alert">
            Fusionar es irreversible: el expediente que no elijas como sobreviviente quedara dado
            de baja y ya no se podra deshacer la fusion. Su historial clinico, triajes, consultas y
            recetas pasan al expediente sobreviviente.
          </div>

          <div className="row mb-3">
            <div className="col-4" />
            {[
              { cabecera: cabeceraA, paciente: pacienteA },
              { cabecera: cabeceraB, paciente: pacienteB },
            ].map(({ cabecera, paciente }) => (
              <div className="col-4 text-center" key={paciente.id}>
                <p className="pac-nombre mb-1">{cabecera.nombreCompleto ?? "Paciente sin nombre"}</p>
                {cabecera.condiciones.length > 0 && (
                  <div className="d-flex flex-wrap justify-content-center gap-1 mb-2">
                    {cabecera.condiciones.map((condicion) => (
                      <StatusChip
                        key={condicion.id}
                        status={condicion.estado}
                        label={condicion.nombre}
                      />
                    ))}
                  </div>
                )}
                <div className="form-check d-inline-flex align-items-center gap-2">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="sobreviviente"
                    id={`sobreviviente-${paciente.id}`}
                    checked={sobrevivienteId === paciente.id}
                    onChange={() => elegirSobreviviente(paciente.id)}
                    disabled={enviando}
                  />
                  <label className="form-check-label" htmlFor={`sobreviviente-${paciente.id}`}>
                    Sobreviviente
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="pac-datos">
            {CAMPOS_FICHA_PACIENTE.map((campo) => (
              <div className="row mb-2" key={campo.id}>
                <div className="col-4">
                  <dt className="pac-rotulo mb-0">{campo.label}</dt>
                </div>
                <div className="col-4">{textoDeCampoDeFicha(campo, valoresA)}</div>
                <div className="col-4">{textoDeCampoDeFicha(campo, valoresB)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="d-flex justify-content-end gap-2 mt-3">
        <SecondaryButton title="Cancelar" onClick={onClose} disabled={enviando} />
        {listoParaComparar && (
          <PrimaryButton
            title="Fusionar expedientes"
            onClick={confirmarAccion}
            loading={enviando}
            disabled={!sobrevivienteId}
          />
        )}
      </div>
    </Modal>
  );
}
