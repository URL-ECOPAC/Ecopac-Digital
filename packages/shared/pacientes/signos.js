export const SERIES_DE_SIGNOS = Object.freeze([
  {
    id: "presion",
    label: "Presion arterial",
    sufijo: "mmHg",
    lineas: [
      { id: "presionSistolica", label: "Sistolica", normal: { min: 90, max: 120 } },
      { id: "presionDiastolica", label: "Diastolica", normal: { min: 60, max: 80 } },
    ],
  },
  {
    id: "glucosa",
    label: "Glucosa",
    sufijo: "mg/dL",
    lineas: [{ id: "glucosa", label: "Glucosa", normal: { min: 70, max: 100 } }],
  },
  {
    id: "peso",
    label: "Peso",
    sufijo: "kg",
    lineas: [{ id: "peso", label: "Peso", normal: null }],
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
