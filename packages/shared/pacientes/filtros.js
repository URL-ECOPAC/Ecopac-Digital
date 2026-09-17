// EJEMPLAR DE REFERENCIA de la arquitectura compartida (ver docs/ARQUITECTURA-FRONTEND.md).
//
// Este archivo existe para que el resto de modulos tenga un patron concreto que copiar.
// Los filtros se declaran una sola vez aqui; la web los dibuja con <Form.Select> y la app
// movil con <Selector>, sin que ninguna de las dos redefina la lista.
//
// Fuente: wireframe de gestion de pacientes (Entregable Semana 6, p. 62 web y p. 66 movil).

import { SUBTIPOS_DE_RANGO, TIPOS_DE_FILTRO } from "../descriptores.js";

/**
 * Grupos de edad del filtro de pacientes.
 *
 * POR QUE GRUPOS Y NO DOS CAJAS NUMERICAS. El filtro eran dos campos vacios, "desde" y "hasta",
 * que obligan a saber de antemano que numeros escribir. En jornada nadie busca "de 13 a 17": se
 * busca "adolescentes", y el corte entre un grupo y el siguiente es una decision clinica, no una
 * preferencia de quien filtra. Los cortes siguen los que el propio sistema ya usa: el de 5 anios
 * separa la primera infancia, y el de 12 es el mismo EDAD_CORTE_PEDIATRICO_ANIOS que
 * triaje.validaciones.js aplica para decidir que rangos de signos vitales son normales.
 *
 * "Personalizado" (value null) no es un grupo: es la salida para cuando de verdad hace falta un
 * rango exacto, y devuelve los dos campos numericos de siempre. Asi el caso comun es un solo
 * click y el caso raro sigue siendo posible.
 *
 * `max: null` significa "sin limite por arriba", que es como FilterBar y la API ya representan
 * un extremo abierto.
 */
export const GRUPOS_DE_EDAD = Object.freeze([
  { id: "primera-infancia", label: "Primera infancia (0 a 5)", min: 0, max: 5 },
  { id: "ninez", label: "Niñez (6 a 12)", min: 6, max: 12 },
  { id: "adolescencia", label: "Adolescencia (13 a 17)", min: 13, max: 17 },
  { id: "adultez", label: "Adultez (18 a 59)", min: 18, max: 59 },
  { id: "adulto-mayor", label: "Adulto mayor (60 o más)", min: 60, max: null },
]);

/**
 * El grupo que corresponde a un rango ya elegido, o null si no coincide con ninguno.
 *
 * Lo necesita FilterBar para saber si pintar el desplegable en un grupo o en "Personalizado"
 * cuando el rango llega desde fuera (por ejemplo al recargar con filtros puestos).
 */
export function grupoDeEdadDe(rango) {
  if (!rango) return null;
  const min = rango.min ?? null;
  const max = rango.max ?? null;
  return (
    GRUPOS_DE_EDAD.find((grupo) => grupo.min === min && (grupo.max ?? null) === max)?.id ?? null
  );
}

export const FILTROS_PACIENTE = [
  {
    id: "busqueda",
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: "Buscar paciente",
    placeholder: "Nombre, número de ficha o DPI",
  },
  {
    id: "comunidad",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Lugar",
    // Las opciones se cargan del catalogo de comunidades; el descriptor solo declara
    // de donde salen para que ambas apps las resuelvan igual.
    opcionesDesde: "comunidades",
  },
  {
    id: "sexo",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Sexo",
    opcionesDesde: "sexo",
  },
  {
    id: "rangoEdad",
    tipo: TIPOS_DE_FILTRO.RANGO,
    subtipo: SUBTIPOS_DE_RANGO.NUMERO,
    label: "Edad",
    min: 0,
    max: 120,
    // La unidad va pegada al control, no repetida en cada extremo. Es el mismo dato que
    // COLUMNAS_PACIENTE declara como `sufijo` en la columna de edad, y lo dibuja FilterBar;
    // ninguna app lo escribe.
    sufijo: "años",
    // Grupos de edad en vez de dos cajas numericas vacias (ver GRUPOS_DE_EDAD abajo).
    presets: GRUPOS_DE_EDAD,
  },
  {
    // El wireframe (p. 62) no lo dibuja, pero el criterio 3 de la #124 lo pide. Se agrega
    // como quinto filtro en vez de reemplazar a los del diseno, para no perder ninguno.
    id: "condicionCronica",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Condición crónica",
    opcionesDesde: "condicionesCronicas",
  },
];

/** Valor inicial de los filtros, para que ambas apps arranquen en el mismo estado. */
export const FILTROS_PACIENTE_VACIOS = {
  busqueda: "",
  comunidad: null,
  sexo: null,
  rangoEdad: null,
  condicionCronica: null,
};
