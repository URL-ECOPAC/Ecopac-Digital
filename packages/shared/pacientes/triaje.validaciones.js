import { CAMPOS_TRIAJE } from "./campos.js";
import { combinarErrores, esTextoVacio, validarConDescriptores } from "../validations/index.js";

const EDAD_CORTE_PEDIATRICO_ANIOS = 18;

const TRAMOS_DE_EDAD = Object.freeze({
  PEDIATRICO: "pediatrico",
  ADULTO: "adulto",
});

const UMBRALES_DE_ALARMA_PENDIENTES_DE_REVISION = Object.freeze({
  [TRAMOS_DE_EDAD.PEDIATRICO]: {
    presionSistolica: { min: 70, max: 140 },
    presionDiastolica: { min: 40, max: 90 },
    frecuenciaCardiaca: { min: 60, max: 160 },
    glucosa: { min: 60, max: 250 },
    temperatura: { min: 35.5, max: 39 },
  },
  [TRAMOS_DE_EDAD.ADULTO]: {
    presionSistolica: { min: 90, max: 180 },
    presionDiastolica: { min: 50, max: 120 },
    frecuenciaCardiaca: { min: 50, max: 120 },
    glucosa: { min: 70, max: 250 },
    temperatura: { min: 35, max: 38.5 },
  },
});

/**
 * Rangos fisiologicamente imposibles, leidos de CAMPOS_TRIAJE (criterio 1 y 5).
 *
 * No redeclara min/max: los toma del descriptor, que es el mismo que ya espeja los CHECK de la
 * 00013 (ver campos.js). Un campo ausente -opcional sin valor- no reporta nada: no hay rango que
 * violar sobre algo que no se envio. Un campo que ya fallo por obligatoriedad tampoco compite
 * aqui -- combinarErrores() se queda con el primer mensaje, y un valor vacio nunca llega a esta
 * funcion como "fuera de rango".
 *
 * La coherencia sistolica > diastolica (criterio 4) solo se evalua cuando las dos llegan juntas
 * en `valores`: en una correccion parcial que solo trae una, la otra ya esta en la fila y esta
 * funcion no la lee (no toca la base). La sigue protegiendo el CHECK de la 00013 en ese caso.
 *
 * @param {object} valores Valores indexados por el id de CAMPOS_TRIAJE.
 * @returns {Record<string, string>} Errores por campo. Vacio si todo esta dentro de rango.
 */
function erroresDeRangoTriaje(valores = {}) {
  const errores = {};

  for (const campo of CAMPOS_TRIAJE) {
    const valor = valores?.[campo.id];
    if (esTextoVacio(valor)) continue;

    const numero = Number(valor);
    const { min, max } = campo.validacion;
    if (Number.isNaN(numero) || numero < min || numero > max) {
      errores[campo.id] =
        `${campo.label} debe estar entre ${min} y ${max} ${campo.sufijo}. ` +
        "Es un valor fisiologicamente imposible: revisa si hay un error de digitacion.";
    }
  }

  const sistolica = valores?.presionSistolica;
  const diastolica = valores?.presionDiastolica;
  if (
    !esTextoVacio(sistolica) &&
    !esTextoVacio(diastolica) &&
    errores.presionDiastolica === undefined &&
    Number(sistolica) <= Number(diastolica)
  ) {
    errores.presionDiastolica = "La presion diastolica debe ser menor que la presion sistolica.";
  }

  return errores;
}

/**
 * Valida los signos vitales antes de mandarlos al servidor.
 *
 * Combina dos capas independientes con combinarErrores() (mismo patron que
 * pacientes/validaciones.js): la obligatoriedad de los tres signos que la tabla exige
 * (validarConDescriptores(), issue #117) y los rangos fisiologicamente imposibles
 * (erroresDeRangoTriaje(), issue #118). Gana el primer mensaje que reporte cada campo: si un
 * signo obligatorio vino vacio, ese error tapa cualquier otro sobre el mismo campo.
 *
 * Los signos parciales son un requisito de campo, no una concesion: en algunas comunidades no hay
 * glucometro ni bascula. `CAMPOS_TRIAJE` ya reparte que es obligatorio -- presion sistolica,
 * diastolica y frecuencia cardiaca -- y que es opcional -- glucosa, peso, talla y temperatura --,
 * y ese reparto es el mismo que impone la tabla triajes (00013) con sus NOT NULL.
 *
 * Esta capa es UX, no integridad: la anon key es publica, asi que cualquiera puede llamar a
 * Supabase directo saltandose esta validacion. Los valores imposibles siguen protegidos
 * unicamente por los CHECK de la 00013.
 *
 * @param {object} valores Valores indexados por el id de CAMPOS_TRIAJE.
 * @returns {Record<string, string>} Errores por campo. Vacio si todo esta bien.
 */
export function validarTriaje(valores) {
  return combinarErrores(
    validarConDescriptores(CAMPOS_TRIAJE, valores),
    erroresDeRangoTriaje(valores),
  );
}

/**
 * Valida una correccion parcial: solo los campos que vienen en el objeto.
 *
 * En un UPDATE, los signos obligatorios que no se estan cambiando ya estan en la fila y no
 * viajan. Aplicar validarTriaje() tal cual pediria una presion que nadie quiso tocar.
 *
 * Lo que si se conserva es la obligatoriedad de lo que SI viene: mandar `presionSistolica: ""`
 * es un intento de vaciar una columna NOT NULL, y eso se rechaza aqui en vez de dejar que la
 * base devuelva un 23502. Tambien se conserva el rango imposible (issue #118): corregir la
 * glucosa a un valor imposible se rechaza igual que en el registro inicial.
 *
 * @param {object} valores Solo los campos a cambiar, indexados por el id de CAMPOS_TRIAJE.
 * @returns {Record<string, string>} Errores por campo.
 */
