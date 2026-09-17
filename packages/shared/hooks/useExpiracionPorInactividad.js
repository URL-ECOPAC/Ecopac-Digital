import { useCallback, useEffect, useRef, useState } from "react";

export const MINUTOS_INACTIVIDAD_POR_DEFECTO = 30;

/** Cuanto antes del cierre se avisa, con una cuenta regresiva y la opcion de seguir conectado. */
export const SEGUNDOS_DE_AVISO_POR_DEFECTO = 60;

/**
 * Clave con la que se guarda la ultima actividad. La lee el hook en cada revision y la borra la
 * pantalla de inicio de sesion, ver `olvidarUltimaActividad`.
 */
export const CLAVE_ULTIMA_ACTIVIDAD = "ecopac:ultima-actividad";

const MS_POR_MINUTO = 60 * 1000;

// Cada cuanto se revisa. Un segundo, y no los 15 de antes, porque ahora hay una cuenta regresiva
// que tiene que moverse de segundo en segundo. La revision es una resta: no cuesta nada.
const INTERVALO_DE_REVISION_MS = 1000;

// Mover el raton dispara decenas de eventos por segundo. La ultima actividad se guarda en el
// almacenamiento como mucho una vez cada cinco segundos: basta para que otra pestana la vea, y un
// error de cinco segundos sobre un limite de treinta minutos no le importa a nadie.
const INTERVALO_MINIMO_DE_ESCRITURA_MS = 5000;

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
 * Segundos que faltan para el cierre, nunca negativos. Pura, por el mismo motivo que la anterior.
 *
 * @param {number} ultimaActividad
 * @param {number} ahora
 * @param {number} minutos
 * @returns {number}
 */
export function segundosHastaElCierre(ultimaActividad, ahora, minutos) {
  const restanteMs = ultimaActividad + minutos * MS_POR_MINUTO - ahora;
  return Math.max(0, Math.ceil(restanteMs / 1000));
}

/**
 * La actividad mas reciente entre la que conoce esta pestana y la guardada. Un valor guardado
 * ilegible -vacio, texto, un numero del futuro por un reloj movido- no cuenta.
 *
 * @param {number} enMemoria
 * @param {string|null|undefined} guardada
 * @param {number} ahora
 * @returns {number}
 */
export function actividadMasReciente(enMemoria, guardada, ahora) {
  const numero = Number(guardada);
  if (!guardada || !Number.isFinite(numero) || numero > ahora) return enMemoria;
  return Math.max(enMemoria, numero);
}

/**
 * Borra la ultima actividad guardada. La llama la pantalla de inicio de sesion: sin esto, quien
 * vuelve a entrar despues de que su sesion vencio en el servidor arrastraria la marca vieja, y el
 * temporizador lo sacaria en cuanto terminara de entrar.
 *
 * @param {{ removeItem: (clave: string) => void }} [almacenamiento]
 */
export function olvidarUltimaActividad(almacenamiento) {
  try {
    almacenamiento?.removeItem(CLAVE_ULTIMA_ACTIVIDAD);
  } catch {
    // Un almacenamiento bloqueado no puede impedir entrar: sin marca guardada, el temporizador
    // arranca de cero, que es exactamente lo que se queria.
  }
}

function leer(almacenamiento) {
  try {
    return almacenamiento?.getItem(CLAVE_ULTIMA_ACTIVIDAD) ?? null;
  } catch {
    return null;
  }
}

function escribir(almacenamiento, valor) {
  try {
    almacenamiento?.setItem(CLAVE_ULTIMA_ACTIVIDAD, String(valor));
  } catch {
    // Sin almacenamiento el cierre sigue funcionando en esta pestana; solo se pierde que sobreviva
    // a recargar la pagina y que lo compartan las demas pestanas.
  }
}

/**
 * Cierra la sesion si pasan `minutos` sin actividad, avisando antes.
 *
 * QUE CAMBIO Y POR QUE. La version anterior ya cerraba la sesion a los 30 minutos, pero en la
 * practica parecia que no existia:
 *
 *   1. Vivia solo en memoria. Cerrar la pestana, o la laptop entera, y volver al dia siguiente
 *      restauraba la sesion de Supabase y el temporizador arrancaba de cero: nadie la veia cerrarse
 *      nunca, que es justamente el caso que tiene que cubrir (una laptop olvidada abierta en una
 *      jornada). Ahora la ultima actividad se guarda en `almacenamiento`, se compara al montar, y
 *      una sesion que lleva mas de `minutos` quieta se cierra en cuanto se abre la pagina.
 *   2. Era silenciosa: la pantalla pasaba a la de inicio de sesion sin decir por que. Ahora avisa
 *      `segundosDeAviso` antes, con cuenta regresiva y la opcion de seguir conectado.
 *   3. Cada pestana llevaba su propia cuenta: trabajar en una dejaba vencer la otra. Al leer la
 *      marca guardada, la actividad en cualquier pestana cuenta para todas.
 *
 * `almacenamiento` es el adaptador de la plataforma (el mismo contrato que usa la sesion,
 * api/almacenamiento.js), por eso este hook no toca `localStorage` y sigue pudiendo vivir aqui.
 * Debe ser sincrono: en movil, donde AsyncStorage no lo es, se omite y el hook funciona como antes.
 *
 * Es una capa de interfaz: el control real de expiracion es `jwt_expiry` de Supabase Auth
 * (docs/SEGURIDAD.md).
 *
 * @param {object} [opciones]
 * @param {number} [opciones.minutos] Limite de inactividad.
 * @param {number} [opciones.segundosDeAviso] Cuanto antes del cierre se avisa. 0 desactiva el aviso.
 * @param {boolean} [opciones.activo] En `false` pausa el temporizador sin desmontar el hook.
 * @param {() => void} [opciones.alVencer] Se llama una sola vez al vencer. Se lee por ref, asi que
 *   no hace falta memoizarla.
 * @param {{ getItem: Function, setItem: Function }} [opciones.almacenamiento]
 * @returns {{
 *   registrarActividad: () => void,
 *   seguirConectado: () => void,
 *   avisoVisible: boolean,
 *   segundosRestantes: number,
 * }}
 */
