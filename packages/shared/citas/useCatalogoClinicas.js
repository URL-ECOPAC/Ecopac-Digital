// View model de la pantalla del catalogo de clinicas (issue #927, 00183).
//
// Mismo patron que useCatalogoAreas.js: el catalogo es chico, se trae completo -tambien las
// retiradas, para poder reactivarlas- y la busqueda filtra en el cliente. Dos permisos: crear y
// editar (administradora y jornadas.gestionar) y retirar, reactivar o eliminar (administradora).

import { useCallback, useEffect, useMemo, useState } from "react";

import { textoComparable } from "../formato/opciones.js";
import {
  actualizarClinica,
  crearClinica,
  eliminarClinica,
  listarClinicas,
} from "./clinicas.api.js";
import { CAMPOS_CLINICA } from "./clinicas.campos.js";
import { ESTADOS_CLINICA } from "./clinicas.columnas.js";
import { FILTROS_CATALOGO_CLINICAS_VACIOS } from "./clinicas.filtros.js";
import {
  puedeMantenerClinicas,
  puedeRetirarClinicas,
  puedeVerCatalogoDeClinicas,
} from "./clinicas.permisos.js";

/**
 * Las clinicas que coinciden con la busqueda, sin distinguir mayusculas ni acentos. Pura.
 *
 * @param {object[]} clinicas
 * @param {string} [busqueda]
 * @returns {object[]}
 */
export function filtrarClinicas(clinicas = [], busqueda = "") {
  const termino = textoComparable(busqueda);
  if (!termino) return clinicas;
  return clinicas.filter((clinica) => textoComparable(clinica.nombre).includes(termino));
}

/**
 * Que paso al eliminar una clinica, en una frase para la pantalla.
 *
 * @param {"eliminada"|"retirada"|null} resultado
 * @returns {string|null}
 */
export function mensajeDeEliminacionDeClinica(resultado) {
  if (resultado === "eliminada") return "La clínica se eliminó.";
  if (resultado === "retirada") {
    return "La clínica ya tiene citas: se retiró en lugar de eliminarse, y las conserva.";
  }
  return null;
}

/**
 * Catalogo de clinicas: busqueda, alta, edicion, retiro y eliminacion.
 *
 * @param {{ rol?: string }} [opciones]
 * @returns {object} Con: filas, total, filtros, setFiltro, limpiarFiltros, hayFiltros, cargando, error, enviando, erroresForm, aviso, recargar, permitido, puedeMantener, puedeRetirar, campos, crear, editar, alternarVigencia, eliminar, catalogos.
 */
export function useCatalogoClinicas({ rol } = {}) {
  const [filtros, setFiltros] = useState(FILTROS_CATALOGO_CLINICAS_VACIOS);
  const [clinicas, setClinicas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erroresForm, setErroresForm] = useState({});
  const [aviso, setAviso] = useState(null);

  const permitido = puedeVerCatalogoDeClinicas(rol);
  const puedeMantener = puedeMantenerClinicas(rol);
  const puedeRetirar = puedeRetirarClinicas(rol);

  const cargar = useCallback(async () => {
    if (!permitido) {
      setClinicas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    const respuesta = await listarClinicas();
    setClinicas(respuesta.clinicas);
    setError(respuesta.error);
    setCargando(false);
  }, [permitido]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const setFiltro = useCallback((id, valor) => {
    setFiltros((anteriores) => ({ ...anteriores, [id]: valor ?? "" }));
  }, []);

  const limpiarFiltros = useCallback(() => setFiltros(FILTROS_CATALOGO_CLINICAS_VACIOS), []);

  const filas = useMemo(
    () => filtrarClinicas(clinicas, filtros.busqueda),
    [clinicas, filtros.busqueda],
  );

  /** Corre una escritura y recarga si salio bien; los errores van al formulario. */
  const escribir = useCallback(
    async (permitida, operacion) => {
      if (!permitida) return { ok: false };
      setEnviando(true);
      setErroresForm({});
      setAviso(null);
      const res = await operacion();
      setEnviando(false);

      if (res.error || Object.keys(res.errores ?? {}).length > 0) {
        setErroresForm({
          ...(res.errores ?? {}),
          ...(res.error ? { general: res.error.mensaje } : {}),
        });
        return { ok: false, errores: res.errores ?? {} };
      }

      await cargar();
      return { ok: true, ...res };
    },
    [cargar],
  );

  const crear = useCallback(
    (datos) => escribir(puedeMantener, () => crearClinica(datos ?? {})),
    [escribir, puedeMantener],
  );

  const editar = useCallback(
    (id, datos = {}) =>
      escribir(
        // Retirar es de la administradora; editar nombre o salas, de quien mantiene.
        datos.esVigente === false ? puedeRetirar : puedeMantener,
        () => actualizarClinica(id, datos),
      ),
    [escribir, puedeMantener, puedeRetirar],
  );

  const alternarVigencia = useCallback(
    (clinica) => {
      if (!clinica?.id) return Promise.resolve({ ok: false });
      return editar(clinica.id, { esVigente: !clinica.esVigente });
    },
    [editar],
  );

  /** Elimina, o retira si ya tiene citas: lo decide la base y se avisa que paso. */
  const eliminar = useCallback(
    async (clinica) => {
      if (!clinica?.id) return { ok: false };
      const res = await escribir(puedeRetirar, async () => {
        const { resultado, error: fallo } = await eliminarClinica(clinica.id);
        return { resultado, error: fallo, errores: {} };
      });
      if (res.ok) setAviso(mensajeDeEliminacionDeClinica(res.resultado));
      return res;
    },
    [escribir, puedeRetirar],
  );

  return {
    filas,
    total: filas.length,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros: Boolean(filtros.busqueda?.trim()),
    cargando,
    error,
    enviando,
    erroresForm,
    aviso,
    recargar: cargar,
    permitido,
    puedeMantener,
    puedeRetirar,
    campos: CAMPOS_CLINICA,
    crear,
    editar,
    alternarVigencia,
    eliminar,
    catalogos: { estadoClinica: ESTADOS_CLINICA },
  };
}
