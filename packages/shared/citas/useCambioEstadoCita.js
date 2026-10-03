// Cambio de estado de una cita (issue #927): Atender, regresar a creada y Cancelar.
//
// Atender pasa la cita a en_atencion y devuelve lo que el formulario de consulta necesita (la
// `cita` de useConsulta: id, jornada, area y el detalle de la etiqueta Agendada). La consulta, al
// guardarse, la deja atendida en la misma transaccion (fn_consulta_de_cita_despues): aqui no se
// toca. Si se cierra el formulario sin guardar, la cita queda en atencion y se puede regresar.

import { useCallback, useState } from "react";

import { cambiarEstadoDeCita } from "./api.js";
import { ESTADOS_CITA } from "./estados.js";
import { formatearFechaHoraDeCita } from "./horas.js";
import {
  edicionDeCita,
  puedeAtenderCita,
  puedeCancelarCita,
  puedeRegresarCitaACreada,
} from "./permisos.js";
import { validarCancelacion } from "./validaciones.js";

/**
 * La cita como la recibe useConsulta / ModalConsulta / ConsultaScreen.
 *
 * @param {object} cita
 * @returns {{ id: string, jornadaId: string, areaId: string, detalle: string }}
 */
export function citaParaConsulta(cita) {
  return {
    id: cita.id,
    jornadaId: cita.jornadaId,
    areaId: cita.areaId,
    detalle: [cita.clinica, formatearFechaHoraDeCita(cita.iniciaEn), cita.profesional]
      .filter(Boolean)
      .join(" · "),
  };
}

/**
 * Que puede hacer el usuario con una cita, para decidir los botones.
 *
 * @param {string} rol
 * @param {object} cita
 * @param {string|null} perfilId
 * @returns {{ atender: boolean, cancelar: boolean, regresar: boolean, editar: boolean }}
 */
export function accionesDeCita(rol, cita, perfilId) {
  const edicion = edicionDeCita(rol, cita);
  return {
    atender: puedeAtenderCita(rol, cita, perfilId),
    cancelar: puedeCancelarCita(rol, cita),
    regresar: puedeRegresarCitaACreada(rol, cita),
    editar: edicion.agenda || edicion.notas,
  };
}

/**
 * @param {{ rol?: string, perfilId?: string|null }} [opciones]
 * @returns {{ atender: Function, regresar: Function, cancelar: Function, acciones: Function,
 *   enviando: boolean, error: object|null, errores: Record<string,string>, limpiarError: Function }}
 */
export function useCambioEstadoCita({ rol, perfilId = null } = {}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [errores, setErrores] = useState({});

  const cambiar = useCallback(async (cita, estado, opciones) => {
    setEnviando(true);
    setError(null);
    const respuesta = await cambiarEstadoDeCita(cita.id, estado, opciones);
    setEnviando(false);
    if (respuesta.error) {
      setError(respuesta.error);
      return { ok: false };
    }
    return { ok: true, cita: respuesta.cita };
  }, []);

  /** Abre la cita: la pasa a en atencion si estaba creada. Devuelve la cita para la consulta. */
  const atender = useCallback(
    async (cita) => {
      if (!puedeAtenderCita(rol, cita, perfilId)) return { ok: false };
      if (cita.estado === ESTADOS_CITA.EN_ATENCION) {
        return { ok: true, cita, paraConsulta: citaParaConsulta(cita) };
      }
      const resultado = await cambiar(cita, ESTADOS_CITA.EN_ATENCION);
      return resultado.ok
        ? { ...resultado, paraConsulta: citaParaConsulta(resultado.cita) }
        : resultado;
    },
    [rol, perfilId, cambiar],
  );

  const regresar = useCallback(
    (cita) =>
      puedeRegresarCitaACreada(rol, cita)
        ? cambiar(cita, ESTADOS_CITA.CREADA)
        : Promise.resolve({ ok: false }),
    [rol, cambiar],
  );

  const cancelar = useCallback(
    async (cita, motivo = "") => {
      if (!puedeCancelarCita(rol, cita)) return { ok: false };
      const erroresDelMotivo = validarCancelacion(motivo);
      setErrores(erroresDelMotivo);
      if (Object.keys(erroresDelMotivo).length > 0) return { ok: false };
      return cambiar(cita, ESTADOS_CITA.CANCELADA, { motivo });
    },
    [rol, cambiar],
  );

  return {
    atender,
    regresar,
    cancelar,
    acciones: (cita) => accionesDeCita(rol, cita, perfilId),
    enviando,
    error,
    errores,
    limpiarError: () => {
      setError(null);
      setErrores({});
    },
  };
}