export function useExpiracionPorInactividad({
  minutos = MINUTOS_INACTIVIDAD_POR_DEFECTO,
  segundosDeAviso = SEGUNDOS_DE_AVISO_POR_DEFECTO,
  activo = true,
  alVencer,
  almacenamiento,
} = {}) {
  const ultimaActividad = useRef(Date.now());
  const ultimaEscritura = useRef(0);
  const yaVencio = useRef(false);
  const avisoVisibleRef = useRef(false);
  const alVencerRef = useRef(alVencer);

  const [avisoVisible, setAvisoVisible] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(minutos * 60);

  useEffect(() => {
    alVencerRef.current = alVencer;
  }, [alVencer]);

  const marcarActividad = useCallback(
    (forzarEscritura) => {
      const ahora = Date.now();
      ultimaActividad.current = ahora;
      yaVencio.current = false;
      if (forzarEscritura || ahora - ultimaEscritura.current >= INTERVALO_MINIMO_DE_ESCRITURA_MS) {
        ultimaEscritura.current = ahora;
        escribir(almacenamiento, ahora);
      }
    },
    [almacenamiento],
  );

  // Actividad pasiva (mover el raton, escribir, desplazar). Mientras el aviso esta a la vista NO
  // cuenta: el aviso pide una respuesta explicita, y un roce del raton no puede apagarlo sin que
  // nadie lo haya leido.
  const registrarActividad = useCallback(() => {
    if (avisoVisibleRef.current) return;
    marcarActividad(false);
  }, [marcarActividad]);

  const seguirConectado = useCallback(() => {
    avisoVisibleRef.current = false;
    setAvisoVisible(false);
    marcarActividad(true);
  }, [marcarActividad]);

  useEffect(() => {
    if (!activo) return undefined;

    const limiteAvisoSegundos = Math.max(0, segundosDeAviso);

    const revisar = () => {
      if (yaVencio.current) return;

      const ahora = Date.now();
      ultimaActividad.current = actividadMasReciente(
        ultimaActividad.current,
        leer(almacenamiento),
        ahora,
      );

      if (haVencidoPorInactividad(ultimaActividad.current, ahora, minutos)) {
        yaVencio.current = true;
        avisoVisibleRef.current = false;
        setAvisoVisible(false);
        alVencerRef.current?.();
        return;
      }

      const restantes = segundosHastaElCierre(ultimaActividad.current, ahora, minutos);
      const mostrarAviso = limiteAvisoSegundos > 0 && restantes <= limiteAvisoSegundos;

      // Si otra pestana registro actividad, el aviso de esta se apaga solo.
      if (mostrarAviso !== avisoVisibleRef.current) {
        avisoVisibleRef.current = mostrarAviso;
        setAvisoVisible(mostrarAviso);
      }
      if (mostrarAviso) setSegundosRestantes(restantes);
    };

    // Al montar, la marca guardada MANDA sobre el "ahora" con que arranco la ref: si no, recargar
    // la pagina contaria como actividad y la cuenta volveria a empezar, que es el fallo de antes.
    // Y se revisa de inmediato, sin esperar al primer intervalo: una sesion restaurada tras horas
    // de inactividad se cierra al abrir la pagina, no un segundo despues con la pantalla pintada.
    // Sin marca (primera entrada, o almacenamiento no disponible) se empieza a contar desde ya.
    const inicio = Date.now();
    const guardada = actividadMasReciente(0, leer(almacenamiento), inicio);
    if (guardada > 0) {
      ultimaActividad.current = guardada;
      yaVencio.current = false;
      revisar();
    } else {
      marcarActividad(true);
    }

    const idDelIntervalo = setInterval(revisar, INTERVALO_DE_REVISION_MS);
    return () => clearInterval(idDelIntervalo);
  }, [activo, minutos, segundosDeAviso, almacenamiento, marcarActividad]);

  return { registrarActividad, seguirConectado, avisoVisible, segundosRestantes };
}
