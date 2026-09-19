import { CAMPOS_TRIAJE } from "./campos.js";
import { umbralesDeAlarma } from "./signos.referencias.js";
import { combinarErrores, esTextoVacio, validarConDescriptores } from "../validations/index.js";

/**
 * Nivel de un aviso sobre un signo. Un campo tiene a lo sumo UNO (issue #840, G2): o el valor es
 * imposible y se rechaza, o es alarmante y se avisa. Antes la pantalla podia mostrar las dos cosas
 * sobre el mismo campo -primero "valor alarmante", despues "tiene que ser mayor que 40"-, que es
 * contradictorio: un valor imposible no es alarmante, es un error de digitacion.
 */
export const NIVELES_DE_AVISO = Object.freeze({
  IMPOSIBLE: "imposible",
  ALARMA: "alarma",
});

/** Los ids de los signos, en el orden del formulario. */
const IDS_DE_SIGNOS = CAMPOS_TRIAJE.map((campo) => campo.id);

/**
 * Rango del IMC que admite la base (chk_triajes_imc_rango, 00133, issue #699).
 *
 * Los dos numeros son los de ese CHECK y tienen que seguir siendolo: esto es el espejo en el
 * cliente, no una segunda regla.
 */
const IMC_MINIMO = 5;
const IMC_MAXIMO = 200;

/**
 * El IMC tal como lo calcula la base.
 *
 * Espeja la columna generada de la 00013 -- ROUND(peso / POWER(talla / 100.0, 2), 1) -- y la talla
 * va en CENTIMETROS, que es de donde sale el error de captura mas comun: teclear 1.62 en vez de 162.
 *
 * Vive aqui desde la #699 porque la regla que acota el IMC necesita exactamente la misma formula, y
 * dos copias de una formula se separan. useConsulta() la usa para la previsualizacion.
 *
 * @returns {number|null} null si falta algun valor o no es un numero positivo.
 */
export function calcularImc(peso, talla) {
  const kilos = Number(peso);
  const centimetros = Number(talla);

  if (!Number.isFinite(kilos) || !Number.isFinite(centimetros)) return null;
  if (kilos <= 0 || centimetros <= 0) return null;

  const metros = centimetros / 100;
  return Math.round((kilos / (metros * metros)) * 10) / 10;
}

function mensajeDeImposible(campo) {
  const { min, max } = campo.validacion;
  return (
    `${campo.label} tiene que estar entre ${min} y ${max} ${campo.sufijo}: ` +
    "revisa si hay un error de digitacion."
  );
}

function fueraDeLoPosible(campo, valor) {
  const numero = Number(valor);
  const { min, max } = campo.validacion;
  return Number.isNaN(numero) || numero < min || numero > max;
}

/**
 * Rangos fisiologicamente imposibles, leidos de CAMPOS_TRIAJE (que espeja los CHECK de la 00013).
 * Un campo vacio no reporta nada: todos los signos son opcionales (00135).
 *
 * @param {object} valores
 * @returns {Record<string, string>}
 */
function erroresDeRangoTriaje(valores = {}) {
  const errores = {};

  for (const campo of CAMPOS_TRIAJE) {
    const valor = valores?.[campo.id];
    if (esTextoVacio(valor)) continue;
    if (fueraDeLoPosible(campo, valor)) errores[campo.id] = mensajeDeImposible(campo);
  }

  // Peso y talla por separado pueden ser los dos posibles y su combinacion no serlo: 70 kg con una
  // talla de 30 cm pasa los dos rangos de CAMPOS_TRIAJE y da un IMC de 777,8. Hasta la #699 eso lo
  // paraba la base con un `numeric field overflow` crudo; la 00133 agrega chk_triajes_imc_rango y
  // esto es su espejo, dicho sobre los dos campos que la persona puede corregir.
  //
  // Solo se evalua si los dos llegan juntos y ninguno fallo ya: en una correccion parcial que solo
  // trae uno, el otro esta en la fila y esta funcion no lee la base.
  const peso = valores?.peso;
  const talla = valores?.talla;
  if (
    !esTextoVacio(peso) &&
    !esTextoVacio(talla) &&
    errores.peso === undefined &&
    errores.talla === undefined
  ) {
    const imc = calcularImc(peso, talla);
    if (imc !== null && (imc < IMC_MINIMO || imc > IMC_MAXIMO)) {
      const mensaje =
        `Con ${peso} kg y ${talla} cm el indice de masa corporal sale ${imc}, que no es posible. ` +
        "Revisa el peso y la talla: la talla va en centimetros.";
      errores.peso = mensaje;
      errores.talla = mensaje;
    }
  }

  return errores;
}

/**
 * La presion va completa (chk_triajes_presion_completa, 00135) y la sistolica es mayor que la
 * diastolica (chk_triajes_presion_coherente, 00013). Solo se evalua cuando la presion viaja en
 * `valores`: en una correccion que no la toca, lo que ya esta en la fila lo sigue protegiendo el
 * CHECK.
 *
 * @param {object} valores
 * @returns {Record<string, string>}
 */
