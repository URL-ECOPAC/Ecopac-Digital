// Fechas: interpretacion, formateo y calculos de calendario.
//
// Las tres operaciones que centraliza este archivo -formatear, calcular la edad y calcular
// los dias que faltan para un vencimiento- se repiten en pacientes, inventario y reportes, y
// tienen que dar el mismo resultado en web y en movil.
//
// Por eso el formateo NO usa Intl. En React Native el resultado de Intl.DateTimeFormat
// depende de los datos ICU del sistema operativo: el mismo `month: "short"` sale "ago",
// "ago." o "Aug" segun la version de Android, y en Hermes el soporte ni siquiera esta
// garantizado. Con una tabla propia el resultado es identico en las tres plataformas.
//
// LA REGLA IMPORTANTE. La base de datos tiene dos tipos de fecha y no se pueden tratar igual:
//
//   DATE         fecha_nacimiento, fecha_ingreso, fecha_inicio...   llega como "2026-08-18"
//   TIMESTAMPTZ  created_at, updated_at                            llega como "2026-08-18T02:30:00Z"
//
// `new Date("2026-08-18")` se interpreta como medianoche UTC, asi que en Guatemala (UTC-6)
// getDate() devuelve 17: la fecha de nacimiento se corre un dia y la edad sale mal el dia del
// cumpleanos. Una marca de tiempo completa, en cambio, SI debe convertirse a hora local.
//
//   Una cadena de solo fecha se lee tal cual, como dia de calendario.
//   Una marca de tiempo completa se convierte a la hora local del dispositivo.

/** Nombres de mes en espanol. Exportados para que nadie vuelva a escribir la lista. */
export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Dias de la semana en espanol, empezando en domingo como devuelve getDay(). */
export const DIAS_DE_LA_SEMANA = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];

/** Milisegundos que tiene un dia. Solo se usa sobre fechas ya normalizadas a UTC. */
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Cadena de solo fecha: exactamente AAAA-MM-DD, sin hora ni zona. */
const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

function conDosDigitos(numero) {
  return String(numero).padStart(2, "0");
}

/**
 * Convierte lo que llegue en un Date utilizable, o null si no es una fecha.
 *
 * Es el unico sitio del proyecto que interpreta cadenas de fecha, y donde vive la regla de la
 * cabecera. Una cadena AAAA-MM-DD se construye con el constructor de componentes locales, que
 * no aplica ninguna conversion de zona horaria; cualquier otra cosa se delega a Date, que si
 * la aplica.
 *
 * @param {Date|string|number|null|undefined} valor
 * @returns {Date|null}
 */
export function aFechaLocal(valor) {
  if (valor === null || valor === undefined || valor === "") return null;

  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }

  if (typeof valor === "string") {
    const partes = SOLO_FECHA.exec(valor.trim());
    if (partes) {
      const [, anio, mes, dia] = partes;
      // Componentes locales: el dia se conserva tal cual, sin desplazamiento por zona.
      const fecha = new Date(Number(anio), Number(mes) - 1, Number(dia));
      return Number.isNaN(fecha.getTime()) ? null : fecha;
    }
  }

  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Indica si el valor se puede interpretar como fecha. */
export function esFechaValida(valor) {
  return aFechaLocal(valor) !== null;
}

/**
 * Dia de calendario de una fecha, como milisegundos UTC de su medianoche.
 *
 * Se compara por dia y no por milisegundos reales para que un cambio de horario de verano -que
 * hace que un dia dure 23 o 25 horas- no produzca un desfase de un dia al restar.
 */
function aDiaDeCalendario(fecha) {
  return Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/**
 * Fecha corta, la de las tablas y los listados.
 *
 * @returns {string} `"18/08/2026"`, o cadena vacia si el valor no es una fecha.
 */
export function formatearFechaCorta(valor) {
  const fecha = aFechaLocal(valor);
  if (!fecha) return "";

  return `${conDosDigitos(fecha.getDate())}/${conDosDigitos(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;
}

/**
 * Fecha larga, la de encabezados y documentos imprimibles como la receta.
 *
 * @returns {string} `"18 de agosto de 2026"`, o cadena vacia.
 */
export function formatearFechaLarga(valor) {
  const fecha = aFechaLocal(valor);
  if (!fecha) return "";

  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

/**
 * Fecha con hora, para registros de auditoria y movimientos de inventario.
 *
 * @returns {string} `"18/08/2026 14:30"`, o cadena vacia.
 */
export function formatearFechaConHora(valor) {
  const fecha = aFechaLocal(valor);
  if (!fecha) return "";

  const hora = `${conDosDigitos(fecha.getHours())}:${conDosDigitos(fecha.getMinutes())}`;
  return `${formatearFechaCorta(fecha)} ${hora}`;
}

/**
 * Edad a partir de la fecha de nacimiento.
 *
 * Para menores de dos anios devuelve tambien los meses, porque asi se registra la edad de un
 * lactante en la ficha clinica: "5 meses" dice mucho mas que "0 anios".
 *
 * @param {Date|string} fechaNacimiento
 * @param {Date} [hoy] Entra por parametro para poder probarlo sin depender del reloj.
 * @returns {{ anios: number, meses: number, texto: string }|null} null si la fecha no sirve.
 */
export function calcularEdad(fechaNacimiento, hoy = new Date()) {
  const nacimiento = aFechaLocal(fechaNacimiento);
  const referencia = aFechaLocal(hoy);
  if (!nacimiento || !referencia) return null;

  // Una fecha de nacimiento futura no es una edad negativa: es un dato mal capturado.
  if (aDiaDeCalendario(nacimiento) > aDiaDeCalendario(referencia)) return null;

  let anios = referencia.getFullYear() - nacimiento.getFullYear();
  let meses = referencia.getMonth() - nacimiento.getMonth();

  // Todavia no llega el dia del mes: ese mes no se ha cumplido.
  if (referencia.getDate() < nacimiento.getDate()) meses -= 1;

  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }

  return { anios, meses, texto: textoDeEdad(anios, meses) };
}

/** Arma el texto de la edad, con meses solo cuando aportan (menores de dos anios). */
function textoDeEdad(anios, meses) {
  const enAnios = `${anios} ${anios === 1 ? "ano" : "anos"}`;
  const enMeses = `${meses} ${meses === 1 ? "mes" : "meses"}`;

  if (anios === 0) return enMeses;
  if (anios < 2) return meses === 0 ? enAnios : `${enAnios} ${enMeses}`;
  return enAnios;
}

/**
 * Dias que faltan para que venza un lote.
 *
 * Negativo cuando ya vencio, que es lo que permite ordenar por urgencia sin ramas: los mas
 * vencidos quedan primero. Cero significa que vence hoy.
 *
 * @param {Date|string} fechaVencimiento
 * @param {Date} [hoy]
 * @returns {number|null} null si la fecha no sirve.
 */
export function diasHastaVencimiento(fechaVencimiento, hoy = new Date()) {
  const vencimiento = aFechaLocal(fechaVencimiento);
  const referencia = aFechaLocal(hoy);
  if (!vencimiento || !referencia) return null;

  return Math.round((aDiaDeCalendario(vencimiento) - aDiaDeCalendario(referencia)) / MS_POR_DIA);
}
