import { useCapturaClinica, useRegistroTriaje } from "@ecopac/shared";

import Modal from "../components/Modal";
import NumberField from "../components/NumberField";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import SelectorDeJornada from "./SelectorDeJornada";
import { Save, X } from "lucide-react";

// Toma de signos vitales desde la ficha del paciente, en web.
//
// Hasta aqui esto solo existia en movil (TriajeScreen.js). El hook, la validacion, los rangos
// que reproducen los CHECK de la tabla `triajes` (00013) y el calculo del IMC son EXACTAMENTE
// los mismos -useRegistroTriaje, CAMPOS_TRIAJE, advertenciasDeTriaje-: este archivo no valida,
// no calcula y no decide permisos, solo dibuja. Es lo que garantiza que un triaje tomado desde
// una laptop en la mesa de recepcion y uno tomado desde un telefono guarden lo mismo.
//
// La jornada no se hereda como en movil (alli se elige al entrar): la resuelve
// useCapturaClinica() y la dibuja SelectorDeJornada.

export default function ModalRegistroTriaje({ paciente, rol, perfilId, onClose, onGuardado }) {
  const captura = useCapturaClinica();

  const {
    campos,
    valores,
    errores,
    advertencias,
    error,
    enviando,
    guardado,
    imc,
    permitido,
    setCampo,
    guardar,
  } = useRegistroTriaje({
    pacienteId: paciente?.id,
    fechaNacimiento: paciente?.fechaNacimiento,
    jornadaId: captura.jornadaId,
    estadoDeJornada: captura.jornada?.estado,
    perfilId,
    rol,
  });

  const guardarTriaje = async () => {
    const resultado = await guardar();
    if (resultado.ok) {
      await onGuardado?.();
      onClose?.();
    }
  };

  return (
    <Modal visible onClose={onClose} title="Tomar signos vitales" size="lg">
      {!permitido && (
        <div className="alert alert-danger" role="alert">
          Tu rol no puede tomar el triaje de un paciente.
        </div>
      )}

      <SelectorDeJornada captura={captura} />

      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      {/* Las advertencias no bloquean: un valor fuera del rango habitual puede ser correcto y
        justamente el motivo por el que esa persona esta en la jornada. Lo que hacen es pedir que
        se confirme antes de guardar, que es el mismo criterio que aplica la pantalla movil. */}
      {advertencias.length > 0 && (
        <div className="alert alert-warning" role="status">
          <ul className="mb-0 ps-3">
            {advertencias.map((advertencia) => (
              <li key={advertencia}>{advertencia}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="ec-form-grid">
        {campos.map((campo) => (
          <NumberField
            key={campo.id}
            label={campo.label}
            suffix={campo.sufijo}
            min={campo.validacion?.min}
            max={campo.validacion?.max}
            step={campo.id === "temperatura" || campo.id === "peso" ? 0.1 : 1}
            value={valores[campo.id] === "" ? null : Number(valores[campo.id])}
            onChange={(valor) => setCampo(campo.id, valor === null ? "" : valor)}
            error={errores[campo.id]}
            disabled={enviando || !permitido}
          />
        ))}
      </div>

      {/* El IMC no es un campo: lo calcula la columna generada de la 00013 a partir de peso y
        talla, y aqui se adelanta con la misma formula para que quien captura lo vea antes de
        guardar. Por eso se muestra y no se edita. */}
      {imc !== null && (
        <p className="ec-rotulo mb-0">
          IMC calculado <span className="text-body">{imc}</span>
        </p>
      )}

      <div className="ec-acciones ec-acciones--fin mt-4">
        <SecondaryButton
          title="Cancelar"
          variant="neutra"
          onClick={onClose}
          disabled={enviando}
          icon={<X size={16} aria-hidden="true" />}
        />
        <PrimaryButton
          title="Guardar signos"
          onClick={guardarTriaje}
          loading={enviando}
          disabled={!permitido || !captura.jornadaId || Boolean(guardado)}
          icon={<Save size={16} aria-hidden="true" />}
        />
      </div>
    </Modal>
  );
}
