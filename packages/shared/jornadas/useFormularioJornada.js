// Hook de pantalla del formulario de jornada: alta y edicion (issue #179).
//
// Un solo hook para las dos operaciones (revision del plan, PLAN.md seccion 7, decision 4): los
// cinco campos, la carga de catalogos, la consulta de duplicado y la validacion son identicos
// entre alta y edicion, y dos hooks casi iguales terminan divergiendo justo en lo que mas
// importa. `jornada` ausente/sin `id` es alta (llama registrarJornada()); `jornada` con `id` es
// edicion (llama actualizarJornada(id, datos, { rol })).
//
// SOLO SE USA `jornada.id` DE LO QUE LLEGA POR PARAMETRO. El resto de los datos de edicion se
// vuelve a pedir con obtenerJornada(id): la tarjeta del kanban (useJornadasKanban.js,
// armarTarjeta()) solo trae nombre/fecha/comunidad/responsable/estado como TEXTO para pintar la
// tarjeta -- nunca comunidadId, responsableId ni proyectoId, que es justo lo que este formulario
// necesita para precargar los <select>. Pedirlo de nuevo aca, en vez de asumir que quien llama
// hidrato el objeto completo, evita que el formulario dependa de un contrato implicito con el
// kanban (y de paso trae datos frescos, no los que el tablero cargo hace rato).
//
// El selector de comunidad se filtra en cascada por departamento y municipio (criterio 2). Son
// dos selectores auxiliares que NO son campos del formulario -- jornadas no guarda departamento
// ni municipio, solo comunidad_id (00012_jornadas.sql) -- asi que su estado vive aparte de
// `valores` y solo sirven para acotar las opciones de `comunidad`. Las tres tablas del catalogo
// territorial las expone packages/shared/territorio/ (excepcion de alcance autorizada, ver
// PLAN.md seccion 7, decision 6).
//
// El rol se recibe por parametro y se pasa tal cual a actualizarJornada(): nunca se hardcodea el
// literal 'administrador', porque la politica de escritura de jornadas (00039) tambien admite
// tiene_permiso('jornadas.gestionar') y fijar el literal afirmaria una garantia que el servidor
// no da.
//
// El hook en si no se prueba montado (packages/shared corre vitest con environment "node", sin
// DOM, mismo motivo que useAltaUsuario.test.js/useEdicionUsuario.test.js): valoresIniciales() y
// aDatosDeJornada() se exportan aparte para poder probarlas sin montar nada.

import { useCallback, useEffect, useState } from "react";

import { listarProyectos } from "../proyectos/api.js";
import {
  listarComunidades,
  listarDepartamentos,
  listarMunicipios,
  obtenerComunidad,
} from "../territorio/api.js";
import { listarUsuarios } from "../usuarios/api.js";
import { actualizarJornada, listarJornadas, obtenerJornada, registrarJornada } from "./api.js";
import { advertirJornadaDuplicada, validarJornada } from "./validaciones.js";

/**
 * Valores del formulario a partir de una jornada completa (la de obtenerJornada(), con
 * comunidadId/responsableId/proyectoId), o vacios para el alta.
 *
 * Los campos del formulario son los ids de CAMPOS_FORMULARIO_JORNADA (comunidad, responsable,
 * proyecto, sin el sufijo `Id`): esta funcion traduce entre las dos formas.
 *
 * @param {object|null} [jornada]
 * @returns {{ nombre: string, fecha: string, comunidad: string, responsable: string, proyecto: string }}
 */
export function valoresIniciales(jornada) {
  return {
    nombre: jornada?.nombre ?? "",
    fecha: jornada?.fecha ?? "",
    comunidad: jornada?.comunidadId ?? "",
    responsable: jornada?.responsableId ?? "",
    proyecto: jornada?.proyectoId ?? "",
  };
}

/**
 * Traduce `valores` del formulario a lo que registrarJornada()/actualizarJornada() esperan.
 *
 * Solo normaliza `proyecto`: es el unico campo opcional de los cinco, y un `''` del `<select>`
 * sin elegir no es un UUID valido para la columna `proyecto_id` (nullable). El resto de campos
 * viaja tal cual.
 *
 * @param {object} valores
 * @returns {object}
 */
