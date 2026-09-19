import { TIPOS_DE_CAMPO, textoDeCampoSoloLectura } from "@ecopac/shared";

import DateField from "./DateField";
import MultiSelector from "./MultiSelector";
import NumberField from "./NumberField";
import Selector from "./Selector";
import TextField from "./TextField";

/**
 * Un campo de formulario dibujado a partir de su descriptor. Espejo de
 * apps/web/src/components/CampoDeFormulario.jsx, con las mismas props.
 *
 * Faltaba en movil (issue #840, B1): cada pantalla repetia su propio `switch (campo.tipo)`, y un
 * campo de solo lectura -lo que la edicion muestra pero no deja cambiar- no tenia donde
 * dibujarse. Un descriptor con `soloLectura: true` se pinta como texto no editable, con el valor
 * legible que da textoDeCampoSoloLectura(): un selector deshabilitado sin su catalogo cargado
 * saldria vacio.
 */

const TECLADO_DE_CAMPO = {
  [TIPOS_DE_CAMPO.TELEFONO]: "phone-pad",
  [TIPOS_DE_CAMPO.EMAIL]: "email-address",
};

export default function CampoDeFormulario({
  campo,
  valor,
  onChange,
  error,
  catalogos = {},
  disabled = false,
}) {
  if (campo.soloLectura) {
    return (
      <TextField
        label={campo.label}
        value={textoDeCampoSoloLectura(campo, valor, catalogos)}
        editable={false}
        accessibilityHint="Este dato no se puede cambiar"
        multiline={campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO}
      />
    );
  }

  const opciones =
    campo.opciones ?? (campo.opcionesDesde ? (catalogos[campo.opcionesDesde] ?? []) : []);

  if (campo.tipo === TIPOS_DE_CAMPO.SELECT) {
    return (
      <Selector
        label={campo.label}
        value={valor ?? null}
        options={opciones}
        onSelect={onChange}
        error={error}
        disabled={disabled || opciones.length === 0}
      />
    );
  }

  if (campo.tipo === TIPOS_DE_CAMPO.MULTI_SELECT || campo.tipo === TIPOS_DE_CAMPO.ETIQUETAS) {
    return (
      <MultiSelector
        label={campo.label}
        value={Array.isArray(valor) ? valor : []}
        options={opciones}
        onChange={onChange}
        permiteLibre={campo.tipo === TIPOS_DE_CAMPO.ETIQUETAS}
        error={error}
        disabled={disabled}
      />
    );
  }

  if (campo.tipo === TIPOS_DE_CAMPO.FECHA) {
    return (
      <DateField label={campo.label} value={valor || null} onChange={onChange} error={error} />
    );
  }

  if (campo.tipo === TIPOS_DE_CAMPO.NUMERO) {
    return (
      <NumberField
        label={campo.label}
        value={valor === "" || valor === undefined ? null : Number(valor)}
        suffix={campo.sufijo}
        min={campo.validacion?.min}
        max={campo.validacion?.max}
        step={campo.paso ?? 1}
        onChange={(nuevo) => onChange(nuevo === null ? "" : nuevo)}
        error={error}
        editable={!disabled}
      />
    );
  }

  if (campo.tipo === TIPOS_DE_CAMPO.BOOLEANO) {
    return (
      <Selector
        label={campo.label}
        value={valor === true ? "si" : valor === false ? "no" : null}
        options={[
          { value: "si", label: "Sí" },
          { value: "no", label: "No" },
        ]}
        onSelect={(elegido) => onChange(elegido === null ? null : elegido === "si")}
        error={error}
        disabled={disabled}
      />
    );
  }

  const esLargo = campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO;

  return (
    <TextField
      label={campo.label}
      value={valor ?? ""}
      onChangeText={onChange}
      placeholder={campo.placeholder}
      maxLength={campo.validacion?.maxLongitud}
      keyboardType={TECLADO_DE_CAMPO[campo.tipo] ?? "default"}
      multiline={esLargo}
      numberOfLines={esLargo ? (campo.filas ?? 3) : undefined}
      error={error}
      editable={!disabled}
    />
  );
}
