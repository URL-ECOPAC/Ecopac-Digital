/**
 * Las series que dibuja la pestania de signos vitales.
 *
 * TIENE QUE CUBRIR LOS SIETE CAMPOS DE CAMPOS_TRIAJE. Declaraba tres -presion, glucosa y peso-,
 * asi que la frecuencia cardiaca, la talla y la temperatura se capturaban, se guardaban en
 * `triajes` (00013) y **no se veian en ninguna parte**: quien tomaba el triaje escribia siete
 * valores y la ficha le devolvia tres. El IMC se suma como una octava serie porque, aunque no
 * sea un campo del formulario, es una columna generada de la tabla y es el dato que de verdad se
 * sigue en el tiempo para un paciente cronico.
 *
 * `grupo` separa las series por lo que miden, para que la pestania no sea una lista corrida de
 * ocho tarjetas iguales: cardiovascular, metabolico y antropometrico.
 *
 * Los rangos normales de referencia son de adulto. Lo son tambien los de la version anterior; no
 * se ajustan por edad aqui a proposito, porque esa regla ya existe y vive en
 * triaje.validaciones.js (advertenciasDeTriaje, con su corte pediatrico). Aqui la banda verde es
 * orientacion visual, no un diagnostico.
 */
export const GRUPOS_DE_SIGNOS = Object.freeze([
  { id: "cardiovascular", label: "Cardiovascular" },
  { id: "metabolico", label: "Metabolico" },
  { id: "antropometrico", label: "Medidas corporales" },
]);

export const SERIES_DE_SIGNOS = Object.freeze([
  {
    id: "presion",
    grupo: "cardiovascular",
    label: "Presión arterial",
    sufijo: "mmHg",
    lineas: [
      { id: "presionSistolica", label: "Sistólica", normal: { min: 90, max: 120 } },
      { id: "presionDiastolica", label: "Diastólica", normal: { min: 60, max: 80 } },
    ],
  },
  {
    id: "frecuenciaCardiaca",
    grupo: "cardiovascular",
    label: "Frecuencia cardíaca",
    sufijo: "lpm",
    lineas: [{ id: "frecuenciaCardiaca", label: "Frecuencia", normal: { min: 60, max: 100 } }],
  },
  {
    id: "temperatura",
    grupo: "metabolico",
    label: "Temperatura",
    sufijo: "°C",
    lineas: [{ id: "temperatura", label: "Temperatura", normal: { min: 36.1, max: 37.2 } }],
  },
  {
    id: "glucosa",
    grupo: "metabolico",
    label: "Glucosa",
    sufijo: "mg/dL",
    lineas: [{ id: "glucosa", label: "Glucosa", normal: { min: 70, max: 100 } }],
  },
  {
    id: "peso",
    grupo: "antropometrico",
    label: "Peso",
    sufijo: "kg",
    // Sin banda normal: el peso "normal" depende de la talla, y eso es justamente lo que mide el
    // IMC de mas abajo.
    lineas: [{ id: "peso", label: "Peso", normal: null }],
  },
  {
    id: "talla",
    grupo: "antropometrico",
    label: "Talla",
    sufijo: "cm",
    lineas: [{ id: "talla", label: "Talla", normal: null }],
  },
  {
    id: "imc",
    grupo: "antropometrico",
    label: "Índice de masa corporal",
    sufijo: "",
    // La columna generada de la 00013: ROUND(peso / POWER(talla / 100.0, 2), 1). No se recalcula
    // aqui -es el valor que guardo la base- y por eso no esta en CAMPOS_TRIAJE.
    lineas: [{ id: "imc", label: "IMC", normal: { min: 18.5, max: 24.9 } }],
  },
]);

function fechaDeTriaje(triaje) {
  return triaje?.tomadoEn ?? triaje?.atencion?.jornada?.fecha ?? null;
}

function esNumero(valor) {
  return typeof valor === "number" && Number.isFinite(valor);
}

export function aSeriesDeSignos(triajes = []) {
  const ordenados = [...triajes].sort((uno, otro) => {
    const a = Date.parse(fechaDeTriaje(uno) ?? "");
    const b = Date.parse(fechaDeTriaje(otro) ?? "");
    if (Number.isNaN(a) && Number.isNaN(b)) return 0;
    if (Number.isNaN(a)) return 1;
    if (Number.isNaN(b)) return -1;
    return a - b;
  });

  return SERIES_DE_SIGNOS.map((serie) => {
    const lineas = serie.lineas.map((linea) => ({
      ...linea,
      puntos: ordenados
        .filter((triaje) => esNumero(triaje?.[linea.id]))
        .map((triaje) => ({
          fecha: fechaDeTriaje(triaje),
          jornada: triaje?.atencion?.jornada?.nombre ?? null,
          valor: triaje[linea.id],
        })),
    }));

    const valores = lineas.flatMap((linea) => linea.puntos.map((punto) => punto.valor));
    const limitesNormales = lineas.flatMap((linea) =>
      linea.normal ? [linea.normal.min, linea.normal.max] : [],
    );
    const paraEscala = [...valores, ...limitesNormales];

    return {
      ...serie,
      lineas,
      mediciones: Math.max(...lineas.map((linea) => linea.puntos.length), 0),
      min: paraEscala.length > 0 ? Math.min(...paraEscala) : null,
      max: paraEscala.length > 0 ? Math.max(...paraEscala) : null,
    };
  });
}

export function ultimaMedicion(serie) {
  const puntos = serie.lineas.flatMap((linea) =>
    linea.puntos.map((punto) => ({ ...punto, linea: linea.label })),
  );
  if (puntos.length === 0) return null;
  return puntos[puntos.length - 1];
}

export function estaFueraDeRango(valor, normal) {
  if (!normal || !esNumero(valor)) return false;
  return valor < normal.min || valor > normal.max;
}

export function hayAlgunaMedicion(series = []) {
  return series.some((serie) => serie.mediciones > 0);
}

/**
 * Las series agrupadas por lo que miden, listas para dibujar.
 *
 * Un grupo sin ninguna medicion no se devuelve: con ocho series, mostrar tres encabezados con
 * "sin mediciones" debajo no aporta nada. Que NO haya ninguna medicion en absoluto lo sigue
 * resolviendo hayAlgunaMedicion(), que es lo que decide el estado vacio de la pantalla.
 *
 * @param {object[]} series Lo que devuelve aSeriesDeSignos().
 * @returns {{ id: string, label: string, series: object[] }[]}
 */
export function agruparSeriesDeSignos(series = []) {
  return GRUPOS_DE_SIGNOS.map((grupo) => ({
    ...grupo,
    series: series.filter((serie) => serie.grupo === grupo.id && serie.mediciones > 0),
  })).filter((grupo) => grupo.series.length > 0);
}
