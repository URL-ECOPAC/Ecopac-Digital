// Hook de pantalla de la asignacion (y desasignacion) de personal a una jornada (issue #182).
//
// Se monta sobre la pestaña Equipo de la pantalla de detalle de #181
// (apps/web/src/pages/DetalleJornadaPage.jsx): ese archivo ya expone jornada.personal y
// recargarPersonal() (useDetalleJornada.js) para que este hook los use, sin volver a leer el
// historial ni los contadores de la jornada.
//
// CAMPOS_ASIGNACION_PERSONAL_SIN_PERFIL (campos.js), COLUMNAS_RESULTADOS_ASIGNACION_PERSONAL
// (columnas.js) y puedeVerRosterCompleto() (permisos.js) viven en el resto del modulo, no aca:
// son descriptores y una regla de permisos, y la estructura de modulo de
// docs/ARQUITECTURA-FRONTEND.md los pone en esos archivos, no en el hook de pantalla. Aca solo se
// combinan: buscar personal (listarUsuarios, usuarios/api.js), armar la fila de asignacion, la
// advertencia de choque del mismo dia (obtenerAsignacionesDelDia + advertirChoqueDeHorario) y el
// conteo por rol del criterio 5.
//
// Funciones puras exportadas aparte (no codigo suelto dentro del hook), mismo motivo que el
// resto de shared: vitest corre con environment "node", sin DOM, asi que el hook en si no se
// monta en sus pruebas (useAsignacionPersonal.test.js prueba estas funciones sueltas).

import { useCallback, useEffect, useState } from "react";

import { listarUsuarios } from "../usuarios/api.js";
import { TODOS_LOS_ROLES, etiquetaDeRol } from "../usuarios/roles.js";
import { nombreCompletoDe } from "../usuarios/useUsuariosListado.js";
import { asignarPersonal, desasignarPersonal, obtenerAsignacionesDelDia } from "./api.js";
import { advertirChoqueDeHorario, validarAsignacionPersonal } from "./validaciones.js";

/**
 * Cuantos resultados se muestran como maximo de una busqueda de personal (issue #182, criterio 1).
 *
 * No es el `limite` que se le manda a listarUsuarios(): ver calcularLimiteDeBusqueda().
 */
export const LIMITE_BUSQUEDA_PERSONAL = 20;

const VALORES_VACIOS = { perfil: "", rolEnJornada: "", horaInicio: "", horaFin: "", responsabilidad: "" };

/**
 * Si un perfil ya esta en la lista de personal de esta jornada.
 *
 * Es UX, no la regla real: el UNIQUE (jornada_id, perfil_id) de la migracion 00012 es quien de
 * verdad impide asignar dos veces a la misma persona (criterio 2 de la issue #174, ya cumplido
 * por asignarPersonal()). Esto solo evita ofrecer en la busqueda una opcion que el servidor va a
 * rechazar igual.
 *
 * @param {string} perfilId
 * @param {Array<{ perfilId: string }>} personal Filas de jornada.personal (COLUMNAS_DE_PERSONAL
 *   de api.js, que ya trae `perfilId`).
 * @returns {boolean}
 */
export function estaYaAsignado(perfilId, personal) {
  return (personal ?? []).some((fila) => fila?.perfilId === perfilId);
}

/** Resultados de listarUsuarios() sin quienes ya estan en `personal` (ver estaYaAsignado()). */
export function excluirYaAsignados(usuarios, personal) {
  return (usuarios ?? []).filter((usuario) => !estaYaAsignado(usuario.id, personal));
}

/** Traduce un perfil de listarUsuarios() a la fila que pinta COLUMNAS_RESULTADOS_ASIGNACION_PERSONAL. */
export function armarFilaDeResultado(usuario) {
  return {
    id: usuario.id,
    nombreCompleto: nombreCompletoDe(usuario),
    rolEtiqueta: etiquetaDeRol(usuario.rol),
    rol: usuario.rol,
  };
}

/**
 * `limite` a pedirle a listarUsuarios() para que excluirYaAsignados() nunca vacie el cupo
 * visible (bug encontrado en revision: pedir solo LIMITE_BUSQUEDA_PERSONAL y filtrar despues
 * podia mostrar una lista vacia si los primeros resultados ya estaban todos asignados a esta
 * jornada, aunque existieran mas perfiles sin asignar mas atras en el orden alfabetico).
 *
 * Sobrepedir exactamente `personal.length` alcanza: como mucho se excluyen `personal.length`
 * filas del resultado crudo (no puede haber mas exclusiones que personas ya asignadas), asi que
 * sobrepedir esa cantidad garantiza que, si existen suficientes coincidencias en la base, sobrevivan
 * al menos LIMITE_BUSQUEDA_PERSONAL despues de filtrar.
 *
 * @param {object[]} [personal] jornada.personal.
 * @returns {number}
 */
