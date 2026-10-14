// Umbrales de ALARMA de los signos vitales, con su fuente (issue #840, G2).
//
// Hay dos capas distintas sobre cada signo y no se pueden confundir:
//
//   1. Lo IMPOSIBLE: el rango de CAMPOS_TRIAJE (campos.js), que espeja los CHECK de la 00013. Un
//      valor fuera es un error de digitacion y se RECHAZA. No es clinica, es "nadie tiene una
//      sistolica de 900".
//   2. Lo ALARMANTE: este archivo. Un valor posible pero que merece que alguien lo confirme y lo
//      mire. Se AVISA y no bloquea: puede ser justamente el motivo de la consulta.
//
// Un valor solo cae en una de las dos. Antes del #840 los umbrales eran "una PROPUESTA sin firma
// clinica", en dos tramos fijos -pediatrico y adulto-, y la pantalla podia mostrar a la vez el
// aviso de alarma y el rechazo por imposible sobre el mismo campo.
//
// FUENTES
//
// [NEWS2]  Royal College of Physicians. National Early Warning Score (NEWS) 2: Standardising the
//          assessment of acute-illness severity in the NHS. Londres: RCP, 2017. Se usa como
//          alarma el puntaje individual >= 2 de cada parametro: frecuencia cardiaca <= 40 o >= 111,
//          sistolica <= 100 o >= 220, temperatura <= 35.0 o >= 39.1 (grados C).
// [AHA]    Whelton PK, et al. 2017 ACC/AHA Guideline for the Prevention, Detection, Evaluation,
//          and Management of High Blood Pressure in Adults. Hypertension. 2018;71:e13-e115. Crisis
//          hipertensiva: sistolica > 180 y/o diastolica > 120 mmHg.
// [ADA]    American Diabetes Association. Standards of Care in Diabetes-2024, seccion 6
//          (Glycemic Goals and Hypoglycemia). Hipoglucemia nivel 1: glucosa < 70 mg/dL.
// [PALS]   American Heart Association. Pediatric Advanced Life Support Provider Manual, 2020.
//          Frecuencia cardiaca normal despierto por edad, y sistolica minima (percentil 5):
//          < 60 en neonatos, < 70 en lactantes, < 70 + 2 x edad en anios de 1 a 10 anios,
//          < 90 despues de los 10.
// [AAP]    Flynn JT, et al. Clinical Practice Guideline for Screening and Management of High Blood
//          Pressure in Children and Adolescents. Pediatrics. 2017;140(3):e20171904. Hipertension
//          estadio 2 en adolescentes: >= 140/90 mmHg.
// [NICE]   National Institute for Health and Care Excellence. Fever in under 5s: assessment and
//          initial management (NG143), 2019. En menores de 3 meses, 38 grados C o mas es riesgo alto.
//
// LO QUE NO TIENE FUENTE FIRME, y se dice: el techo de glucosa (250 mg/dL) es un umbral
// pragmatico de atencion primaria para "hiperglucemia marcada que conviene revisar ya", no un
// criterio diagnostico; y el techo de presion pediatrica por debajo de los 13 anios usa el mismo
// 140/90 de [AAP] como piso conservador, porque la tabla real depende de la talla. Los dos quedan
// marcados como pendientes de revision clinica. Una revision medica solo tiene que tocar este
// archivo: la mecanica de avisosDeSignos() no depende de los numeros.

/** Rango en el que NO se avisa. Un valor < min o > max es alarmante. */
function rango(min, max) {
  return Object.freeze({ min, max });
}

/** Adultos (18 anios o mas), o edad desconocida. */
const ADULTO = Object.freeze({
  presionSistolica: rango(101, 180), // [NEWS2] <= 100; [AHA] > 180
  presionDiastolica: rango(0, 120), // [AHA] > 120. Sin piso: NEWS2 no puntua la diastolica
  frecuenciaCardiaca: rango(41, 110), // [NEWS2] <= 40 o >= 111
  temperatura: rango(35.1, 39.0), // [NEWS2] <= 35.0 o >= 39.1
  glucosa: rango(70, 250), // [ADA] < 70; techo pendiente de revision clinica
});

/**
 * Tramos pediatricos de [PALS], por edad en meses. `hastaMeses` es exclusivo: el primer tramo
 * cuyo limite supera la edad es el que aplica.
 */
const TRAMOS_PEDIATRICOS = Object.freeze([
  { id: "neonato", hastaMeses: 1, frecuencia: rango(100, 205), sistolicaMinima: 60 },
  { id: "lactante", hastaMeses: 12, frecuencia: rango(100, 180), sistolicaMinima: 70 },
  { id: "1 a 2 anios", hastaMeses: 36, frecuencia: rango(98, 140) },
  { id: "3 a 5 anios", hastaMeses: 72, frecuencia: rango(80, 120) },
  { id: "6 a 11 anios", hastaMeses: 144, frecuencia: rango(75, 118) },
  { id: "12 a 17 anios", hastaMeses: 216, frecuencia: rango(60, 100) },
]);

const MESES_DE_ADULTEZ = 216;

/**
 * Sistolica minima de [PALS] por edad: 70 + 2 x edad entre 1 y 10 anios, 90 despues.
 *
 * @param {number} meses
 * @param {number|undefined} minimaDelTramo La de neonato y lactante, que es fija.
 */
function sistolicaMinimaPediatrica(meses, minimaDelTramo) {
  if (minimaDelTramo !== undefined) return minimaDelTramo;
  const anios = Math.floor(meses / 12);
  return anios <= 10 ? 70 + 2 * anios : 90;
}

/**
 * Los umbrales de alarma para una edad.
 *
 * `edad` es lo que devuelve calcularEdad() (formato/fechas.js). `null` -fecha de nacimiento
 * invalida o futura- usa los de adulto: son los mas amplios, asi que un dato de edad malo no
 * dispara avisos pediatricos sobre lo que probablemente es un adulto.
 *
 * @param {{ anios: number, meses: number }|null} edad
 * @returns {Record<string, {min: number, max: number}>}
 */
export function umbralesDeAlarma(edad) {
  if (!edad) return ADULTO;

  const meses = edad.anios * 12 + (edad.meses ?? 0);
  if (meses >= MESES_DE_ADULTEZ) return ADULTO;

  const tramo = TRAMOS_PEDIATRICOS.find((uno) => meses < uno.hastaMeses);

  return Object.freeze({
    presionSistolica: rango(sistolicaMinimaPediatrica(meses, tramo.sistolicaMinima), 140), // [PALS], [AAP]
    presionDiastolica: rango(0, 90), // [AAP]
    frecuenciaCardiaca: tramo.frecuencia, // [PALS]
    // [NICE]: en menores de 3 meses, 38 o mas ya es alarma. Despues, 39 o mas. Hipotermia: < 35.
    temperatura: meses < 3 ? rango(35, 37.9) : rango(35, 38.9),
    glucosa: rango(70, 250), // [ADA]
  });
}
