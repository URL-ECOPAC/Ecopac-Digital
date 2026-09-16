import { TIPOS_DE_CAMPO } from "@ecopac/shared";

import DateField from "./DateField";
import MultiSelector from "./MultiSelector";
import NumberField from "./NumberField";
import Selector from "./Selector";
import TextField from "./TextField";

/**
 * Un campo de formulario dibujado a partir de su descriptor.
 *
 * POR QUE EXISTE
 *
 * El mismo `switch (campo.tipo)` estaba copiado en diez modales -alta y edicion de paciente,
 * alta y edicion de usuario, consulta, gasto, jornada, proyecto, hito, diagnostico-, y no eran
 * copias identicas: unos pasaban `maxLength` y otros no, unos sabian dibujar TEXTO_LARGO y otros
 * lo mandaban a un input de una linea, y ninguno sabia dibujar MULTI_SELECT. Un tipo de campo
 * nuevo obligaba a tocar los diez, y en la practica se tocaban dos.
 *
 * Aqui esta una sola vez. Un descriptor que declare un tipo que este componente no conoce cae a
 * un campo de texto en vez de desaparecer en silencio, que es lo que hacia FilterBar con los
 * filtros y costo caro: un campo invisible se parece demasiado a un campo que no existe.
 *
 * `ancho` sale del descriptor (`anchoCompleto: true`) o del tipo: un TEXTO_LARGO o una lista de
 * etiquetas ocupan la fila entera, todo lo demas ocupa una columna. Es lo que permite que
 * "Nombres" y "Apellidos" queden uno al lado del otro sin que la pantalla decida nada.
 */

/** Atributo `type` del input nativo. Es una preferencia de teclado, no una validacion. */
const TIPO_DE_INPUT = {
  [TIPOS_DE_CAMPO.TEXTO]: "text",
  [TIPOS_DE_CAMPO.EMAIL]: "email",
  [TIPOS_DE_CAMPO.TELEFONO]: "tel",
  [TIPOS_DE_CAMPO.HORA]: "time",
};

const TIPOS_DE_FILA_COMPLETA = new Set([
  TIPOS_DE_CAMPO.TEXTO_LARGO,
  TIPOS_DE_CAMPO.MULTI_SELECT,
  TIPOS_DE_CAMPO.ETIQUETAS,
  TIPOS_DE_CAMPO.LISTA_REPETIBLE,
]);

export function ocupaFilaCompleta(campo) {
  return campo?.anchoCompleto === true || TIPOS_DE_FILA_COMPLETA.has(campo?.tipo);
}

export default function CampoDeFormulario({
  campo,
  valor,
  onChange,
  error,
  catalogos = {},
  disabled = false,
}) {
  const estilo = ocupaFilaCompleta(campo) ? { gridColumn: "1 / -1" } : undefined;

  // Un descriptor trae sus opciones escritas (las de un enum cerrado) o dice de que catalogo
  // salen (las que vienen de la base). Mismo contrato que FilterBar.
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
        // Un catalogo que todavia no cargo deja el select vacio y deshabilitado, en vez de
        // ofrecer un desplegable que no hace nada.
        disabled={disabled || opciones.length === 0}
        style={estilo}
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
        // ETIQUETAS es texto libre por definicion (perfil_especialidad es un VARCHAR, no una FK
        // a un catalogo); MULTI_SELECT elige de una lista cerrada.
        permiteLibre={campo.tipo === TIPOS_DE_CAMPO.ETIQUETAS}
        error={error}
        disabled={disabled}
        style={estilo}
      />
    );
  }

  if (campo.tipo === TIPOS_DE_CAMPO.FECHA) {
    return (
      <DateField
        label={campo.label}
        value={valor || null}
        onChange={onChange}
        error={error}
        disabled={disabled}
        style={estilo}
      />
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
        disabled={disabled}
        style={estilo}
      />
    );
  }

  if (campo.tipo === TIPOS_DE_CAMPO.BOOLEANO) {
    return (
      <Selector
        label={campo.label}
        value={valor === true ? "si" : valor === false ? "no" : null}
        options={[
          { value: "si", label: "Si" },
          { value: "no", label: "No" },
        ]}
        onSelect={(elegido) => onChange(elegido === null ? null : elegido === "si")}
        error={error}
        disabled={disabled}
        style={estilo}
      />
    );
  }

  const esLargo = campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO;

  return (
    <TextField
      label={campo.label}
      as={esLargo ? "textarea" : undefined}
      rows={esLargo ? (campo.filas ?? 3) : undefined}
      type={esLargo ? undefined : (TIPO_DE_INPUT[campo.tipo] ?? "text")}
      placeholder={campo.placeholder}
      maxLength={campo.validacion?.maxLongitud}
      value={valor ?? ""}
      onChange={(evento) => onChange(evento.target.value)}
      error={error}
      disabled={disabled}
      style={estilo}
    />
  );
}