export function calcularLimiteDeBusqueda(personal) {
  return LIMITE_BUSQUEDA_PERSONAL + (personal?.length ?? 0);
}

/**
 * Arma los resultados de busqueda a partir de lo que devolvio listarUsuarios() (pedido con
 * calcularLimiteDeBusqueda(personal)): excluye a quien ya esta asignado, recorta a
 * LIMITE_BUSQUEDA_PERSONAL para mostrar, y marca si la lista quedo recortada.
 *
 * `truncado` es true en dos casos, cualquiera de los dos basta para no poder afirmar "esto es
 * todo lo que hay": (a) despues de excluir a los ya asignados sobran mas de
 * LIMITE_BUSQUEDA_PERSONAL coincidencias reales -- se estan mostrando menos de las que existen; o
 * (b) `usuarios` crudo llego exactamente al `limite` que se pidio, lo que significa que la base
 * puede tener mas coincidencias que ni siquiera se llegaron a pedir. Sin esta señal, el modal no
 * podia distinguir "no hay nadie mas que coincida" de "hay mas, no te los muestro" (hallazgo de
 * la revision).
 *
 * @param {object[]} usuarios Resultado crudo de listarUsuarios() (sin excluir), tal como llego.
 * @param {object[]} [personal] jornada.personal, para excluir y para el mismo calculo de limite
 *   que se uso al pedir `usuarios`.
 * @returns {{ resultados: object[], truncado: boolean }}
 */
export function armarResultadosDeBusqueda(usuarios, personal) {
  const limiteSolicitado = calcularLimiteDeBusqueda(personal);
  const filtrados = excluirYaAsignados(usuarios, personal);
  const truncado = filtrados.length > LIMITE_BUSQUEDA_PERSONAL || (usuarios?.length ?? 0) === limiteSolicitado;

  return {
    resultados: filtrados.slice(0, LIMITE_BUSQUEDA_PERSONAL).map(armarFilaDeResultado),
    truncado,
  };
}

/**
 * Cuenta el personal asignado por rol dentro de la jornada (issue #182, criterio 5).
 *
 * Cuenta `rolEnJornada` (el rol que la persona ejerce EN LA JORNADA, jornada_personal.rol_en_jornada),
 * no `perfiles.rol`: una misma persona puede tener un rol de cuenta y cubrir otro en el terreno,
 * y lo que el criterio pide es "personas por rol dentro de la jornada".
 *
 * Devuelve solo los roles con al menos una persona, en el orden de TODOS_LOS_ROLES (usuarios/roles.js)
 * para que el orden no dependa de en que orden llegaron las filas.
 *
 * Cuenta sobre lo que le llegue en `personal`, que puede ya venir recortado por RLS antes de
 * llegar aca (ver puedeVerRosterCompleto() en permisos.js): esta funcion no lo sabe ni le
 * corresponde saberlo, quien la llama decide si el numero resultante se puede mostrar como total.
 *
 * @param {Array<{ rolEnJornada: string }>} personal
 * @returns {Array<{ rol: string, etiqueta: string, cantidad: number }>}
 */
export function contarPersonalPorRol(personal) {
  const conteos = new Map();
  for (const fila of personal ?? []) {
    const rol = fila?.rolEnJornada;
    if (!rol) continue;
    conteos.set(rol, (conteos.get(rol) ?? 0) + 1);
  }

  return TODOS_LOS_ROLES.filter((rol) => conteos.has(rol)).map((rol) => ({
    rol,
    etiqueta: etiquetaDeRol(rol),
    cantidad: conteos.get(rol),
  }));
}

/**
 * Mensaje a mostrar cuando asignarPersonal() falla, mas especifico que el generico de
 * CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD ("Ese registro ya existe...").
 *
 * No se toca errores-de-supabase.js (fuera de alcance de #182: cambiaria el mensaje de
 * unicidad para todos los modulos que lo usan). El texto especifico de esta pantalla se decide
 * aca, en shared, y no en el componente de la web: el mismo hook tiene que servirle a la version
 * movil de esta pantalla sin que cada plataforma reescriba el mensaje por su cuenta.
 *
 * @param {{ codigo?: string, mensaje?: string }|null} error
 * @returns {string|null}
 */
