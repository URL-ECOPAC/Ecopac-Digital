// View model del detalle de una jornada (issue #181): sus datos, el personal asignado, los
// pacientes atendidos con su diagnostico principal, el historial de cambios de estado, y el
// mismo cambio de estado que ya usa el tablero (issue #180). Pantalla nueva:
// apps/web/src/pages/DetalleJornadaPage.jsx, montada en la ruta /jornadas/:id (App.jsx).
//
// Las secciones clinicas (pacientes atendidos, historial) no se piden si el rol no va a poder
// verlas: puedeVerHistorial() de pacientes/permisos.js (00033, medico o administrador) y
// puedeVerHistorialJornada() de este modulo (00039:83-85, solo administrador) son el mismo
// chequeo "no dispares una consulta que sabes que RLS va a vaciar" que ya hacen por su cuenta
// obtenerHistorialMedico() (pacientes/historial.api.js) y listarPacientesAtendidosDeJornada()/
// obtenerHistorialDeJornada() de este modulo. Aqui se repite ademas para decidir si la pantalla
// muestra la pestaña: ocultarla es lo que se decidio para este issue, nunca mostrarla vacia (una
// lista vacia visible diria "esto no paso" cuando en realidad es "no tenes permiso para verlo",
// mismo criterio que el guion de pacientesAtendidos en useJornadasKanban.js).
//
// No llama a useSesion() por su cuenta: recibe `rol` de quien lo usa (en la web,
// useSesionCompartida()), mismo motivo que useJornadasKanban()/useJornadaActiva() documentan
// para no abrir una segunda suscripcion a la sesion.
//
// El cambio de estado (criterio 4 de #171) usa cambiarEstadoJornada() de api.js, la misma funcion
// que usa el tablero. Issue #183: `cambiarEstado()` ya NO cubre la transicion en curso ->
// finalizada -- esa transicion la aplica unicamente useResumenCierreJornada.js (pestaña "Cierre"
// de DetalleJornadaPage.jsx), con el resumen completo del dia en vez del aviso aislado de
// atenciones incompletas que este hook mostraba antes (issue #171). DetalleJornadaPage.jsx nunca
// llama a `cambiarEstado(destino)` para ese destino: en su lugar cambia de pestaña (ver PLAN.md
// seccion 3 de #183). `cambiarEstado()` sigue sirviendo para las demas transiciones (arrancar la
// jornada, la reapertura).
//
// Asignar personal (la otra mitad del criterio 4) NO esta aca: es la issue #182, que se monta
// sobre esta misma pantalla (ver el comentario en DetalleJornadaPage.jsx, pestaña Equipo).
// `recargarPersonal()` existe para que #182 no tenga que inventar su propio mecanismo de
// refresco: relee solo jornada_personal (obtenerPersonalDeJornada(), api.js) sin recargar la
// jornada completa ni sus contadores, mismo criterio que refrescarPerfil() en usuarios/.

import { useCallback, useEffect, useState } from "react";

import { listarPacientesAtendidosDeJornada } from "../pacientes/consultas.api.js";
import { puedeVerHistorial as puedeVerDatosClinicos } from "../pacientes/permisos.js";
import {
  cambiarEstadoJornada,
  obtenerHistorialDeJornada,
  obtenerJornada,
  obtenerPersonalDeJornada,
} from "./api.js";
import { permisosDeJornadas, puedeVerHistorialJornada } from "./permisos.js";
import { transicionesDeJornadaDesde } from "./validaciones.js";

const ESTADO_INICIAL = {
  jornada: null,
  historial: [],
  pacientesAtendidos: [],
  cargando: true,
  error: null,
};

/**
 * View model de la pantalla de detalle de una jornada.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.jornadaId] UUID de la jornada (viene de useParams() en la web).
 * @param {string} [opciones.rol] Rol de la sesion actual, para permisos y para pasarselo a
 *   cambiarEstadoJornada().
 * @returns {{
 *   jornada: object|null,
 *   historial: object[],
 *   pacientesAtendidos: object[],
 *   cargando: boolean,
 *   error: object|null,
 *   recargar: () => Promise<void>,
 *   recargarPersonal: () => Promise<void>,
 *   permisos: { puedeVer: boolean, puedeCrear: boolean, puedeEditar: boolean,
 *     puedeReabrir: boolean, puedeVerHistorial: boolean, puedeVerDatosClinicos: boolean },
 *   destinos: string[],
 *   cambiarEstado: (destinoId: string) => Promise<void>,
 *   moviendo: boolean,
 *   errorMovimiento: string|null,
 *   descartarErrorMovimiento: () => void,
 * }}
 */
