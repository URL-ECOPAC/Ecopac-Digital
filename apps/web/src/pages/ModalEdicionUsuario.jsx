import { useState } from "react";

import { CAMPOS_EDICION_USUARIO, TIPOS_DE_CAMPO, useEdicionUsuario } from "@ecopac/shared";

import DateField from "../components/DateField";
import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import Selector from "../components/Selector";
import SecondaryButton from "../components/SecondaryButton";
import TextField from "../components/TextField";
import ModalConfirmarDesactivacion from "./ModalConfirmarDesactivacion";

// Modal de edicion de usuario (issue #107), abierto al clickear una fila de
// ColaboradoresPage.jsx (issue #105): no tiene ruta propia, mismo patron que
// ModalAltaUsuario.jsx (#106) -Modal generico + Selector/TextField elegidos a mano por
// campo.tipo-. La Pregunta 1 del plan de #107 decidio abrir desde la fila del listado en vez
// de una ficha de #184, que todavia no existe.
//
// Solo dibuja lo que useEdicionUsuario() le entrega. Etiquetas, tipos y orden de los campos
// salen de CAMPOS_EDICION_USUARIO (el subconjunto de CAMPOS_USUARIO que declara ese hook), no
// de literales propios.
//
// El selector de especialidades del prototipo no esta aca: CAMPOS_EDICION_USUARIO no lo
// incluye, a proposito, mismo motivo que CAMPOS_ALTA_USUARIO en ModalAltaUsuario.jsx
// (perfil_especialidad es de solo lectura hasta el issue #405, y ademas
// TIPOS_DE_CAMPO.ETIQUETAS no tiene ningun componente del catalogo que lo dibuje editable).
//
// Desactivar/reactivar (criterio 2) se abre desde aca, con un boton propio que abre
// ModalConfirmarDesactivacion: DataList no tiene una accion por fila aparte de onRowPress, asi
// que no hay otro lugar del que "abrirse desde la fila" sin construir un componente nuevo de
// catalogo.
const TIPO_DE_INPUT = {
  [TIPOS_DE_CAMPO.TEXTO]: "text",
  [TIPOS_DE_CAMPO.TELEFONO]: "tel",
};

export default function ModalEdicionUsuario({ perfil, idSesionActual, onClose, onGuardado }) {
  const { valores, errores, error, enviando, setCampo, guardar } = useEdicionUsuario(perfil);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  const esUnoMismo = perfil?.id === idSesionActual;

  const guardarCambios = async () => {
    const resultado = await guardar();
    if (resultado.ok) onGuardado?.(resultado.perfil);
  };

  return (
    <>
      <Modal visible={!mostrarConfirmacion} onClose={onClose} title="Editar colaborador">
        {error && (
          <div className="alert alert-danger" role="alert">
            {error.mensaje}
          </div>
        )}

        {CAMPOS_EDICION_USUARIO.map((campo) => {
          if (campo.tipo === TIPOS_DE_CAMPO.SELECT) {
            return (
              <Selector
                key={campo.id}
                label={campo.label}
                value={valores[campo.id]}
                options={campo.opciones}
                onSelect={(valor) => setCampo(campo.id, valor)}
                error={errores[campo.id]}
                disabled={enviando}
              />
            );
          }

          if (campo.tipo === TIPOS_DE_CAMPO.FECHA) {
            return (
              <DateField
                key={campo.id}
                label={campo.label}
                value={valores[campo.id] || null}
                onChange={(valor) => setCampo(campo.id, valor)}
                error={errores[campo.id]}
                disabled={enviando}
              />
            );
          }

          return (
            <TextField
              key={campo.id}
              label={campo.label}
              as={campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO ? "textarea" : undefined}
              rows={campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO ? 3 : undefined}
              type={TIPO_DE_INPUT[campo.tipo] ?? "text"}
              maxLength={campo.validacion?.maxLongitud}
              value={valores[campo.id] ?? ""}
              onChange={(evento) => setCampo(campo.id, evento.target.value)}
              error={errores[campo.id]}
              disabled={enviando}
            />
          );
        })}

        <div className="d-flex justify-content-between align-items-center mt-3">
          <div>
            {esUnoMismo ? (
              <span className="text-muted small">No puedes desactivar tu propia cuenta.</span>
            ) : (
              <SecondaryButton
                title={perfil?.activo ? "Desactivar" : "Reactivar"}
                onClick={() => setMostrarConfirmacion(true)}
                disabled={enviando}
              />
            )}
          </div>
          <div className="d-flex gap-2">
            <SecondaryButton title="Cancelar" onClick={onClose} disabled={enviando} />
            <PrimaryButton title="Guardar" onClick={guardarCambios} loading={enviando} />
          </div>
        </div>
      </Modal>

      {mostrarConfirmacion && (
        <ModalConfirmarDesactivacion
          perfil={perfil}
          idSesionActual={idSesionActual}
          onClose={() => setMostrarConfirmacion(false)}
          onResuelto={(perfilActualizado) => {
            setMostrarConfirmacion(false);
            onGuardado?.(perfilActualizado);
          }}
        />
      )}
    </>
  );
}
