import { useCallback, useEffect, useMemo, useState } from "react";

import { useAltaDeComunidadEnLinea } from "../territorio/useAltaDeComunidadEnLinea.js";
import { useCascadaTerritorial } from "../territorio/useCascadaTerritorial.js";
import { actualizarPaciente } from "./api.js";
import { listarIdiomas } from "./idiomas.api.js";
import { CAMPOS_REGISTRO_PACIENTE, OPCIONES_SEXO } from "./campos.js";

export const CAMPOS_EDICION_PACIENTE = CAMPOS_REGISTRO_PACIENTE;

/**
 * Valores iniciales del formulario de edicion a partir del paciente. La comunidad se toma de
 * `comunidadId`.
 *
 * @param {object|null} paciente
 * @returns {Record<string, string>} Valor por id de campo; `""` donde no hay dato.
 */
export function valoresDesdePaciente(paciente) {
  return CAMPOS_EDICION_PACIENTE.reduce((valores, campo) => {
    const valor = campo.id === "comunidad" ? paciente?.comunidadId : paciente?.[campo.id];
    valores[campo.id] = valor ?? "";
    return valores;
  }, {});
}

/**
 * @param {Record<string, string>} valores Valores actuales del formulario.
 * @param {Record<string, string>} iniciales Los de `valoresDesdePaciente`.
 * @returns {boolean} Si algun campo editable cambio.
 */
export function hayCambiosPendientes(valores, iniciales) {
  return CAMPOS_EDICION_PACIENTE.some((campo) => valores[campo.id] !== iniciales[campo.id]);
}

/**
 * Edicion de los datos de un paciente.
 *
 * Devuelve la misma forma que useRegistroPaciente() en todo lo que toca al formulario -- campos,
 * catalogos, cascada territorial y alta de comunidad en linea --, para que las dos pantallas
 * dibujen el mismo control. Hasta la #840 esta edicion ofrecia una lista plana con todas las
 * comunidades del pais en lugar de departamento -> municipio -> comunidad, y tampoco cargaba el
 * catalogo de idiomas, asi que el selector de idioma salia siempre vacio.
 *
 * @param {object|null} paciente
 * @param {{ rol?: string }} [opciones] El rol decide si se ofrece crear una comunidad que falta.
 */
export function useEdicionPaciente(paciente, { rol } = {}) {
  const iniciales = useMemo(() => valoresDesdePaciente(paciente), [paciente]);
  const [valores, setValores] = useState(iniciales);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [idiomas, setIdiomas] = useState([]);

  useEffect(() => {
    setValores(iniciales);
    setErrores({});
    setError(null);
  }, [iniciales]);

  useEffect(() => {
    let vigente = true;
    // El catalogo de idiomas faltaba (issue #699). El formulario de edicion ofrece los once campos
    // desde la #818, pero el selector de idioma se dibujaba sin una sola opcion: el valor guardado
    // no aparecia seleccionado y no habia forma de cambiarlo. listarIdiomas() ya devuelve
    // value/label, igual que en useRegistroPaciente.
    listarIdiomas().then(({ idiomas: opciones }) => {
      if (vigente) setIdiomas(opciones);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const setCampo = useCallback((id, valor) => {
    setValores((anteriores) => ({ ...anteriores, [id]: valor }));
    setErrores((anteriores) => {
      if (!(id in anteriores)) return anteriores;
      return Object.fromEntries(Object.entries(anteriores).filter(([clave]) => clave !== id));
    });
  }, []);

  const elegirComunidad = useCallback(
    (comunidadId) => setCampo("comunidad", comunidadId),
    [setCampo],
  );

  const {
    departamentoId,
    municipioId,
    setDepartamento,
    setMunicipio,
    posicionarEn,
    recargarComunidades,
    catalogos: catalogosDeTerritorio,
  } = useCascadaTerritorial({
    comunidadInicial: paciente?.comunidadId ?? null,
    alElegirComunidad: elegirComunidad,
  });

  const alCrearComunidad = useCallback(
    async (comunidad) => {
      await recargarComunidades();
      setCampo("comunidad", comunidad.id);
    },
    [recargarComunidades, setCampo],
  );

  const {
    puedeCrear: puedeCrearComunidad,
    crear: registrarComunidad,
    errores: erroresComunidad,
    creando: creandoComunidad,
  } = useAltaDeComunidadEnLinea({ municipioId, rol, alCrear: alCrearComunidad });

  const descartar = useCallback(() => {
    setValores(iniciales);
    setErrores({});
    setError(null);
    // La cascada tambien vuelve a la comunidad original: si no, quedaria mostrando el municipio
    // que se estaba probando con la comunidad de antes, que no pertenece a el.
    posicionarEn(iniciales.comunidad || null);
  }, [iniciales, posicionarEn]);

  const guardar = useCallback(async () => {
    if (!paciente?.id) return { ok: false };

    setEnviando(true);
    const resultado = await actualizarPaciente(paciente.id, valores);
    setEnviando(false);
    setErrores(resultado.errores ?? {});
    setError(resultado.error);

    if (resultado.error) return { ok: false };
    return { ok: true, paciente: resultado.paciente };
  }, [paciente, valores]);

  return {
    campos: CAMPOS_EDICION_PACIENTE,
    valores,
    errores,
    error,
    enviando,
    hayCambios: hayCambiosPendientes(valores, iniciales),
    departamentoId,
    municipioId,
    setCampo,
    setDepartamento,
    setMunicipio,
    descartar,
    guardar,
    puedeCrearComunidad,
    registrarComunidad,
    erroresComunidad,
    creandoComunidad,
    // Claves explicitas y no `...catalogosDeTerritorio`: useEdicionPaciente.catalogos.test.js lee
    // esta linea para comprobar que cada selector tiene su catalogo (issue #699).
    catalogos: {
      departamentos: catalogosDeTerritorio.departamentos,
      municipios: catalogosDeTerritorio.municipios,
      comunidades: catalogosDeTerritorio.comunidades,
      idiomas,
      sexo: OPCIONES_SEXO,
    },
  };
}
