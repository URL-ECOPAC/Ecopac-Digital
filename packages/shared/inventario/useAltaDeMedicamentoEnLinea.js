// Alta de un medicamento SIN salir del formulario que lo necesita (issue #840, bloque C).
//
// Mismo papel que useAltaDeComunidadEnLinea (territorio/), que fue el molde de la #838: el
// renglon de una donacion de medicamentos ahora elige del catalogo, y el medicamento donado
// muchas veces todavia no esta en el. Mandar a quien registra a Inventario a darlo de alta pierde
// lo que ya llevaba escrito de la donacion.
//
// A diferencia de una comunidad, un medicamento no se crea solo con un nombre: el catalogo exige
// concentracion, presentacion, marca y al menos un principio activo (00016, 00050), porque la
// combinacion es la que distingue un medicamento de otro. Por eso este hook lleva un formulario
// corto propio, hecho con los descriptores de CAMPOS_MEDICAMENTO -los mismos del alta completa
// en Inventario-, y no el campo de texto unico de SelectorConAlta.
//
// Que NO hace: no decide quien puede crear (es puedeAdministrarMedicamentos, y quien decide de
// verdad es la politica de la 00050), no dibuja nada y no sabe que formulario lo monta. Quien lo
// usa le pasa `alCrear`, que es recargar su catalogo y dejar elegido el medicamento nuevo.

import { useCallback, useState } from "react";

import { validarConDescriptores } from "../validations/index.js";
import { CAMPOS_MEDICAMENTO } from "./campos.js";
import { puedeAdministrarMedicamentos } from "./medicamentos.permisos.js";
import { registrarMedicamento } from "./medicamentos.api.js";
import { listarPresentaciones } from "./presentaciones.api.js";
import { listarPrincipiosActivos } from "./principios-activos.api.js";

// presentacionId (00144): sigue el mismo id que CAMPOS_MEDICAMENTO declara -- un id que no
// coincida con ninguno filtra el campo en silencio, el mismo defecto que AGENTS.md senala para
// un import que falta (issues #818/#821).
const IDS_ALTA_EN_LINEA = [
  "nombre",
  "concentracion",
  "presentacionId",
  "marca",
  "principiosActivos",
];

/**
 * Los campos que exige el catalogo, en el orden del alta completa. formaFarmaceutica y
 * esPediatrico se completan despues desde Inventario: son opcionales y no distinguen un
 * medicamento de otro.
 */
export const CAMPOS_ALTA_MEDICAMENTO_EN_LINEA = CAMPOS_MEDICAMENTO.filter((campo) =>
  IDS_ALTA_EN_LINEA.includes(campo.id),
);

const VALORES_VACIOS = {
  nombre: "",
  concentracion: "",
  presentacionId: "",
  marca: "",
  principiosActivos: [],
};

/** `{ value, label }` para los selectores de las dos apps. */
function aOpciones(filas = []) {
  return filas.map((fila) => ({ value: fila.id, label: fila.nombre }));
}

/**
 * @param {object} opciones
 * @param {string} [opciones.rol] Rol de quien tiene el formulario abierto.
 * @param {(medicamento: object) => void|Promise<void>} [opciones.alCrear]
 * @returns {{
 *   puedeCrear: boolean,
 *   abierto: boolean,
 *   abrir: () => Promise<void>,
 *   cerrar: () => void,
 *   campos: object[],
 *   valores: object,
 *   setCampo: (id: string, valor: unknown) => void,
 *   errores: Record<string, string>,
 *   error: object|null,
 *   creando: boolean,
 *   crear: () => Promise<{ medicamento: object|null, error: object|null }>,
 *   catalogos: { principiosActivos: object[], presentaciones: object[] },
 * }}
 */
export function useAltaDeMedicamentoEnLinea({ rol, alCrear } = {}) {
  const [abierto, setAbierto] = useState(false);
  const [valores, setValores] = useState(VALORES_VACIOS);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [creando, setCreando] = useState(false);
  const [principiosActivos, setPrincipiosActivos] = useState([]);
  const [presentaciones, setPresentaciones] = useState([]);

  // Los principios activos y las presentaciones se piden al abrir, no al montar: la mayoria de
  // las veces el medicamento ya esta en el catalogo y nadie abre el alta.
  const abrir = useCallback(async () => {
    setAbierto(true);
    if (principiosActivos.length > 0 && presentaciones.length > 0) return;

    const [{ principiosActivos: listaDePrincipios }, { presentaciones: listaDePresentaciones }] =
      await Promise.all([listarPrincipiosActivos(), listarPresentaciones()]);

    setPrincipiosActivos(aOpciones(listaDePrincipios ?? []));
    setPresentaciones(aOpciones(listaDePresentaciones ?? []));
  }, [principiosActivos.length, presentaciones.length]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setValores(VALORES_VACIOS);
    setErrores({});
    setError(null);
  }, []);

  const setCampo = useCallback((id, valor) => {
    setValores((anteriores) => ({ ...anteriores, [id]: valor }));
    setErrores((anteriores) => {
      if (!(id in anteriores)) return anteriores;
      return Object.fromEntries(Object.entries(anteriores).filter(([clave]) => clave !== id));
    });
  }, []);

  const crear = useCallback(async () => {
    const erroresDeValidacion = validarConDescriptores(CAMPOS_ALTA_MEDICAMENTO_EN_LINEA, valores);
    if (Object.keys(erroresDeValidacion).length > 0) {
      setErrores(erroresDeValidacion);
      return { medicamento: null, error: null };
    }

    setCreando(true);
    setError(null);
    const { medicamento, error: fallo } = await registrarMedicamento({
      nombre: valores.nombre.trim(),
      concentracion: valores.concentracion.trim(),
      presentacionId: valores.presentacionId,
      marca: valores.marca.trim(),
      principiosActivosIds: valores.principiosActivos,
    });

    if (fallo) {
      setCreando(false);
      setError(fallo);
      return { medicamento: null, error: fallo };
    }

    await alCrear?.(medicamento);
    setCreando(false);
    cerrar();
    return { medicamento, error: null };
  }, [valores, alCrear, cerrar]);

  return {
    puedeCrear: puedeAdministrarMedicamentos(rol),
    abierto,
    abrir,
    cerrar,
    campos: CAMPOS_ALTA_MEDICAMENTO_EN_LINEA,
    valores,
    setCampo,
    errores,
    error,
    creando,
    crear,
    catalogos: { principiosActivos, presentaciones },
  };
}