export function mensajeDeErrorDeAsignacion(error) {
  if (!error) return null;
  if (error.codigo === "unicidad") return "Esta persona ya esta asignada a esta jornada.";
  return error.mensaje ?? null;
}

/**
 * Estado y envio de la busqueda + asignacion de personal a una jornada (issue #182).
 *
 * `jornadaFecha` hace falta para la advertencia del criterio 3 (obtenerAsignacionesDelDia() pide
 * la fecha); `personal` es jornada.personal de useDetalleJornada(), para excluir de la busqueda a
 * quien ya esta asignado (ver estaYaAsignado()) y para calcular cuanto pedirle a listarUsuarios()
 * (ver calcularLimiteDeBusqueda()).
 *
 * La busqueda no dispara ninguna consulta con el campo vacio y sin rol elegido: listarUsuarios()
 * sin `busqueda` ni `limite` devuelve TODO el personal activo de la organizacion (usuarios/api.js,
 * ver su doc), asi que este hook siempre manda `limite` y solo busca cuando hay texto o un rol
 * elegido -- abrir el modal no debe traer de golpe a todo el personal.
 *
 * @param {object} opciones
 * @param {string} opciones.jornadaId
 * @param {string} [opciones.jornadaFecha] Fecha AAAA-MM-DD de la jornada.
 * @param {object[]} [opciones.personal] jornada.personal ya cargado (useDetalleJornada()).
 * @returns {object} Ver el return al final de la funcion para la forma completa.
 */
export function useAsignacionPersonal({ jornadaId, jornadaFecha, personal } = {}) {
  const [busqueda, setBusqueda] = useState("");
  const [rolFiltro, setRolFiltro] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [resultadosTruncados, setResultadosTruncados] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState(null);

  const [personaElegida, setPersonaElegida] = useState(null);
  const [valores, setValores] = useState(VALORES_VACIOS);
  const [errores, setErrores] = useState({});

  const [verificandoChoque, setVerificandoChoque] = useState(false);
  const [advertenciaChoque, setAdvertenciaChoque] = useState(null);
  const [errorVerificacionChoque, setErrorVerificacionChoque] = useState(null);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [advertenciasGuardado, setAdvertenciasGuardado] = useState([]);

  useEffect(() => {
    const textoLimpio = busqueda.trim();
    if (textoLimpio === "" && !rolFiltro) {
      setResultados([]);
      setResultadosTruncados(false);
      setErrorBusqueda(null);
      setBuscando(false);
      return undefined;
    }

    let vigente = true;
    setBuscando(true);

    listarUsuarios({
      busqueda: textoLimpio,
      rol: rolFiltro || undefined,
      estado: true,
      limite: calcularLimiteDeBusqueda(personal),
    }).then(({ usuarios, error: errorDeBusqueda }) => {
      if (!vigente) return;
      setBuscando(false);

      if (errorDeBusqueda) {
        setResultados([]);
        setResultadosTruncados(false);
        setErrorBusqueda(errorDeBusqueda);
        return;
      }

      setErrorBusqueda(null);
      const { resultados: filas, truncado } = armarResultadosDeBusqueda(usuarios, personal);
      setResultados(filas);
      setResultadosTruncados(truncado);
    });

    return () => {
      vigente = false;
    };
  }, [busqueda, rolFiltro, personal]);

  /** Comprueba el choque de horario del criterio 3 apenas se elige a alguien, antes de guardar. */
  const verificarChoque = useCallback(
    async (perfilId) => {
      setAdvertenciaChoque(null);
      setErrorVerificacionChoque(null);

      if (!jornadaFecha) return;

      setVerificandoChoque(true);
      const { asignaciones, error: errorDeConsulta } = await obtenerAsignacionesDelDia(
        jornadaFecha,
        { excluirJornada: jornadaId },
      );
      setVerificandoChoque(false);

      // Un fallo aca NO significa "no hay choque": significa que no se pudo comprobar. Las dos
      // cosas se muestran distinto (ver ModalAsignarPersonal.jsx) para no afirmar una garantia
      // que esta consulta no pudo confirmar.
      if (errorDeConsulta) {
        setErrorVerificacionChoque(errorDeConsulta);
        return;
      }

      setAdvertenciaChoque(
        advertirChoqueDeHorario({ perfil: perfilId, jornadaActualId: jornadaId, asignacionesDelDia: asignaciones }),
      );
    },
    [jornadaFecha, jornadaId],
  );

  const elegirPersona = useCallback(
    (persona) => {
      setPersonaElegida(persona);
      setValores({ ...VALORES_VACIOS, perfil: persona.id });
      setErrores({});
      setError(null);
      setAdvertenciasGuardado([]);
      verificarChoque(persona.id);
    },
    [verificarChoque],
  );

  const volverABuscar = useCallback(() => {
    setPersonaElegida(null);
    setValores(VALORES_VACIOS);
    setErrores({});
    setError(null);
    setAdvertenciaChoque(null);
    setErrorVerificacionChoque(null);
    setAdvertenciasGuardado([]);
  }, []);

  const setCampo = useCallback((id, valor) => {
    setValores((anteriores) => ({ ...anteriores, [id]: valor }));
    setErrores((anteriores) => {
      if (!(id in anteriores)) return anteriores;
      return Object.fromEntries(Object.entries(anteriores).filter(([clave]) => clave !== id));
    });
  }, []);

  const asignar = useCallback(async () => {
    const erroresDeValidacion = validarAsignacionPersonal(valores);
    if (Object.keys(erroresDeValidacion).length > 0) {
      setErrores(erroresDeValidacion);
      return { ok: false };
    }

    setEnviando(true);
    setError(null);
    const resultado = await asignarPersonal(jornadaId, valores);
    setEnviando(false);

    if (resultado.error) {
      setError({ ...resultado.error, mensaje: mensajeDeErrorDeAsignacion(resultado.error) });
      return { ok: false };
    }

    // La asignacion ya se guardo: lo que devuelve asignarPersonal() en `advertencias` es
    // informativo, no una confirmacion que se pueda cancelar (api.js la calcula DESPUES del
    // INSERT). Un arreglo vacio tampoco es "confirmado sin choque": si esa segunda consulta
    // fallo del lado del servidor, asignarPersonal() responde igual sin advertencias (ver su
    // doc en api.js) -- por eso esto no se muestra como un aviso positivo de "todo bien".
    setAdvertenciasGuardado(resultado.advertencias ?? []);
    return { ok: true, advertencias: resultado.advertencias ?? [] };
  }, [jornadaId, valores]);

  const reiniciar = useCallback(() => {
    setBusqueda("");
    setRolFiltro(null);
    setResultados([]);
    setResultadosTruncados(false);
    setErrorBusqueda(null);
    volverABuscar();
  }, [volverABuscar]);

  return {
    busqueda,
    setBusqueda,
    rolFiltro,
    setRolFiltro,
    buscando,
    resultados,
    resultadosTruncados,
    errorBusqueda,
    personaElegida,
    elegirPersona,
    volverABuscar,
    valores,
    errores,
    setCampo,
    verificandoChoque,
    advertenciaChoque,
    errorVerificacionChoque,
    enviando,
    error,
    advertenciasGuardado,
    asignar,
    reiniciar,
  };
}

