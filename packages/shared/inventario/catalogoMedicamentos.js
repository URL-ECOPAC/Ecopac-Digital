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

import { ETIQUETAS_PRESENTACION, PRESENTACIONES_DE_MEDICAMENTO, opcionesDe } from "../enums.js";
import { TIPOS_DE_FILTRO } from "../descriptores.js";
import { diasHastaVencimiento } from "../formato/fechas.js";
import { textoComparable } from "../formato/opciones.js";

export const FILTROS_CATALOGO_MEDICAMENTOS = [
  {
    id: "busqueda",
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: "Buscar medicamento",
    placeholder: "Nombre, marca, concentración o número de lote",
  },
  {
    id: "presentacion",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Presentación",
    placeholder: "Todas",
    opciones: opcionesDe(PRESENTACIONES_DE_MEDICAMENTO, ETIQUETAS_PRESENTACION),
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
  presentacion: null,
  poblacion: null,
  estado: null,
});

/**
 * Lotes agrupados por medicamento: cuantos hay, cuantos vencieron y el vencimiento mas proximo de
 * los que siguen vigentes.
 *
 * @param {object[]} lotes Lo que devuelve listarLotes() (aLote, lotes.api.js).
 * @returns {Map<string, { lotes: number, vencidos: number, proximoVencimiento: string|null,
 *   diasParaProximo: number|null, numeros: string[] }>}
 */
export function resumirLotesPorMedicamento(lotes = []) {
  const resumen = new Map();

  for (const lote of lotes) {
    if (!lote?.medicamentoId) continue;
    const actual = resumen.get(lote.medicamentoId) ?? {
      lotes: 0,
      vencidos: 0,
      proximoVencimiento: null,
      diasParaProximo: null,
      numeros: [],
    };

    actual.lotes += 1;
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

    if (filtros.presentacion && medicamento.presentacion !== filtros.presentacion) return false;
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
    filtros.presentacion ||
    filtros.poblacion ||
    filtros.estado,
  );
}
