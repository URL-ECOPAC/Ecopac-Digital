import { CAMPOS_ALTA_USUARIO, useAltaUsuario } from "@ecopac/shared";

import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import Selector from "../components/Selector";
import SecondaryButton from "../components/SecondaryButton";
import TextField from "../components/TextField";

// Modal de alta de usuario (issue #106), montado desde VoluntariosPage.jsx con estado local: no
// tiene ruta propia. No va en components/: ese barril es el catalogo de #280, y este modal es
// especifico de esta pantalla, no una pieza reutilizable por otras.
//
// Solo dibuja lo que useAltaUsuario() le entrega. Etiquetas, tipos y orden de los campos salen
// de CAMPOS_ALTA_USUARIO (el subconjunto de CAMPOS_USUARIO que declara ese hook), no de
// literales propios.
//
// El selector de especialidades del prototipo no esta aca: CAMPOS_ALTA_USUARIO no lo incluye,
// a proposito (ver PLAN.md del issue #106, bloqueante c / issue #405).

// Atributo `type` del input nativo por tipo de descriptor. Es una preferencia de teclado en
// pantallas tactiles, no una validacion: la validacion real sigue siendo la de
// packages/shared/usuarios/validaciones.js.
const TIPO_DE_INPUT = {
  texto: "text",
  email: "email",
  telefono: "tel",
};

export default function ModalAltaUsuario({ visible, onClose, onUsuarioCreado }) {
  const { valores, errores, error, enviando, setCampo, enviar, cancelar } = useAltaUsuario();

  const cerrar = () => {
    cancelar();
    onClose?.();
  };

  const guardar = async () => {
    const resultado = await enviar();
    if (resultado.ok) {
      onUsuarioCreado?.(resultado.usuario);
      onClose?.();
    }
  };

  return (
    <Modal visible={visible} onClose={cerrar} title="Nuevo voluntario">
      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      {CAMPOS_ALTA_USUARIO.map((campo) =>
        campo.tipo === "select" ? (
          <Selector
            key={campo.id}
            label={campo.label}
            value={valores[campo.id]}
            options={campo.opciones}
            onSelect={(valor) => setCampo(campo.id, valor)}
            error={errores[campo.id]}
          />
        ) : (
          <TextField
            key={campo.id}
            label={campo.label}
            type={TIPO_DE_INPUT[campo.tipo] ?? "text"}
            placeholder={campo.placeholder}
            maxLength={campo.validacion?.maxLongitud}
            value={valores[campo.id] ?? ""}
            onChange={(evento) => setCampo(campo.id, evento.target.value)}
            error={errores[campo.id]}
          />
        ),
      )}

      <div className="d-flex justify-content-end gap-2 mt-3">
        <SecondaryButton title="Cancelar" onClick={cerrar} disabled={enviando} />
        <PrimaryButton title="Invitar" onClick={guardar} loading={enviando} />
      </div>
    </Modal>
  );
}