function erroresDePresion(valores = {}) {
  const tieneSistolica = !esTextoVacio(valores?.presionSistolica);
  const tieneDiastolica = !esTextoVacio(valores?.presionDiastolica);

  if (tieneSistolica && !tieneDiastolica) {
    return { presionDiastolica: "Falta la presion diastolica: la presion se anota completa." };
  }
  if (tieneDiastolica && !tieneSistolica) {
    return { presionSistolica: "Falta la presion sistolica: la presion se anota completa." };
  }
  if (
    tieneSistolica &&
    tieneDiastolica &&
    Number(valores.presionSistolica) <= Number(valores.presionDiastolica)
  ) {
    return { presionDiastolica: "La presion diastolica debe ser menor que la presion sistolica." };
  }
  return {};
}

/**
 * Si hay al menos un signo capturado. Un triaje sin ninguno no registra nada
 * (chk_triajes_al_menos_un_signo, 00135): no se crea.
 *
 * @param {object} valores
 * @returns {boolean}
 */
export function haySignosCapturados(valores = {}) {
  return IDS_DE_SIGNOS.some((id) => !esTextoVacio(valores?.[id]));
}

/**
 * Valida los signos vitales antes de registrarlos.
 *
 * Ninguno es obligatorio (00135, issue #840), pero un triaje tiene que registrar al menos uno, y
 * la presion va completa. Gana el primer mensaje por campo (combinarErrores): el rango imposible
 * antes que la coherencia de la presion.
 *
 * Esta capa es UX, no integridad: los CHECK de la 00013, la 00133 (IMC) y la 00135 son lo que protege el dato.
 *
 * @param {object} valores Valores indexados por el id de CAMPOS_TRIAJE.
 * @returns {Record<string, string>} Errores por campo. Vacio si todo esta bien.
 */
export function validarTriaje(valores) {
  if (!haySignosCapturados(valores)) {
    return { signos: "Registra al menos un signo vital." };
  }
  return combinarErrores(
    validarConDescriptores(CAMPOS_TRIAJE, valores),
    erroresDeRangoTriaje(valores),
    erroresDePresion(valores),
  );
}

/**
 * Valida una correccion parcial: solo los campos que vienen en el objeto.
 *
 * En un UPDATE, los signos que no se estan cambiando ya estan en la fila y no viajan. Se conserva
 * el rango imposible: corregir la glucosa a un valor imposible se rechaza igual que al registrar.
 *
 * @param {object} valores Solo los campos a cambiar, indexados por el id de CAMPOS_TRIAJE.
 * @returns {Record<string, string>} Errores por campo.
 */
export function validarCambioDeTriaje(valores = {}) {
  const enviados = CAMPOS_TRIAJE.filter((campo) =>
    Object.prototype.hasOwnProperty.call(valores, campo.id),
  );

  const presion =
    Object.prototype.hasOwnProperty.call(valores, "presionSistolica") &&
    Object.prototype.hasOwnProperty.call(valores, "presionDiastolica")
      ? erroresDePresion(valores)
      : {};

  return combinarErrores(
    validarConDescriptores(enviados, valores),
    erroresDeRangoTriaje(valores),
    presion,
  );
}

/**
 * Lo que la pantalla muestra debajo de cada signo MIENTRAS se escribe: un solo aviso por campo.
 *
 * - Fuera de lo posible (CAMPOS_TRIAJE): nivel "imposible", con el mismo texto que dara
 *   validarTriaje() al guardar. Se muestra desde que se escribe, no solo al guardar: asi no hay
 *   un "valor alarmante" primero y un rechazo despues.
 * - Posible pero fuera del rango de alarma para la edad (signos.referencias.js): nivel "alarma".
 *   No bloquea: puede ser justamente el motivo de la consulta.
 *
 * @param {object} valores Valores indexados por el id de CAMPOS_TRIAJE.
 * @param {{anios: number, meses: number}|null} edad Resultado de calcularEdad(). OBLIGATORIO:
 *   `undefined` revienta para que un caller que se olvido de calcularla no le aplique en silencio
 *   los umbrales de adulto a un lactante. `null` (fecha invalida) si usa los de adulto.
 * @returns {Record<string, {nivel: string, mensaje: string}>}
 */
export function avisosDeSignos(valores, edad) {
  if (edad === undefined) {
    throw new Error(
      "avisosDeSignos requiere el parametro 'edad' (el resultado de calcularEdad(), o null si " +
        "la fecha de nacimiento no es valida).",
    );
  }

  const umbrales = umbralesDeAlarma(edad);
  const avisos = {};

  for (const campo of CAMPOS_TRIAJE) {
    const valor = valores?.[campo.id];
    if (esTextoVacio(valor)) continue;

    if (fueraDeLoPosible(campo, valor)) {
      avisos[campo.id] = { nivel: NIVELES_DE_AVISO.IMPOSIBLE, mensaje: mensajeDeImposible(campo) };
      continue;
    }

    const umbral = umbrales[campo.id];
    const numero = Number(valor);
    if (umbral && (numero < umbral.min || numero > umbral.max)) {
      avisos[campo.id] = {
        nivel: NIVELES_DE_AVISO.ALARMA,
        mensaje: `${campo.label} de ${numero} ${campo.sufijo} es un valor de alarma para la edad. Confirmalo.`,
      };
    }
  }

  return avisos;
}
