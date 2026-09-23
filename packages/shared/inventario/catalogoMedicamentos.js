// Catalogo de medicamentos: filtros y resumen por medicamento, para la pestana del inventario.
//
// POR QUE EXISTE. La pestana filtraba por "categoria" -Medicamentos, Biologicos, Insumos,
// Dispositivos, Diagnostico, EPP- y mostraba codigo, lote, bodega, caducidad, stock y precio.
// Ninguna de esas columnas existe en `medicamentos` (00016, 00050): la categoria se comparaba
// contra `undefined`, asi que elegir "Medicamentos" vaciaba la tabla aunque el catalogo tuviera
// filas, y el resto se rellenaba con valores escritos a mano ("FAR-0041", "Q 143", "CENTRAL",
// "DISPONIBLE") iguales para todos los medicamentos.
//
// Aqui se filtra por lo que el modelo SI tiene (nombre, marca, concentracion, presentacion, uso
// pediatrico y si esta activo) y lo que depende de los lotes -cuantos hay y cuando vence el
// proximo- se calcula de verdad a partir de listarLotes().

import { ETIQUETAS_TIPO_ARTICULO, TIPOS_DE_ARTICULO, opcionesDe } from "../enums.js";
import { TIPOS_DE_FILTRO } from "../descriptores.js";
import { diasHastaVencimiento } from "../formato/fechas.js";
import { textoComparable } from "../formato/opciones.js";

/**
 * Un medicamento del catalogo como opcion de selector: "Paracetamol 500 mg · Tableta (Generico)".
 *
 * El nombre solo no alcanza para elegir: el catalogo distingue un medicamento de otro por la
 * combinacion de nombre, concentracion, presentacion y marca (UNIQUE de la 00016), y dos
 * "Paracetamol" en una lista son indistinguibles.
 *
 * @param {{ id: string, nombre: string, concentracion?: string, presentacion?: string,
 *   marca?: string }} medicamento `presentacion` ya es la etiqueta resuelta (presentaciones.nombre,
 *   00144), no un valor de enum que traducir.
 * @returns {{ value: string, label: string }}
 */
export function opcionDeMedicamento(medicamento) {
  const principal = [medicamento.nombre, medicamento.concentracion].filter(Boolean).join(" ");
  const conPresentacion = [principal, medicamento.presentacion].filter(Boolean).join(" · ");
  return {
    value: medicamento.id,
    label: medicamento.marca ? `${conPresentacion} (${medicamento.marca})` : conPresentacion,
  };
}

export const FILTROS_CATALOGO_MEDICAMENTOS = [
  {
    id: "busqueda",
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: "Buscar medicamento",
    placeholder: "Nombre, marca, concentración o número de lote",
  },
  {
    id: "tipoArticulo",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Tipo de artículo",
    placeholder: "Todos",
    opciones: opcionesDe(TIPOS_DE_ARTICULO, ETIQUETAS_TIPO_ARTICULO),
  },
  // presentacion_id (00144): ya no es un enum fijo -- opcionesDesde carga el catalogo real.
  {
    id: "presentacionId",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Presentación",
    placeholder: "Todas",
    opcionesDesde: "presentaciones",
  },
  {
    id: "poblacion",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Uso",
    placeholder: "Todos",
    opciones: [
      { value: "pediatrico", label: "Pediatrico" },
      { value: "general", label: "General" },
    ],
  },
  {
    id: "estado",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Estado",
    placeholder: "Todos",
    opciones: [
      { value: "activos", label: "Activos" },
      { value: "inactivos", label: "Inactivos" },
    ],
  },
];

export const FILTROS_CATALOGO_VACIOS = Object.freeze({
  busqueda: "",
  tipoArticulo: null,
  presentacionId: null,
  poblacion: null,
  estado: null,
});

/**
 * Lotes agrupados por medicamento: cuantos hay, cuantos vencieron, el vencimiento mas proximo de
 * los que siguen vigentes y cuanto queda disponible hoy sumando todos sus lotes.
 *
 * @param {object[]} lotes Lo que devuelve listarLotes() (aLote, lotes.api.js).
 * @param {Map<string, number>} [disponiblePorLote] De sumarExistenciasPorLote()
 *   (useExistenciasPorLote.js): loteId -> cantidad disponible hoy. Sin ella, disponible queda en 0
 *   para todos -- mismo criterio que el resto de esta pantalla cuando falta un dato complementario.
 * @returns {Map<string, { lotes: number, vencidos: number, proximoVencimiento: string|null,
 *   diasParaProximo: number|null, numeros: string[], disponible: number }>}
 */
export function resumirLotesPorMedicamento(lotes = [], disponiblePorLote = new Map()) {
  const resumen = new Map();

  for (const lote of lotes) {
    if (!lote?.medicamentoId) continue;
    const actual = resumen.get(lote.medicamentoId) ?? {
      lotes: 0,
      vencidos: 0,
      proximoVencimiento: null,
      diasParaProximo: null,
      numeros: [],
      disponible: 0,
    };

    actual.lotes += 1;
    actual.disponible += Number(disponiblePorLote.get(lote.id) ?? 0);
    if (lote.numeroLote) actual.numeros.push(lote.numeroLote);

    const dias = diasHastaVencimiento(lote.fechaVencimiento);
    if (dias !== null && dias < 0) {
      actual.vencidos += 1;
    } else if (
      dias !== null &&
      (actual.diasParaProximo === null || dias < actual.diasParaProximo)
    ) {
      actual.diasParaProximo = dias;
      actual.proximoVencimiento = lote.fechaVencimiento;
    }

    resumen.set(lote.medicamentoId, actual);
  }

  return resumen;
}

/**
 * Aplica los filtros del catalogo.
 *
 * @param {object[]} medicamentos Lo que devuelve listarMedicamentos().
 * @param {object} filtros Forma de FILTROS_CATALOGO_VACIOS.
 * @param {Map} [resumenDeLotes] De resumirLotesPorMedicamento(), para buscar por numero de lote.
 * @returns {object[]}
 */
export function filtrarCatalogoMedicamentos(medicamentos = [], filtros = {}, resumenDeLotes) {
  const termino = textoComparable(filtros.busqueda);

  return medicamentos.filter((medicamento) => {
    if (!medicamento) return false;

    if (filtros.tipoArticulo && medicamento.tipoArticulo !== filtros.tipoArticulo) return false;
    if (filtros.presentacionId && medicamento.presentacionId !== filtros.presentacionId) {
      return false;
    }
    if (filtros.poblacion === "pediatrico" && !medicamento.esPediatrico) return false;
    if (filtros.poblacion === "general" && medicamento.esPediatrico) return false;
    if (filtros.estado === "activos" && medicamento.activo === false) return false;
    if (filtros.estado === "inactivos" && medicamento.activo !== false) return false;

    if (!termino) return true;

    const lotes = resumenDeLotes?.get(medicamento.id)?.numeros ?? [];
    return [
      medicamento.nombre,
      medicamento.marca,
      medicamento.concentracion,
      medicamento.formaFarmaceutica,
      ...lotes,
    ].some((valor) => textoComparable(valor).includes(termino));
  });
}

/** Si hay algun filtro del catalogo puesto. */
export function hayFiltrosDeCatalogo(filtros = {}) {
  return Boolean(
    (filtros.busqueda && filtros.busqueda.trim()) ||
    filtros.tipoArticulo ||
    filtros.presentacionId ||
    filtros.poblacion ||
    filtros.estado,
  );
}
