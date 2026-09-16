import { describe, expect, it } from "vitest";

import { CAMPOS_TRIAJE } from "./campos.js";
import {
  agruparSeriesDeSignos,
  aSeriesDeSignos,
  estaFueraDeRango,
  hayAlgunaMedicion,
  SERIES_DE_SIGNOS,
  ultimaMedicion,
} from "./signos.js";

const TRIAJES = [
  {
    id: "t-2",
    tomadoEn: "2026-05-10T15:00:00Z",
    presionSistolica: 140,
    presionDiastolica: 90,
    glucosa: 130,
    peso: 62,
    atencion: { jornada: { nombre: "Mayo", fecha: "2026-05-10" } },
  },
  {
    id: "t-1",
    tomadoEn: "2026-03-01T15:00:00Z",
    presionSistolica: 118,
    presionDiastolica: 76,
    glucosa: 92,
    peso: 60,
    atencion: { jornada: { nombre: "Marzo", fecha: "2026-03-01" } },
  },
];

describe("aSeriesDeSignos", () => {
  // Las ocho series cubren los SIETE campos de CAMPOS_TRIAJE mas el IMC, que es la columna
  // generada de la 00013. Declaraba tres, asi que la frecuencia cardiaca, la talla y la
  // temperatura se capturaban, se guardaban y no se veian en ninguna pantalla.
  it("arma una serie por cada signo que se captura, mas el IMC", () => {
    expect(aSeriesDeSignos(TRIAJES).map((serie) => serie.id)).toEqual([
      "presion",
      "frecuenciaCardiaca",
      "temperatura",
      "glucosa",
      "peso",
      "talla",
      "imc",
    ]);
  });

  it("no deja fuera ningun campo de CAMPOS_TRIAJE", () => {
    const enSeries = new Set(
      aSeriesDeSignos().flatMap((serie) => serie.lineas.map((linea) => linea.id)),
    );

    for (const campo of CAMPOS_TRIAJE) {
      expect(enSeries, `"${campo.id}" se captura y no se grafica`).toContain(campo.id);
    }
  });

  it("ordena los puntos del mas viejo al mas nuevo aunque lleguen al reves", () => {
    const [presion] = aSeriesDeSignos(TRIAJES);
    const sistolica = presion.lineas.find((linea) => linea.id === "presionSistolica");

    expect(sistolica.puntos.map((punto) => punto.valor)).toEqual([118, 140]);
    expect(sistolica.puntos.map((punto) => punto.jornada)).toEqual(["Marzo", "Mayo"]);
  });

  it("deja fuera las mediciones ausentes sin romper la serie", () => {
    const series = aSeriesDeSignos([
      { id: "t-1", tomadoEn: "2026-01-01", peso: 55 },
      { id: "t-2", tomadoEn: "2026-02-01", peso: null, glucosa: 88 },
    ]);

    const peso = series.find((serie) => serie.id === "peso");
    const glucosa = series.find((serie) => serie.id === "glucosa");

    expect(peso.mediciones).toBe(1);
    expect(glucosa.mediciones).toBe(1);
  });

  it("la escala abarca los valores y tambien la banda normal", () => {
    const [presion] = aSeriesDeSignos(TRIAJES);

    expect(presion.min).toBeLessThanOrEqual(60);
    expect(presion.max).toBeGreaterThanOrEqual(140);
  });

  it("una serie sin datos escala solo por sus bandas normales", () => {
    const [presion] = aSeriesDeSignos([]);

    expect(presion.mediciones).toBe(0);
    expect(presion.min).toBe(60);
    expect(presion.max).toBe(120);
  });

  it("el peso sin datos no tiene escala, porque no declara banda normal", () => {
    const peso = aSeriesDeSignos([]).find((serie) => serie.id === "peso");

    expect(peso.mediciones).toBe(0);
    expect(peso.min).toBeNull();
    expect(peso.max).toBeNull();
  });

  it("no falla sin triajes", () => {
    expect(aSeriesDeSignos()).toHaveLength(7);
  });
});

describe("estaFueraDeRango", () => {
  it("marca por encima y por debajo", () => {
    const normal = { min: 90, max: 120 };
    expect(estaFueraDeRango(140, normal)).toBe(true);
    expect(estaFueraDeRango(80, normal)).toBe(true);
    expect(estaFueraDeRango(110, normal)).toBe(false);
  });

  it("los limites cuentan como dentro", () => {
    expect(estaFueraDeRango(90, { min: 90, max: 120 })).toBe(false);
    expect(estaFueraDeRango(120, { min: 90, max: 120 })).toBe(false);
  });

  it("sin rango de referencia nada esta fuera", () => {
    expect(estaFueraDeRango(300, null)).toBe(false);
  });
});

describe("ultimaMedicion", () => {
  it("devuelve el punto mas reciente", () => {
    const [presion] = aSeriesDeSignos(TRIAJES);
    expect(ultimaMedicion(presion).valor).toBe(90);
  });

  it("es null si la serie esta vacia", () => {
    expect(ultimaMedicion(aSeriesDeSignos([])[0])).toBeNull();
  });
});

describe("hayAlgunaMedicion", () => {
  it("distingue un paciente con datos de uno sin ninguno", () => {
    expect(hayAlgunaMedicion(aSeriesDeSignos(TRIAJES))).toBe(true);
    expect(hayAlgunaMedicion(aSeriesDeSignos([]))).toBe(false);
  });
});

describe("SERIES_DE_SIGNOS", () => {
  it("el peso no declara rango normal, porque no existe uno universal", () => {
    const peso = SERIES_DE_SIGNOS.find((serie) => serie.id === "peso");
    expect(peso.lineas[0].normal).toBeNull();
  });

  it("presion y glucosa si lo declaran", () => {
    for (const id of ["presion", "glucosa"]) {
      const serie = SERIES_DE_SIGNOS.find((uno) => uno.id === id);
      for (const linea of serie.lineas) {
        expect(linea.normal.min).toBeLessThan(linea.normal.max);
      }
    }
  });
});

describe("agruparSeriesDeSignos", () => {
  it("separa las series por lo que miden", () => {
    const grupos = agruparSeriesDeSignos(aSeriesDeSignos(TRIAJES));
    expect(grupos.map((grupo) => grupo.id)).toEqual([
      "cardiovascular",
      "metabolico",
      "antropometrico",
    ]);
  });

  it("omite un grupo sin ninguna medicion, en vez de dejar un encabezado vacio", () => {
    // Un triaje con solo peso: nada cardiovascular ni metabolico que mostrar.
    const soloPeso = [{ tomadoEn: "2026-03-01", peso: 70 }];
    const grupos = agruparSeriesDeSignos(aSeriesDeSignos(soloPeso));

    expect(grupos.map((grupo) => grupo.id)).toEqual(["antropometrico"]);
    expect(grupos[0].series.map((serie) => serie.id)).toEqual(["peso"]);
  });

  it("sin ninguna medicion no devuelve ningun grupo", () => {
    expect(agruparSeriesDeSignos(aSeriesDeSignos([]))).toEqual([]);
  });
});