export function validarCambioDeTriaje(valores = {}) {
  const enviados = CAMPOS_TRIAJE.filter((campo) =>
    Object.prototype.hasOwnProperty.call(valores, campo.id),
  );

  return combinarErrores(validarConDescriptores(enviados, valores), erroresDeRangoTriaje(valores));
}

/**
 * Los signos que la tabla admite vacios.
 *
 * Se deriva de CAMPOS_TRIAJE en vez de escribirse a mano: si alguien cambia la obligatoriedad de
 * un campo en el descriptor y aqui hubiera una lista suelta, las dos se separarian sin aviso.
 */
export const SIGNOS_OPCIONALES = Object.freeze(
  CAMPOS_TRIAJE.filter((campo) => !campo.validacion?.requerido).map((campo) => campo.id),
);

/**
 * Tramo de edad a efectos de alarma (criterio 3).
 *
 * `edad === null` (lo que devuelve calcularEdad() con una fecha de nacimiento invalida o futura)
 * cae al tramo adulto: es el tramo mas ancho, asi que un dato de edad corrupto no dispara
 * advertencias pediatricas de mas sobre lo que probablemente es un adulto. Es una caida
 * documentada para un caso de dato malo, no un valor por defecto silencioso -- ver la
 * distincion con "parametro no provisto" en el JSDoc de advertenciasDeTriaje().
 */
function elegirTramoDeEdad(edad) {
  if (edad === null) return TRAMOS_DE_EDAD.ADULTO;
  return edad.anios < EDAD_CORTE_PEDIATRICO_ANIOS
    ? TRAMOS_DE_EDAD.PEDIATRICO
    : TRAMOS_DE_EDAD.ADULTO;
}

/**
 * Advierte -sin bloquear- si un signo vital es alarmante pero fisiologicamente posible
 * (criterio 2), ajustado por edad (criterio 3).
 *
 * NINGUN api.js llama a esta funcion, a proposito: triaje.api.js no la conoce, asi que
 * registrarTriaje()/actualizarTriaje() nunca bloquean un guardado por una advertencia. Quien
 * escriba la pantalla de #136 tiene que llamarla APARTE de validarTriaje() -- tipicamente en
 * cada cambio del formulario, para mostrar la advertencia junto al campo antes de guardar --,
 * el mismo patron que jornadas/api.js deja publico en obtenerAsignacionesDelDia() para
 * "recalcular la advertencia sin guardar todavia".
 *
 * Un valor que ya es fisiologicamente imposible (fuera de min/max de CAMPOS_TRIAJE) no genera
 * ademas una advertencia para ese campo: gana el rechazo, que ya cubre erroresDeRangoTriaje().
 *
 * Los umbrales viven en UMBRALES_DE_ALARMA_PENDIENTES_DE_REVISION: una PROPUESTA sin firma
 * clinica todavia. Esta funcion es correcta en su mecanica aunque esos numeros cambien manana --
 * lo unico que hay que tocar despues de la revision medica es esa constante.
 *
 * Esta capa es UX, no integridad: no reemplaza los CHECK de la 00013, que son lo unico que
 * protege el dato si alguien llama a Supabase directo sin pasar por esta validacion.
 *
 * @param {object} valores Valores indexados por el id de CAMPOS_TRIAJE.
 * @param {{anios: number, meses: number, texto: string}|null} edad Resultado de calcularEdad()
 *   (formato/fechas.js) para el paciente de este triaje. Parametro OBLIGATORIO -- sin default --
 *   para que un caller que se olvido de calcularlo falle ruidosamente en vez de que esta funcion
 *   le aplique en silencio el tramo adulto a, por ejemplo, un lactante. Pasar explicitamente
 *   `null` (lo que calcularEdad() devuelve con una fecha de nacimiento invalida o futura) SI cae
 *   al tramo adulto: es el unico caso donde ese tramo por defecto es una decision documentada, no
 *   un olvido de quien llama.
 * @returns {Record<string, string>} Advertencias por campo. Vacio si nada es alarmante.
 */
export function advertenciasDeTriaje(valores, edad) {
  if (edad === undefined) {
    throw new Error(
      "advertenciasDeTriaje requiere el parametro 'edad' (el resultado de calcularEdad(), o " +
        "null si la fecha de nacimiento no es valida). Quien llama tiene que calcularla -- " +
        "esta funcion no va a buscarla por su cuenta.",
    );
  }

  const umbrales = UMBRALES_DE_ALARMA_PENDIENTES_DE_REVISION[elegirTramoDeEdad(edad)];
  const advertencias = {};

  for (const campo of CAMPOS_TRIAJE) {
    const valor = valores?.[campo.id];
    if (esTextoVacio(valor)) continue;

    const numero = Number(valor);
    const { min, max } = campo.validacion;
    if (Number.isNaN(numero) || numero < min || numero > max) continue;

    const umbral = umbrales[campo.id];
    if (!umbral) continue;

    if (numero < umbral.min || numero > umbral.max) {
      advertencias[campo.id] =
        `${campo.label} de ${numero} ${campo.sufijo} es un valor alarmante. Confirmalo antes de continuar.`;
    }
  }

  return advertencias;
}
