import { useState } from "react";
import { Form } from "react-bootstrap";

import { CAMPOS_EDICION_TURNO, TIPOS_DE_CAMPO, useEdicionTurno } from "@ecopac/shared";

import CampoDeFormulario from "../components/CampoDeFormulario";
import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import ModalConfirmarDesasignacion from "./ModalConfirmarDesasignacion";
import { Save, X } from "lucide-react";

// Modal de edicion de horario, responsabilidad y asistencia de una persona ya asignada a una
// jornada (issue #185, asistio agregado en la #756), abierto al clickear una fila de la pestaña
// Equipo de DetalleJornadaPage.jsx (issue #181). Mismo patron que ModalEdicionUsuario.jsx (#107):
// Modal generico + CampoDeFormulario (y un checkbox para asistio), con la accion
// destructiva (Desasignar) detras de un boton propio que abre un segundo modal, en vez de
// competir con el click de la fila que abre este.
//
// A diferencia de #107, no se puede reactivar despues: desasignar borra la fila
// (desasignarPersonal(), #174), no la desactiva. Por eso ModalConfirmarDesasignacion (#182, sin
// cambios) se reutiliza tal cual aca en vez de en la pagina: es la unica forma de quitar a
// alguien de la jornada, y ahora se llega a ella desde el modal de edicion, no desde la fila.
//
// Solo dibuja lo que useEdicionTurno() le entrega: la asignacion (alta), la busqueda y el rol en
// la jornada siguen siendo del modal de #182 (ModalAsignarPersonal.jsx), que esta pantalla no
// toca ni duplica.
export default function ModalEdicionTurno({
  jornadaId,
  fila,
  asignacionesDelDia,
  onClose,
  onGuardado,
  onDesasignado,
}) {
  const {
    valores,
    errores,
    error,
    enviando,
    setCampo,
    guardar,
    advertenciaChoque,
    advertenciaTraslape,
  } = useEdicionTurno({ jornadaId, fila, asignacionesDelDia });
  const [mostrarDesasignar, setMostrarDesasignar] = useState(false);

  const guardarCambios = async () => {
    const resultado = await guardar();
    if (resultado.ok) onGuardado?.(resultado.asignacion);
  };

  const nombre = fila?.perfil ?? "esta persona";

  return (
    <>
      <Modal visible={!mostrarDesasignar} onClose={onClose} title={`Editar turno de ${nombre}`}>
        {error && (
          <div className="alert alert-danger" role="alert">
            {error.mensaje}
          </div>
        )}

        {/* Las dos advertencias de horario conviven (issue #185): el choque de dia completo de
            #182 (sin comparar horas) y el traslape real de esta issue. alert-danger para el
            traslape porque es la señal mas fuerte -- ver ModalAsignarPersonal.jsx, mismo
            tratamiento. */}
        {advertenciaChoque && (
          <div className="alert alert-warning" role="alert">
            {advertenciaChoque}
          </div>
        )}
        {advertenciaTraslape && (
          <div className="alert alert-danger" role="alert">
            {advertenciaTraslape}
          </div>
        )}

        {CAMPOS_EDICION_TURNO.map((campo) => {
          if (campo.tipo === TIPOS_DE_CAMPO.BOOLEANO) {
            return (
              <Form.Check
                key={campo.id}
                type="checkbox"
                id={`edicion-turno-${campo.id}`}
                label={campo.label}
                className="mb-3"
                checked={Boolean(valores[campo.id])}
                onChange={(evento) => setCampo(campo.id, evento.target.checked)}
                disabled={enviando}
              />
            );
          }

          // Perfil y rol en la jornada salen de solo lectura: es el mismo juego de campos que la
          // asignacion (issue #840, B1).
          return (
            <CampoDeFormulario
              key={campo.id}
              campo={campo}
              valor={valores[campo.id]}
              onChange={(valor) => setCampo(campo.id, valor)}
              error={errores[campo.id]}
              disabled={enviando}
            />
          );
        })}

        <div className="d-flex justify-content-between align-items-center mt-3">
          <SecondaryButton
            title="Desasignar"
            onClick={() => setMostrarDesasignar(true)}
            disabled={enviando}
          />
          <div className="d-flex gap-2">
            <SecondaryButton
              title="Cancelar"
              onClick={onClose}
              disabled={enviando}
              icon={<X size={16} aria-hidden="true" />}
            />
            <PrimaryButton
              title="Guardar"
              onClick={guardarCambios}
              loading={enviando}
              icon={<Save size={16} aria-hidden="true" />}
            />
          </div>
        </div>
      </Modal>

      {mostrarDesasignar && (
        <ModalConfirmarDesasignacion
          visible
          jornadaId={jornadaId}
          persona={fila}
          onClose={() => setMostrarDesasignar(false)}
          onDesasignado={() => {
            setMostrarDesasignar(false);
            onDesasignado?.();
          }}
        />
      )}
    </>
  );
}
