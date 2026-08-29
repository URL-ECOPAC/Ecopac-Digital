// View model de la ficha de un paciente (issue #123): sus datos, expediente y condiciones
// cronicas (ya vienen embebidos en obtenerPaciente(), api.js) mas su ultima atencion
// (obtenerUltimaAtencion(), historial.api.js), con cargando/error/recargar.
//
// No hay cache modulo a modulo aparte del estado del hook: la pantalla que lo consume (#125 web,
// #135 movil) lo monta una sola vez y le pasa `paciente` a sus pestañas como props, asi que
// cambiar de pestaña no repite la consulta -- mismo criterio que useDetalleJornada.js
// (packages/shared/jornadas/) resuelve para la pantalla de detalle de jornada. Invalidar el
// cache tras editar el paciente es responsabilidad de quien llama recargar() despues de que
// actualizarPaciente() (api.js) tenga exito, igual que aplicarCambioDeEstado() en
// useDetalleJornada.js o refrescarPerfil() en usuarios/usePerfilPropio.js.
//
// La ultima atencion no se pide si el rol no la va a poder ver: mismo chequeo que hace por su
// cuenta obtenerUltimaAtencion() (puedeVerHistorial, RLS 00033), repetido aqui para no disparar
// una llamada que ya se sabe que va a volver vacia.

import { useCallback, useEffect, useState } from "react";

import { obtenerPaciente } from "./api.js";
import { obtenerUltimaAtencion } from "./historial.api.js";
import { puedeVerHistorial } from "./permisos.js";

const ESTADO_INICIAL = { paciente: null, cargando: true, error: null };

/**
 * Combina la respuesta de obtenerPaciente() con la de obtenerUltimaAtencion() en el objeto que
 * expone el hook. Separada de usePaciente() para poder probarla sin montar el hook (packages/
 * shared corre vitest sin DOM, ver usePacientesListado.test.js).
 *
 * @param {{ paciente: object|null, error: object|null }} respuestaPaciente
 * @param {{ ultimaAtencion: object|null, error: object|null }} respuestaUltimaAtencion
 * @returns {{ paciente: object|null, error: object|null }}
 */
export function combinarPaciente(respuestaPaciente, respuestaUltimaAtencion) {
  if (!respuestaPaciente.paciente) {
    return { paciente: null, error: respuestaPaciente.error };
  }

  return {
    paciente: {
      ...respuestaPaciente.paciente,
      ultimaAtencion: respuestaUltimaAtencion.ultimaAtencion,
    },
    error: respuestaPaciente.error,
  };
}

/**
 * View model de la ficha de un paciente.
 *
 * @param {string} id UUID del paciente.
 * @param {object} [opciones]
 * @param {string} [opciones.rol] Rol de la sesion actual, para decidir si pide la ultima
 *   atencion.
 * @returns {{
 *   paciente: object|null,
 *   cargando: boolean,
 *   error: object|null,
 *   recargar: () => Promise<void>,
 * }}
 */
export function usePaciente(id, { rol } = {}) {
  const [estado, setEstado] = useState(ESTADO_INICIAL);
  const puedeVerUltimaAtencion = puedeVerHistorial(rol);

  const cargar = useCallback(async () => {
    if (!id) {
      setEstado({ paciente: null, cargando: false, error: null });
      return;
    }

    setEstado((anterior) => ({ ...anterior, cargando: true, error: null }));

    const [respuestaPaciente, respuestaUltimaAtencion] = await Promise.all([
      obtenerPaciente(id),
      puedeVerUltimaAtencion
        ? obtenerUltimaAtencion(id, { rol })
        : Promise.resolve({ ultimaAtencion: null, error: null }),
    ]);

    const { paciente, error } = combinarPaciente(respuestaPaciente, respuestaUltimaAtencion);
    setEstado({ paciente, cargando: false, error });
  }, [id, rol, puedeVerUltimaAtencion]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return {
    paciente: estado.paciente,
    cargando: estado.cargando,
    error: estado.error,
    recargar: cargar,
  };
}
