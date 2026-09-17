import { useState } from "react";
import { Plus, Save, X } from "lucide-react";

import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";
import Selector from "./Selector";
import TextField from "./TextField";

/**
 * Selector con la salida de crear la opcion que falta, sin salir del formulario.
 *
 * Es el patron que el alta de paciente estreno para las comunidades (issue #743) y que la #834
 * generaliza: el alta de jornada, las especialidades del colaborador y los catalogos clinicos
 * tenian el mismo problema -- la opcion que hace falta todavia no existe -- y la unica salida era
 * cerrar el formulario, irse a otra pantalla y volver a empezar.
 *
 * Espejo de apps/mobile/src/components/SelectorConAlta.js: mismas props salvo el nombre del
 * evento (`onSelect` en las dos, `onClick`/`onPress` en los botones, que quedan dentro).
 *
 * Solo dibuja. Quien lo monta le pasa `onCrear`, que es quien llama al servidor, recarga el
 * catalogo y deja la opcion nueva seleccionada; `puedeCrear` es la respuesta del modulo de
 * permisos, y quien decide de verdad es RLS.
 *
 * @param {object} props
 * @param {string} props.label Rotulo del selector.
 * @param {string} [props.etiquetaAlta] Rotulo del boton de crear ("Crear una comunidad").
 * @param {string} [props.labelNuevo] Rotulo del campo de texto del alta.
 * @param {boolean} [props.puedeCrear] Sin esto, el selector se dibuja solo.
 * @param {boolean} [props.habilitadoParaCrear] Precondicion propia del formulario (por ejemplo,
 *   haber elegido municipio antes de poder crear una comunidad).
 * @param {(nombre: string) => Promise<{ error?: {mensaje?: string}|null }>} props.onCrear
 */
export default function SelectorConAlta({
  label,
  value,
  options = [],
  onSelect,
  placeholder = "Seleccionar",
  error,
  disabled = false,
  puedeCrear = false,
  habilitadoParaCrear = true,
  etiquetaAlta = "Crear",
  labelNuevo = "Nombre",
  onCrear,
  erroresAlta = {},
  creando = false,
}) {
  const [creandoNueva, setCreandoNueva] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [errorNueva, setErrorNueva] = useState(null);

  const cerrarAlta = () => {
    setCreandoNueva(false);
    setNombreNuevo("");
    setErrorNueva(null);
  };

  const guardar = async () => {
    const resultado = await onCrear?.(nombreNuevo);
    setErrorNueva(resultado?.error?.mensaje ?? null);
    // El hook devuelve la entidad creada bajo su propio nombre (`comunidad`, `especialidad`...),
    // asi que el exito se lee por la ausencia de error y de errores de validacion, no por una
    // clave concreta: asi este componente sirve para cualquier catalogo.
    const hayErrores = Boolean(resultado?.error) || Object.keys(resultado?.errores ?? {}).length > 0;
    if (!hayErrores) cerrarAlta();
  };

  return (
    <div className="ec-form-subgrid ec-form-grid--ancho">
      <Selector
        label={label}
        value={value || null}
        options={options}
        onSelect={onSelect}
        placeholder={placeholder}
        error={error}
        disabled={disabled}
      />

      {puedeCrear && habilitadoParaCrear && !creandoNueva && (
        <div className="ec-form-subgrid-accion">
          <SecondaryButton
            title={etiquetaAlta}
            size="sm"
            icon={<Plus size={14} aria-hidden="true" />}
            onClick={() => setCreandoNueva(true)}
            disabled={disabled}
          />
        </div>
      )}

      {puedeCrear && creandoNueva && (
        <div className="ec-form-grid--ancho">
          <TextField
            label={labelNuevo}
            value={nombreNuevo}
            onChange={(evento) => setNombreNuevo(evento.target.value)}
            error={erroresAlta.nombre ?? errorNueva}
            disabled={creando}
          />
          <div className="ec-acciones">
            <PrimaryButton
              title="Guardar"
              size="sm"
              icon={<Save size={14} aria-hidden="true" />}
              onClick={guardar}
              loading={creando}
            />
            <SecondaryButton
              title="Cancelar"
              variant="neutra"
              size="sm"
              icon={<X size={14} aria-hidden="true" />}
              onClick={cerrarAlta}
              disabled={creando}
            />
          </div>
        </div>
      )}
    </div>
  );
}