export function aDatosDeJornada(valores) {
  return { ...valores, proyecto: valores?.proyecto || null };
}

/** Mapea filas de un catalogo a la forma { label, value } que consumen Selector/FilterBar. */
function aOpciones(filas, etiquetaDe) {
  return (filas ?? []).map((fila) => ({ value: fila.id, label: etiquetaDe(fila) }));
}

function nombreDePerfil(perfil) {
  return [perfil.nombres, perfil.apellidos].filter(Boolean).join(" ");
}

/**
 * Estado y envio del formulario de alta/edicion de jornada.
 *
 * @param {object} [opciones]
 * @param {{ id: string }|null} [opciones.jornada] Con `id`, edicion (el resto de sus campos se
 *   ignora, ver encabezado del archivo); sin `id` o ausente, alta.
 * @param {string} [opciones.rol] Rol de quien tiene abierto el formulario
 *   (useSesionCompartida().rol en la web). Se pasa tal cual a actualizarJornada().
 * @returns {{
 *   valores: object,
 *   errores: Record<string, string>,
 *   error: object|null,
 *   enviando: boolean,
 *   cargando: boolean,
 *   esEdicion: boolean,
 *   catalogos: { departamentos: object[], municipios: object[], comunidades: object[],
 *     perfiles: object[], proyectos: object[] },
 *   departamentoId: number|string|null,
 *   municipioId: number|string|null,
 *   setDepartamento: (id: number|string|null) => void,
 *   setMunicipio: (id: number|string|null) => void,
 *   setCampo: (id: string, valor: unknown) => void,
 *   advertenciaDuplicado: string|null,
 *   enviar: () => Promise<{ ok: boolean, jornada?: object|null }>,
 *   cancelar: () => void,
 * }}
 */