export function useDetalleJornada({ jornadaId, rol } = {}) {
  const [estado, setEstado] = useState(ESTADO_INICIAL);
  const [errorMovimiento, setErrorMovimiento] = useState(null);
  const [moviendo, setMoviendo] = useState(false);

  const puedeVerHistorialDeEstados = puedeVerHistorialJornada(rol);
  const puedeVerClinico = puedeVerDatosClinicos(rol);

  const cargar = useCallback(async () => {
    setEstado((anterior) => ({ ...anterior, cargando: true, error: null }));

    // Historial y pacientes atendidos no se piden si el rol no los va a poder ver: la
    // pantalla oculta esas pestañas, asi que pedirlas igual solo gastaria una llamada que RLS
    // va a devolver vacia (o que la propia funcion rechaza antes de llamar, ver su doc).
    const [respuestaJornada, respuestaHistorial, respuestaPacientes] = await Promise.all([
      obtenerJornada(jornadaId),
      puedeVerHistorialDeEstados
        ? obtenerHistorialDeJornada(jornadaId, { rol })
        : Promise.resolve({ historial: [], error: null }),
      puedeVerClinico
        ? listarPacientesAtendidosDeJornada(jornadaId, { rol })
        : Promise.resolve({ pacientes: [], error: null }),
    ]);

    // El error de la jornada es el unico que puede dejar la pantalla en blanco (criterio de
    // verificacion B): historial y pacientes atendidos son secciones, no el contenido central,
    // mismo criterio que contarPacientesAtendidosPorJornada() en useJornadasKanban.js -- si
    // fallan, esas pestañas quedan vacias en vez de tumbar toda la pantalla.
    setEstado({
      jornada: respuestaJornada.jornada,
      historial: respuestaHistorial.historial,
      pacientesAtendidos: respuestaPacientes.pacientes,
      cargando: false,
      error: respuestaJornada.error,
    });
  }, [jornadaId, rol, puedeVerHistorialDeEstados, puedeVerClinico]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const recargarPersonal = useCallback(async () => {
    const { personal, error } = await obtenerPersonalDeJornada(jornadaId);
    if (error) return;

    setEstado((anterior) =>
      anterior.jornada ? { ...anterior, jornada: { ...anterior.jornada, personal } } : anterior,
    );
  }, [jornadaId]);

  /**
   * Cambia el estado de la jornada. Issue #183: ya NO cubre en curso -> finalizada -- ese destino
   * lo aplica unicamente useResumenCierreJornada.js (pestaña "Cierre"), y DetalleJornadaPage.jsx
   * nunca llama a esta funcion con ese destino (cambia de pestaña en su lugar, ver el comentario
   * del encabezado de este archivo). Sigue sirviendo para arrancar la jornada y para la
   * reapertura.
   */
  const cambiarEstado = useCallback(
    async (destinoId) => {
      setErrorMovimiento(null);
      setMoviendo(true);
      const { jornada: actualizada, error } = await cambiarEstadoJornada(jornadaId, destinoId, {
        rol,
      });
      setMoviendo(false);

      if (error) {
        setErrorMovimiento(error.mensaje);
        return;
      }

      if (!actualizada) {
        setErrorMovimiento(
          "No se pudo cambiar el estado de esta jornada. Es posible que no tengas permiso, o " +
            "que otra persona ya la haya cambiado; actualiza la pagina e intenta de nuevo.",
        );
        return;
      }

      setErrorMovimiento(null);
      await cargar();
    },
    [jornadaId, rol, cargar],
  );

  const descartarErrorMovimiento = useCallback(() => setErrorMovimiento(null), []);

  const destinos = estado.jornada ? transicionesDeJornadaDesde(estado.jornada.estado) : [];

  return {
    jornada: estado.jornada,
    historial: estado.historial,
    pacientesAtendidos: estado.pacientesAtendidos,
    cargando: estado.cargando,
    error: estado.error,
    recargar: cargar,
    recargarPersonal,
    permisos: {
      ...permisosDeJornadas(rol),
      puedeVerDatosClinicos: puedeVerClinico,
    },
    destinos,
    cambiarEstado,
    moviendo,
    errorMovimiento,
    descartarErrorMovimiento,
  };
}
