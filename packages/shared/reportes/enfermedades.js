// Transformaciones puras del reporte de enfermedades (issue #916).
//
// La base ya entrega los conteos agregados (fn_reporte_enfermedades). Aqui solo se les da la
// forma que pide cada vista -una fila por enfermedad, una columna por jornada, un punto por mes- y
// la serie de la grafica. Viven aparte del hook para probarlas sin montar React.
//
// Cada cifra viaja como numero, tambien las de 1 a 4 (issue #926): la tabla, el CSV y la grafica
// muestran el mismo valor que entrego la base.

import { MESES } from "../formato/fechas.js";

/** Cuantas enfermedades entran en una grafica de comparacion; la tabla las trae todas. */
export const MAXIMO_DE_ENFERMEDADES_EN_GRAFICA = 10;

/** Cuantas jornadas o comunidades caben en la grafica antes de volverse ilegible. */
export const MAXIMO_DE_GRUPOS_EN_GRAFICA = 6;

/** Mas de veinte anios de meses no es una evolucion, es un rango mal escrito. */
const MAXIMO_DE_MESES = 240;

const DESGLOSE = ["hombres", "mujeres", "menores", "adultos", "adultosMayores"];

/**
 * "2026-03" -> "mar 2026".
 *
 * @param {string} clave AAAA-MM
 * @returns {string}
 */
export function etiquetaDeMes(clave) {
  const [anio, mes] = String(clave ?? "").split("-");
  const indice = Number(mes) - 1;
  if (!anio || !(indice >= 0 && indice < 12)) return String(clave ?? "");
  return `${MESES[indice].slice(0, 3)} ${anio}`;
}

/**
 * El id de la enfermedad mas frecuente del recorte (puesto 1 que calcula la base), o null.
 *
 * @param {object[]} casos Filas de obtenerReporteEnfermedades().
 * @returns {string|null}
 */
export function diagnosticoMasFrecuente(casos = []) {
  let mejor = null;
  for (const caso of casos) {
    if (mejor === null || caso.orden < mejor.orden) mejor = caso;
  }
  return mejor?.diagnosticoId ?? null;
}

/**
 * Vista "mas frecuentes": una fila por enfermedad, en el orden de la base.
 *
 * @param {object[]} casos
 * @returns {object[]}
 */
export function filasDeRankingDeEnfermedades(casos = []) {
  return casos.map((caso) => ({
    id: caso.diagnosticoId,
    diagnostico: caso.diagnostico,
    codigo: caso.codigo ?? "",
    casos: caso.casos,
    ...Object.fromEntries(DESGLOSE.map((clave) => [clave, caso[clave]])),
  }));
}

/**
 * La grafica de la vista "mas frecuentes": las primeras enfermedades, una sola serie.
 *
 * @param {object[]} casos
 * @param {{ maximo?: number }} [opciones]
 * @returns {{ etiquetas: string[], series: Array<{ nombre: string, valores: number[] }> }}
 */
export function graficaDeRankingDeEnfermedades(
  casos = [],
  { maximo = MAXIMO_DE_ENFERMEDADES_EN_GRAFICA } = {},
) {
  const primeros = [...casos].sort((uno, otro) => uno.orden - otro.orden).slice(0, maximo);
  return {
    etiquetas: primeros.map((caso) => caso.diagnostico),
    series: [{ nombre: "Casos", valores: primeros.map((caso) => caso.casos) }],
  };
}

/**
 * Vistas "comparar jornadas" y "comparar comunidades": una fila por enfermedad y una columna por
 * grupo. Los grupos salen en el orden de la base (las jornadas por fecha, las comunidades por
 * nombre). Una enfermedad que no aparece en un grupo tiene 0 casos ahi, que es un cero real: la
 * base solo omite combinaciones sin ningun caso.
 *
 * La grafica lleva una serie por grupo y las enfermedades mas frecuentes del recorte en el eje.
 * Con mas de MAXIMO_DE_GRUPOS_EN_GRAFICA grupos solo dibuja los primeros y lo dice
 * (`gruposFueraDeGrafica`); la tabla los trae todos.
 *
 * @param {object[]} casos
 * @param {{ maximoDeEnfermedades?: number, maximoDeGrupos?: number }} [opciones]
 * @returns {{ grupos: Array<{ clave: string, id: string, nombre: string }>, filas: object[], grafica: { etiquetas: string[], series: Array<{ nombre: string, valores: number[] }> }, gruposFueraDeGrafica: number }}
 */
