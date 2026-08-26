

import { useCallback, useEffect, useRef } from "react";


export const MINUTOS_INACTIVIDAD_POR_DEFECTO = 30;

const MS_POR_MINUTO = 60 * 1000;

// Cada cuanto se revisa si ya paso el limite. No hace falta que coincida con `minutos`: solo
// acota el margen de error entre que se cumple el limite y que se detecta.
const INTERVALO_DE_REVISION_MS = 15 * 1000;

/**
 * Calcula si ya paso el limite de inactividad, sin tocar el reloj real: recibe "ahora" como
 * parametro para que la funcion sea pura y se pueda probar sin temporizadores de verdad.
 *
 * @param {number} ultimaActividad Marca de tiempo (ms, `Date.now()`) de la ultima actividad.
 * @param {number} ahora Marca de tiempo (ms) contra la que se compara.
 * @param {number} minutos Limite de inactividad, en minutos.
 * @returns {boolean}
 */
export function haVencidoPorInactividad(ultimaActividad, ahora, minutos) {
  return ahora - ultimaActividad >= minutos * MS_POR_MINUTO;
}

/**
 * Llama a `alVencer()` una sola vez si pasan `minutos` sin que se llame a
 * `registrarActividad()`.
 *
 * @param {object} [opciones]
 * @param {number} [opciones.minutos] Limite de inactividad. Por defecto
 *   MINUTOS_INACTIVIDAD_POR_DEFECTO.
 * @param {boolean} [opciones.activo] Si el temporizador debe correr. En `false` lo pausa sin
 *   desmontar el hook (por ejemplo, mientras todavia no hay sesion).
 * @param {() => void} [opciones.alVencer] Se llama una sola vez al detectar inactividad. Se lee
 *   siempre en su version mas reciente (por ref), asi que no hace falta memoizarla para que el
 *   temporizador no se reinicie en cada render.
 * @returns {{ registrarActividad: () => void }}
 */
export function useExpiracionPorInactividad({
  minutos = MINUTOS_INACTIVIDAD_POR_DEFECTO,
  activo = true,
  alVencer,
} = {}) {
  const ultimaActividad = useRef(Date.now());
  const yaVencio = useRef(false);
  const alVencerRef = useRef(alVencer);

  useEffect(() => {
    alVencerRef.current = alVencer;
  }, [alVencer]);

  const registrarActividad = useCallback(() => {
    ultimaActividad.current = Date.now();
    yaVencio.current = false;
  }, []);

  useEffect(() => {
    if (!activo) return undefined;

    registrarActividad();

    const idDelIntervalo = setInterval(() => {
      if (yaVencio.current) return;
      if (haVencidoPorInactividad(ultimaActividad.current, Date.now(), minutos)) {
        yaVencio.current = true;
        alVencerRef.current?.();
      }
    }, INTERVALO_DE_REVISION_MS);

    return () => clearInterval(idDelIntervalo);
  }, [activo, minutos, registrarActividad]);

  return { registrarActividad };
}