/**
 * Estado y envio de la confirmacion de desasignar a alguien de una jornada (issue #182, criterio 4).
 *
 * No hay ningun chequeo de cliente antes de confirmar (a diferencia de
 * useDesactivacionUsuario.js, que si puede saber de antemano "sos vos mismo"): no existe una
 * funcion en lote para saber quien ya registro atenciones (personal_registro_atenciones(), 00044,
 * es de a una persona a la vez), asi que el boton de desasignar queda siempre activo y el unico
 * chequeo real ocurre dentro de desasignarPersonal() al confirmar. Si el servidor lo bloquea,
 * devuelve el mismo error 'check' de la API tal cual, sin reescribirlo.
 *
 * @param {{ jornadaId: string }} opciones
 * @returns {{ persona: object|null, enviando: boolean, error: object|null,
 *   abrir: (persona: object) => void, cerrar: () => void,
 *   confirmar: () => Promise<{ ok: boolean }> }}
 */
export function useDesasignacionPersonal({ jornadaId } = {}) {
  const [persona, setPersona] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const abrir = useCallback((personaObjetivo) => {
    setPersona(personaObjetivo ?? null);
    setError(null);
    setEnviando(false);
  }, []);

  const cerrar = useCallback(() => {
    setPersona(null);
    setError(null);
    setEnviando(false);
  }, []);

  const confirmar = useCallback(async () => {
    const perfilId = persona?.perfilId ?? persona?.id;
    if (!perfilId) return { ok: false };

    setEnviando(true);
    setError(null);
    const { desasignado, error: errorDeDesasignacion } = await desasignarPersonal(jornadaId, perfilId);
    setEnviando(false);

    if (errorDeDesasignacion || !desasignado) {
      setError(errorDeDesasignacion);
      return { ok: false };
    }

    return { ok: true };
  }, [jornadaId, persona]);

  return { persona, enviando, error, abrir, cerrar, confirmar };
}
