// View model de "en que jornada estoy trabajando ahora" (issue #177).
//
// Es la pieza central del flujo movil: casi todas las pantallas de campo (registro, triaje,
// consulta, entrega) necesitan saber en que jornada esta la persona y quien sigue en la cola,
// sin volver a resolverlo cada vez.
//
// No abre una segunda suscripcion de sesion: recibe `perfilId` por parametro, igual que
// usuarios/usePerfilPropio.js recibe usuario/perfil/refrescarPerfil en vez de llamar a
// useSesion() por su cuenta.
//
// La seleccion se persiste con el mismo contrato de almacenamiento que ya usa
// inicializarSupabase() para la sesion (api/almacenamiento.js): shared no puede tocar
// localStorage ni AsyncStorage, asi que cada app entrega su propio adaptador
// (almacenamientoWeb/almacenamientoMovil). Sin uno, cae a crearAlmacenamientoEnMemoria() -la
// seleccion no sobrevive un reinicio, pero nada se rompe. La clave incluye el perfilId: un
// dispositivo de campo puede pasar de mano en mano entre voluntarios en el mismo turno, y la
// seleccion de una persona no debe filtrarse a la sesion de otra.

import { useCallback, useEffect, useRef, useState } from "react";

import { crearAlmacenamientoEnMemoria, validarAlmacenamiento } from "../api/almacenamiento.js";
import { obtenerJornadasDePersona, puedeRegistrarConsulta } from "./api.js";
import { ESTADOS_JORNADA } from "./permisos.js";
import { obtenerCola } from "../atenciones/api.js";
import { ORDEN_DE_ETAPAS } from "../atenciones/etapas.js";

/** Cola vacia con las cuatro etapas siempre presentes, igual que obtenerCola(). */
function colaVacia() {
  return Object.fromEntries(ORDEN_DE_ETAPAS.map((etapa) => [etapa, []]));
}

/** Clave de almacenamiento de la jornada elegida por esta persona. */
export function claveDeAlmacenamiento(perfilId) {
  return `jornada_activa:${perfilId}`;
}

/** Subconjunto de jornadas asignadas que estan en curso ahora mismo. */
export function filtrarJornadasEnCurso(jornadas = []) {
  return jornadas.filter((jornada) => jornada.estado === ESTADOS_JORNADA.EN_CURSO);
}

/**
 * Decide que jornada seleccionar al cargar, entre las que estan en curso.
 *
 * El id persistido gana si sigue siendo una candidata valida (la persona no dejo de estar en
 * curso en ella entre una sesion y la siguiente). Si no hay uno persistido que sirva y hay
 * exactamente una candidata, se elige esa sola. Con cero candidatas o con varias sin id
 * persistido que las distinga, se devuelve null: es el criterio 2, la pantalla tiene que
 * ofrecer la lista para que la persona elija.
 *
 * @param {object[]} jornadasEnCurso
 * @param {string|null} idPersistido
 * @returns {string|null}
 */
export function elegirJornadaInicial(jornadasEnCurso, idPersistido) {
  if (idPersistido && jornadasEnCurso.some((jornada) => jornada.id === idPersistido)) {
    return idPersistido;
  }

  if (jornadasEnCurso.length === 1) return jornadasEnCurso[0].id;

  return null;
}

const ESTADO_INICIAL = {
  jornadasAsignadas: [],
  jornadaId: null,
  cola: colaVacia(),
  totalEnCola: 0,
  puedeRegistrar: false,
  motivoBloqueo: null,
  cargando: true,
  cargandoCola: false,
  error: null,
};

/**
 * Jornada en la que trabaja la persona ahora mismo, y su cola de pacientes por etapa.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.perfilId] Perfil de quien consulta.
 * @param {import("../api/almacenamiento.js").AdaptadorDeAlmacenamiento} [opciones.almacenamiento]
 *   Adaptador de la app (almacenamientoWeb/almacenamientoMovil). Sin uno, la seleccion no
 *   sobrevive un reinicio.
 * @returns {{
 *   jornadasEnCurso: object[],
 *   jornadaId: string|null,
 *   jornada: object|null,
 *   cola: Record<string, object[]>,
 *   totalEnCola: number,
 *   puedeRegistrar: boolean,
 *   motivoBloqueo: string|null,
 *   cargando: boolean,
 *   cargandoCola: boolean,
 *   error: object|null,
 *   seleccionarJornada: (id: string) => Promise<void>,
 *   recargar: () => Promise<void>,
 * }}
 */
