// Validaciones de credenciales y datos de perfil.
//
// Se aplican en el cliente antes de llamar al servidor, y web y movil las comparten para que
// digan exactamente lo mismo. Son validaciones de usabilidad: la politica real la sigue
// aplicando el servidor (Supabase Auth para las credenciales, los NOT NULL y el enum
// rol_usuario de la migracion 00002 para el perfil). Que esto pase no significa que el
// servidor vaya a aceptarlo.
//
// Las claves del objeto de errores son los ids de CAMPOS_USUARIO, para que un formulario
// pueda pintar cada mensaje debajo de su campo sin traducir nada.

import {
  combinarErrores,
  esTextoVacio,
  normalizarTexto,
  validarConDescriptores,
} from "../validations/index.js";
import { CAMPOS_USUARIO } from "./campos.js";
import { ETIQUETAS_ROL, TODOS_LOS_ROLES } from "./roles.js";

/**
 * Forma aceptable de un correo: algo, arroba, dominio con punto.
 *
 * No pretende implementar el RFC 5322, que acepta cosas que ningun proveedor real entrega.
 * El objetivo es cazar el error de dedo antes de gastar una llamada al servidor; la
 * comprobacion que cuenta es el correo de verificacion.
 */
const FORMA_DE_CORREO = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** Longitud minima de contrasena que exige el proyecto. */
export const LONGITUD_MINIMA_CONTRASENA = 8;

/**
 * Reglas de contrasena, con su texto.
 *
 * Se exportan para que la pantalla de registro pinte la lista de requisitos sin volver a
 * escribirla: si aqui se agrega una regla, la interfaz la muestra sola.
 */
export const REGLAS_DE_CONTRASENA = [
  {
    id: "longitud",
    texto: `Al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres`,
    cumple: (contrasena) => contrasena.length >= LONGITUD_MINIMA_CONTRASENA,
  },
  {
    id: "letras",
    texto: "Al menos una letra",
    cumple: (contrasena) => /[a-z]/i.test(contrasena),
  },
  {
    id: "numeros",
    texto: "Al menos un numero",
    cumple: (contrasena) => /\d/.test(contrasena),
  },
];

/** Cantidad de digitos de un telefono guatemalteco, sin el codigo de pais. */
const DIGITOS_TELEFONO_GUATEMALA = 8;

/** Codigo de pais de Guatemala, que el usuario puede escribir o no. */
const CODIGO_PAIS_GUATEMALA = "502";

/**
 * Valida un correo y lo deja normalizado.
 *
 * Se pasa a minusculas y se recortan espacios porque la columna email de la migracion 00002
 * es citext: el servidor ya no distingue mayusculas, y normalizar aqui evita que el mismo
 * correo aparezca escrito de dos formas distintas en la interfaz.
 *
 * @param {string} correo
 * @returns {{ valor: string, errores: Record<string, string> }}
 */
export function validarCorreo(correo) {
  const valor = normalizarTexto(correo).toLowerCase();

  if (valor === "") {
    return { valor, errores: { email: "Escribe tu correo electronico." } };
  }

  if (!FORMA_DE_CORREO.test(valor)) {
    return {
      valor,
      errores: {
        email: "El correo no tiene un formato valido. Revisa que incluya @ y el dominio.",
      },
    };
  }

  return { valor, errores: {} };
}

/**
 * Valida la fortaleza de una contrasena nueva.
 *
 * Devuelve TODAS las reglas incumplidas, no solo la primera: la pantalla de registro tiene
 * que poder mostrar la lista completa de requisitos y marcar cuales faltan, en vez de ir
 * revelandolos de uno en uno.
 *
 * Solo se usa al crear o cambiar la contrasena. Para iniciar sesion se usa
 * validarCredenciales(), que no exige fortaleza.
 *
 * @param {string} contrasena
 * @returns {{ errores: Record<string, string>, reglasIncumplidas: Array<object> }}
 */
export function validarContrasena(contrasena) {
  const valor = typeof contrasena === "string" ? contrasena : "";

  if (valor === "") {
    return {
      errores: { contrasena: "Escribe una contrasena." },
      reglasIncumplidas: REGLAS_DE_CONTRASENA,
    };
  }

  const reglasIncumplidas = REGLAS_DE_CONTRASENA.filter((regla) => !regla.cumple(valor));

  if (reglasIncumplidas.length === 0) {
    return { errores: {}, reglasIncumplidas: [] };
  }

  const faltantes = reglasIncumplidas.map((regla) => regla.texto.toLowerCase()).join(", ");

  return {
    errores: { contrasena: `A la contrasena le falta: ${faltantes}.` },
    reglasIncumplidas,
  };
}

