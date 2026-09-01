// View model de los contadores del panel de la jornada en curso (issue #187, criterio 5).
//
// No vuelve a llamar useJornadaActiva(): la cola, jornadaId y jornada ya llegan del contexto
// compartido (apps/mobile/src/contexto/JornadaActivaProvider.js), mismo motivo que
// useSeleccionJornada.js. Este hook solo agrega lo que useJornadaActiva() no trae: los
// contadores del dia.

import { useCallback, useEffect, useState } from "react";

import { cerrarAtencion, contarPacientesDeJornada } from "../atenciones/api.js";
import { puedeCerrarAtencion } from "../atenciones/permisos.js";
import { contarConsultasDeJornada } from "../pacientes/consultas.api.js";
import { contarRecetasDeJornada } from "../pacientes/recetas.api.js";

const ESTADO_INICIAL = {
  pacientesRegistrados: 0,
  consultasRealizadas: null,
  tratamientosEntregados: null,
  cargando: true,
  error: null,
};

/**
 * Contadores del panel de #187, mas si el rol puede cerrar atenciones (accion de "entrega").
 *
 * `pacientesRegistrados` sale de contarPacientesDeJornada() (atenciones/api.js): un numero real
 * para administrador, medico y voluntario por igual, porque la politica de SELECT de atenciones
 * (00033) no filtra por quien registro la fila. `consultasRealizadas` y `tratamientosEntregados`
 * salen de contarConsultasDeJornada()/contarRecetasDeJornada() (pacientes/consultas.api.js,
 * pacientes/recetas.api.js): conteos directos sobre esas tablas, no sobre vista_reporte_impacto
 * (00064, cerrada a administrador/junta directiva/socio fundador, ninguno de los dos roles que
 * tiene el panel abierto en campo). Igual que con atenciones, la politica de SELECT de consultas
 * y recetas (00033) no filtra por autor: un medico ve todas las consultas/recetas de LA JORNADA,
 * no solo las propias, asi que el numero es real tambien para medico. Solo voluntario general se
 * queda sin estos dos (00033 no le da SELECT sobre consultas ni recetas): para ese rol las dos
 * funciones devuelven `null` y la pantalla pinta un guion, nunca un cero inventado.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.jornadaId]
 * @param {string} [opciones.rol] Rol de quien consulta, para los contadores clinicos y para
 *   `puedeCerrarAtencion`.
 * @returns {{
 *   pacientesRegistrados: number,
 *   consultasRealizadas: number|null,
 *   tratamientosEntregados: number|null,
 *   puedeCerrar: boolean,
 *   cargando: boolean,
 *   error: object|null,
 *   recargar: () => Promise<void>,
 *   cerrar: (atencionId: string, motivo?: string) => Promise<{ ok: boolean, error: object|null }>,
 * }}
 */
export function usePanelJornada({ jornadaId, rol } = {}) {
  const [estado, setEstado] = useState(ESTADO_INICIAL);

  const cargar = useCallback(async () => {
    if (!jornadaId) {
      setEstado(ESTADO_INICIAL);
      return;
    }

    setEstado((anterior) => ({ ...anterior, cargando: true }));

    const [respuestaPacientes, respuestaConsultas, respuestaRecetas] = await Promise.all([
      contarPacientesDeJornada(jornadaId),
      contarConsultasDeJornada(jornadaId, { rol }),
      contarRecetasDeJornada(jornadaId, { rol }),
    ]);

    setEstado({
      pacientesRegistrados: respuestaPacientes.cantidad,
      consultasRealizadas: respuestaConsultas.cantidad,
      tratamientosEntregados: respuestaRecetas.cantidad,
      cargando: false,
      error: respuestaPacientes.error ?? respuestaConsultas.error ?? respuestaRecetas.error ?? null,
    });
  }, [jornadaId, rol]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /**
   * Retira una atencion de la cola (accion de "entrega"/cerrar de los accesos rapidos, criterio
   * 3). Vive aca y no en la pantalla porque apps/mobile no llama a Supabase directamente: la
   * pantalla llama cerrar() y despues recarga la cola desde el contexto (JornadaActivaProvider)
   * y este hook, ninguna de las dos recargas automatica -cerrarAtencion() no dispara la del
   * contexto por su cuenta.
   */
  const cerrar = useCallback(async (atencionId, motivo) => {
    const { atencion, error } = await cerrarAtencion(atencionId, motivo);
    return { ok: atencion !== null, error };
  }, []);

  return {
    pacientesRegistrados: estado.pacientesRegistrados,
    consultasRealizadas: estado.consultasRealizadas,
    tratamientosEntregados: estado.tratamientosEntregados,
    puedeCerrar: puedeCerrarAtencion(rol),
    cargando: estado.cargando,
    error: estado.error,
    recargar: cargar,
    cerrar,
  };
}