export function useJornadaActiva({ perfilId, almacenamiento } = {}) {
  const [estado, setEstado] = useState(ESTADO_INICIAL);

  const activo = useRef(true);
  // Cada carga se numera: si perfilId cambia o se llama recargar()/seleccionarJornada() varias
  // veces seguidas, una respuesta vieja que llega tarde no debe pisar a una mas nueva. Mismo
  // mecanismo que hooks/useSesion.js.
  const turno = useRef(0);

  const almacen = useRef(null);
  if (almacen.current === null) {
    almacen.current = almacenamiento ? validarAlmacenamiento(almacenamiento) : crearAlmacenamientoEnMemoria();
  }

  /** Trae la cola y la vigencia de la jornada seleccionada. No toca jornadasAsignadas. */
  const cargarSeleccion = useCallback(async (jornadaId, miTurno) => {
    if (!jornadaId) {
      if (activo.current && miTurno === turno.current) {
        setEstado((anterior) => ({
          ...anterior,
          jornadaId: null,
          cola: colaVacia(),
          totalEnCola: 0,
          puedeRegistrar: false,
          motivoBloqueo: null,
          cargandoCola: false,
        }));
      }
      return;
    }

    if (activo.current && miTurno === turno.current) {
      setEstado((anterior) => ({ ...anterior, cargandoCola: true }));
    }

    const [respuestaCola, respuestaPermiso] = await Promise.all([
      obtenerCola(jornadaId),
      puedeRegistrarConsulta(jornadaId),
    ]);

    if (!activo.current || miTurno !== turno.current) return;

    setEstado((anterior) => ({
      ...anterior,
      jornadaId,
      cola: respuestaCola.cola,
      totalEnCola: respuestaCola.total,
      puedeRegistrar: respuestaPermiso.puede,
      motivoBloqueo: respuestaPermiso.puede ? null : respuestaPermiso.motivo,
      cargandoCola: false,
      error: respuestaCola.error ?? respuestaPermiso.error ?? anterior.error,
    }));
  }, []);

  /** Carga completa: jornadas asignadas, eleccion inicial (o la que ya estaba elegida), y cola. */
  const cargarTodo = useCallback(
    async (seleccionAnterior) => {
      const miTurno = (turno.current += 1);

      if (activo.current) {
        setEstado((anterior) => ({ ...anterior, cargando: true, error: null }));
      }

      const { jornadas, error } = await obtenerJornadasDePersona(perfilId);
      if (!activo.current || miTurno !== turno.current) return;

      const jornadasEnCurso = filtrarJornadasEnCurso(jornadas);

      // Mantener la seleccion vigente si la persona sigue asignada a esa jornada, aunque ya
      // no siga en curso: es como se refleja un cambio de estado (criterio 5), sin que la
      // pantalla pierda de vista cual era. Si no hay una seleccion previa, se elige entre las
      // candidatas en curso, con lo persistido como preferencia.
      let jornadaId = seleccionAnterior;
      if (!jornadaId || !jornadas.some((jornada) => jornada.id === jornadaId)) {
        const idPersistido = await almacen.current.getItem(claveDeAlmacenamiento(perfilId));
        jornadaId = elegirJornadaInicial(jornadasEnCurso, idPersistido);
      }

      if (!activo.current || miTurno !== turno.current) return;

      setEstado((anterior) => ({
        ...anterior,
        jornadasAsignadas: jornadas,
        cargando: false,
        error: error ?? null,
      }));

      await cargarSeleccion(jornadaId, miTurno);
    },
    [perfilId, cargarSeleccion],
  );

  useEffect(() => {
    activo.current = true;
    cargarTodo(null);
    return () => {
      activo.current = false;
    };
  }, [cargarTodo]);

  const seleccionarJornada = useCallback(
    async (jornadaId) => {
      const miTurno = (turno.current += 1);
      await almacen.current.setItem(claveDeAlmacenamiento(perfilId), jornadaId);
      await cargarSeleccion(jornadaId, miTurno);
    },
    [perfilId, cargarSeleccion],
  );

  const recargar = useCallback(() => cargarTodo(estado.jornadaId), [cargarTodo, estado.jornadaId]);

  const jornadasEnCurso = filtrarJornadasEnCurso(estado.jornadasAsignadas);
  const jornada = estado.jornadasAsignadas.find((j) => j.id === estado.jornadaId) ?? null;

  return {
    jornadasEnCurso,
    jornadaId: estado.jornadaId,
    jornada,
    cola: estado.cola,
    totalEnCola: estado.totalEnCola,
    puedeRegistrar: estado.puedeRegistrar,
    motivoBloqueo: estado.motivoBloqueo,
    cargando: estado.cargando,
    cargandoCola: estado.cargandoCola,
    error: estado.error,
    seleccionarJornada,
    recargar,
  };
}