export function useFormularioJornada({ jornada, rol } = {}) {
  const jornadaId = jornada?.id ?? null;
  const esEdicion = Boolean(jornadaId);

  // En edicion arranca vacio: se rellena cuando obtenerJornada() resuelve, mas abajo. En alta no
  // hay nada que pedir, arranca vacio directo.
  const [jornadaBase, setJornadaBase] = useState(null);
  const [valores, setValores] = useState(() => valoresIniciales(esEdicion ? null : jornada));
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(esEdicion);

  const [departamentoId, setDepartamentoId] = useState(null);
  const [municipioId, setMunicipioId] = useState(null);

  const [departamentos, setDepartamentos] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [comunidades, setComunidades] = useState([]);
  const [perfiles, setPerfiles] = useState([]);
  const [proyectos, setProyectos] = useState([]);

  const [advertenciaDuplicado, setAdvertenciaDuplicado] = useState(null);

  // Catalogos que no dependen de la cascada: se cargan una sola vez, al montar.
  useEffect(() => {
    let vigente = true;

    listarDepartamentos().then(({ departamentos: filas }) => {
      if (vigente) setDepartamentos(aOpciones(filas, (fila) => fila.nombre));
    });

    listarUsuarios({ estado: true }).then(({ usuarios }) => {
      if (vigente) setPerfiles(aOpciones(usuarios, nombreDePerfil));
    });

    listarProyectos().then(({ proyectos: filas }) => {
      if (vigente) setProyectos(aOpciones(filas, (fila) => fila.nombre));
    });

    return () => {
      vigente = false;
    };
  }, []);

  // Edicion: pide la jornada completa (comunidadId/responsableId/proyectoId incluidos, que la
  // tarjeta del kanban no trae, ver encabezado del archivo) y, con su comunidad, resuelve la
  // cascada completa de departamento y municipio para preseleccionarlos. Solo al montar: la
  // jornada que se edita no cambia durante la vida del formulario (quien llama monta un
  // componente nuevo por cada jornada, mismo criterio que useEdicionUsuario.js).
  useEffect(() => {
    if (!esEdicion) return undefined;
    let vigente = true;

    (async () => {
      const { jornada: completa, error: errorDeLectura } = await obtenerJornada(jornadaId);
      if (!vigente) return;

      if (errorDeLectura || !completa) {
        setError(errorDeLectura);
        setCargando(false);
        return;
      }

      setJornadaBase(completa);
      setValores(valoresIniciales(completa));

      if (completa.comunidadId) {
        const { comunidad } = await obtenerComunidad(completa.comunidadId);
        if (!vigente) return;
        setDepartamentoId(comunidad?.departamentoId ?? null);
        setMunicipioId(comunidad?.municipioId ?? null);
      }

      setCargando(false);
    })();

    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cascada, paso 1: departamento -> municipios. Cambiar de departamento limpia la comunidad ya
  // elegida, porque ya no tiene sentido en el nuevo departamento.
  useEffect(() => {
    if (!departamentoId) {
      setMunicipios([]);
      return undefined;
    }
    let vigente = true;

    listarMunicipios({ departamentoId }).then(({ municipios: filas }) => {
      if (vigente) setMunicipios(aOpciones(filas, (fila) => fila.nombre));
    });

    return () => {
      vigente = false;
    };
  }, [departamentoId]);

  // Cascada, paso 2: municipio -> comunidades.
  useEffect(() => {
    if (!municipioId) {
      setComunidades([]);
      return undefined;
    }
    let vigente = true;

    listarComunidades({ municipioId }).then(({ comunidades: filas }) => {
      if (vigente) setComunidades(aOpciones(filas, (fila) => fila.nombre));
    });

    return () => {
      vigente = false;
    };
  }, [municipioId]);

  // Criterio 4: advierte, nunca impide. Un fallo de esta consulta deja la advertencia en null,
  // nunca bloquea el guardado (ver PLAN.md, verificacion C).
  useEffect(() => {
    if (!valores.comunidad || !valores.fecha) {
      setAdvertenciaDuplicado(null);
      return undefined;
    }
    let vigente = true;

    listarJornadas({
      comunidad: valores.comunidad,
      fechaInicio: valores.fecha,
      fechaFin: valores.fecha,
    }).then(({ jornadas: filas, error: errorDeConsulta }) => {
      if (!vigente) return;
      setAdvertenciaDuplicado(
        errorDeConsulta
          ? null
          : advertirJornadaDuplicada({ jornadas: filas, jornadaActualId: jornadaId }),
      );
    });

    return () => {
      vigente = false;
    };
  }, [valores.comunidad, valores.fecha, jornadaId]);

  const setDepartamento = useCallback((id) => {
    setDepartamentoId(id);
    setMunicipioId(null);
    setComunidades([]);
    setValores((anteriores) => ({ ...anteriores, comunidad: "" }));
  }, []);

  const setMunicipio = useCallback((id) => {
    setMunicipioId(id);
    setValores((anteriores) => ({ ...anteriores, comunidad: "" }));
  }, []);

  const setCampo = useCallback((id, valor) => {
    setValores((anteriores) => ({ ...anteriores, [id]: valor }));
    // Se limpia el error de ESE campo al tocarlo, no todos, mismo criterio que useAltaUsuario.js.
    setErrores((anteriores) => {
      if (!(id in anteriores)) return anteriores;
      return Object.fromEntries(Object.entries(anteriores).filter(([clave]) => clave !== id));
    });
  }, []);

  const cancelar = useCallback(() => {
    setValores(valoresIniciales(esEdicion ? jornadaBase : jornada));
    setErrores({});
    setError(null);
    setEnviando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jornadaBase]);

  const enviar = useCallback(async () => {
    const erroresDeValidacion = validarJornada(valores);
    if (Object.keys(erroresDeValidacion).length > 0) {
      setErrores(erroresDeValidacion);
      return { ok: false };
    }

    setEnviando(true);
    setError(null);

    const datos = aDatosDeJornada(valores);
    const resultado = esEdicion
      ? await actualizarJornada(jornadaId, datos, { rol })
      : await registrarJornada(datos);

    setEnviando(false);

    if (resultado.error) {
      setError(resultado.error);
      return { ok: false };
    }

    if (!esEdicion) setValores(valoresIniciales(null));
    return { ok: true, jornada: resultado.jornada };
  }, [valores, esEdicion, jornadaId, rol]);

  return {
    valores,
    errores,
    error,
    enviando,
    cargando,
    esEdicion,
    catalogos: { departamentos, municipios, comunidades, perfiles, proyectos },
    departamentoId,
    municipioId,
    setDepartamento,
    setMunicipio,
    setCampo,
    advertenciaDuplicado,
    enviar,
    cancelar,
  };
}