/**
 * Valida un telefono de Guatemala y lo deja normalizado a ocho digitos.
 *
 * Admite separadores y el prefijo +502 porque la gente los escribe de las dos formas. Es
 * opcional: vacio no es error, porque la columna telefono de la migracion 00002 acepta NULL.
 *
 * @param {string} telefono
 * @returns {{ valor: string, errores: Record<string, string> }}
 */
export function validarTelefonoGuatemala(telefono) {
  if (esTextoVacio(telefono)) return { valor: "", errores: {} };

  const soloDigitos = normalizarTexto(telefono).replace(/[\s()+-]/g, "");
  const sinCodigoPais = soloDigitos.startsWith(CODIGO_PAIS_GUATEMALA)
    ? soloDigitos.slice(CODIGO_PAIS_GUATEMALA.length)
    : soloDigitos;

  const esValido =
    /^\d+$/.test(sinCodigoPais) && sinCodigoPais.length === DIGITOS_TELEFONO_GUATEMALA;

  if (!esValido) {
    return {
      valor: normalizarTexto(telefono),
      errores: {
        telefono:
          `El telefono debe tener ${DIGITOS_TELEFONO_GUATEMALA} digitos, ` +
          `como 5512-3456. Puedes anteponer +${CODIGO_PAIS_GUATEMALA}.`,
      },
    };
  }

  return { valor: sinCodigoPais, errores: {} };
}

/**
 * Valida los datos de perfil de un usuario.
 *
 * Lo que el descriptor puede expresar -obligatorio, longitud maxima- se aplica desde
 * CAMPOS_USUARIO, para no repetir aqui limites que ya estan escritos junto al formulario y
 * que coinciden con la migracion 00002. Encima se suman las reglas que un descriptor no
 * puede declarar: formato de correo, rol dentro del enum y telefono guatemalteco.
 *
 * @param {object} valores Valores indexados por el id de CAMPOS_USUARIO.
 * @returns {Record<string, string>} Errores por campo. Vacio si todo esta bien.
 */
export function validarPerfil(valores) {
  const porDescriptor = validarConDescriptores(CAMPOS_USUARIO, valores);
  const propias = {};

  // Solo se revisa el formato de lo que el usuario llego a escribir: si el campo esta vacio,
  // el descriptor ya dijo si era obligatorio y ese mensaje es el util.
  if (!esTextoVacio(valores?.email)) {
    Object.assign(propias, validarCorreo(valores.email).errores);
  }

  if (!esTextoVacio(valores?.telefono)) {
    Object.assign(propias, validarTelefonoGuatemala(valores.telefono).errores);
  }

  // El rol nunca se escribe como string suelto: tiene que ser uno del enum rol_usuario, o la
  // consulta falla en tiempo de ejecucion y ninguna politica RLS lo reconoce.
  if (!esTextoVacio(valores?.rol) && !TODOS_LOS_ROLES.includes(valores.rol)) {
    const validos = TODOS_LOS_ROLES.map((rol) => ETIQUETAS_ROL[rol]).join(", ");
    propias.rol = `Elige un rol de la lista: ${validos}.`;
  }

  return combinarErrores(porDescriptor, propias);
}

/**
 * Valida las credenciales de inicio de sesion.
 *
 * Es lo que consume la API de autenticacion. A proposito NO aplica las reglas de fortaleza:
 * una contrasena creada antes de que existiera la politica actual debe poder iniciar sesion.
 * Aqui solo se comprueba que el usuario escribio algo, para no gastar una llamada al
 * servidor con el formulario vacio.
 *
 * @param {{ correo: string, contrasena: string }} credenciales
 * @returns {{ correo: string, errores: Record<string, string> }}
 */
export function validarCredenciales({ correo, contrasena } = {}) {
  const { valor, errores: erroresDeCorreo } = validarCorreo(correo);
  const errores = { ...erroresDeCorreo };

  if (esTextoVacio(contrasena)) {
    errores.contrasena = "Escribe tu contrasena.";
  }

  return { correo: valor, errores };
}