export function pivotearComparacionDeEnfermedades(
  casos = [],
  {
    maximoDeEnfermedades = MAXIMO_DE_ENFERMEDADES_EN_GRAFICA,
    maximoDeGrupos = MAXIMO_DE_GRUPOS_EN_GRAFICA,
  } = {},
) {
  const grupos = [];
  const enfermedades = new Map();
  const celdas = new Map();

  for (const caso of casos) {
    if (!grupos.some((grupo) => grupo.id === caso.grupoId)) {
      // La clave no es el uuid a secas: un id de columna que empieza con digito no es un
      // identificador valido para todos los consumidores de descriptores.
      grupos.push({ clave: `grupo_${grupos.length + 1}`, id: caso.grupoId, nombre: caso.grupo });
    }
    if (!enfermedades.has(caso.diagnosticoId)) {
      enfermedades.set(caso.diagnosticoId, {
        id: caso.diagnosticoId,
        diagnostico: caso.diagnostico,
        codigo: caso.codigo ?? "",
        orden: caso.orden,
      });
    }
    celdas.set(`${caso.grupoId}|${caso.diagnosticoId}`, caso.casos);
  }

  const enOrden = [...enfermedades.values()].sort((uno, otro) => uno.orden - otro.orden);
  const valorDe = (grupo, enfermedad) => {
    const llave = `${grupo.id}|${enfermedad.id}`;
    return celdas.has(llave) ? celdas.get(llave) : 0;
  };

  const filas = enOrden.map((enfermedad) => ({
    id: enfermedad.id,
    diagnostico: enfermedad.diagnostico,
    codigo: enfermedad.codigo,
    ...Object.fromEntries(grupos.map((grupo) => [grupo.clave, valorDe(grupo, enfermedad)])),
  }));

  const enGrafica = enOrden.slice(0, maximoDeEnfermedades);
  const gruposEnGrafica = grupos.slice(0, maximoDeGrupos);

  return {
    grupos,
    filas,
    grafica: {
      etiquetas: enGrafica.map((enfermedad) => enfermedad.diagnostico),
      series: gruposEnGrafica.map((grupo) => ({
        nombre: grupo.nombre,
        valores: enGrafica.map((enfermedad) => valorDe(grupo, enfermedad)),
      })),
    },
    gruposFueraDeGrafica: grupos.length - gruposEnGrafica.length,
  };
}

/** "2026-03-15" -> "2026-03". */
function claveDeMes(fecha) {
  return fecha ? String(fecha).slice(0, 7) : null;
}

/** Los meses de `desde` a `hasta`, ambos AAAA-MM, inclusive. */
function mesesEntre(desde, hasta) {
  const meses = [];
  let [anio, mes] = desde.split("-").map(Number);
  const [anioFin, mesFin] = hasta.split("-").map(Number);

  while (
    (anio < anioFin || (anio === anioFin && mes <= mesFin)) &&
    meses.length < MAXIMO_DE_MESES
  ) {
    meses.push(`${anio}-${String(mes).padStart(2, "0")}`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }
  return meses;
}

/**
 * Vista "evolucion": un punto por mes para una enfermedad, con los meses sin casos en cero para
 * que la linea no salte de un mes con datos al siguiente como si fueran contiguos.
 *
 * El rango es el del filtro de periodo si lo hay; si no, del primer al ultimo mes con casos de
 * esa enfermedad.
 *
 * @param {object[]} casos Filas agrupadas por mes (todas las enfermedades).
 * @param {string|null} diagnosticoId
 * @param {{ desde?: string|null, hasta?: string|null }} [rango] Fechas AAAA-MM-DD.
 * @returns {{ filas: object[], grafica: { etiquetas: string[], series: Array<{ nombre: string, valores: number[] }> } }}
 */
export function serieDeEvolucionDeEnfermedad(casos = [], diagnosticoId, { desde, hasta } = {}) {
  const vacia = { filas: [], grafica: { etiquetas: [], series: [] } };
  if (!diagnosticoId) return vacia;

  const deLaEnfermedad = casos.filter((caso) => caso.diagnosticoId === diagnosticoId);
  const porMes = new Map(deLaEnfermedad.map((caso) => [claveDeMes(caso.grupoFecha), caso]));
  const conDatos = [...porMes.keys()].filter(Boolean).sort();

  const inicio = claveDeMes(desde) ?? conDatos[0];
  const fin = claveDeMes(hasta) ?? conDatos[conDatos.length - 1];
  if (!inicio || !fin || inicio > fin) return vacia;

  const meses = mesesEntre(inicio, fin);
  const nombre = deLaEnfermedad[0]?.diagnostico ?? "Casos";

  const filas = meses.map((mes) => {
    const caso = porMes.get(mes);
    return {
      id: mes,
      periodo: etiquetaDeMes(mes),
      casos: caso ? caso.casos : 0,
      ...Object.fromEntries(DESGLOSE.map((clave) => [clave, caso ? caso[clave] : 0])),
    };
  });

  return {
    filas,
    grafica: {
      etiquetas: meses.map(etiquetaDeMes),
      series: [
        {
          nombre,
          valores: meses.map((mes) => {
            const caso = porMes.get(mes);
            return caso ? caso.casos : 0;
          }),
        },
      ],
    },
  };
}
