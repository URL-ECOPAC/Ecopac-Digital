import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import {
  MINUTOS_INACTIVIDAD_MOVIL,
  SEGUNDOS_DE_AVISO_POR_DEFECTO,
  haVencidoPorInactividad,
  segundosHastaElCierre,
} from "@ecopac/shared";

import { almacenamientoMovil } from "../almacenamiento";

/** Clave propia de movil. La de la web (CLAVE_ULTIMA_ACTIVIDAD) vive en otro almacenamiento. */
export const CLAVE_ULTIMA_ACTIVIDAD_MOVIL = "ecopac:ultima-actividad-movil";

const MS_POR_SEGUNDO = 1000;
const MS_POR_MINUTO = 60 * MS_POR_SEGUNDO;

/**
 * Cierra la sesion de la app movil tras una hora sin uso (issue #840).
 *
 * POR QUE NO SE REUSA useExpiracionPorInactividad() TAL CUAL
 *
 * Ese hook necesita un almacenamiento SINCRONO para comparar la ultima actividad al montar, y lo
 * dice en su JSDoc: "en movil, donde AsyncStorage no lo es, se omite y el hook funciona como
 * antes". "Como antes" significa solo en memoria, y en un telefono eso no sirve para nada: los
 * temporizadores de JavaScript no corren mientras la app esta en segundo plano, asi que un
 * telefono guardado en una mochila durante tres horas volveria con la sesion abierta y el
 * temporizador intacto. El caso que hay que cubrir es justamente ese.
 *
 * QUE HACE ESTE EN SU LUGAR
 *
 * Usa AppState, que es la senal fiable en movil: al pasar a segundo plano se anota la hora, y al
 * volver se compara. Si el telefono estuvo guardado mas de una hora, la sesion se cierra antes de
 * mostrar nada. Mientras la app esta en primer plano, un temporizador cubre el otro caso -- la
 * pantalla encendida y quieta sobre una mesa.
 *
 * La decision de si vencio no se escribe aqui: es haVencidoPorInactividad(), la misma funcion
 * pura que usa la web, ya probada en packages/shared.
 *
 * Es una capa de interfaz. El control real de expiracion sigue siendo `jwt_expiry` de Supabase
 * Auth (docs/SEGURIDAD.md).
 *
 * @param {object} opciones
 * @param {boolean} opciones.activo Solo con sesion abierta. En false no vigila nada.
 * @param {() => void} opciones.alVencer Se llama una sola vez al vencer.
 * @param {number} [opciones.minutos] Limite, en minutos.
 * @param {number} [opciones.segundosDeAviso] Cuanto antes del cierre se avisa.
 * @returns {{ registrarActividad: () => void, seguirConectado: () => void,
 *   avisoVisible: boolean, venceEn: number|null }} `venceEn` es la hora (ms) del cierre mientras
 *   el aviso esta a la vista. Se devuelve la hora y no los segundos que faltan a proposito: los
 *   segundos cambian cada segundo, y este estado vive en el proveedor de sesion, cuyo valor
 *   re-renderiza la app entera. La cuenta regresiva la lleva el propio aviso.
 */
export function useInactividadMovil({
  activo,
  alVencer,
  minutos = MINUTOS_INACTIVIDAD_MOVIL,
  segundosDeAviso = SEGUNDOS_DE_AVISO_POR_DEFECTO,
}) {
  const ultimaActividad = useRef(Date.now());
  const yaVencio = useRef(false);
  // Por ref para que cambiar la funcion no reinicie el temporizador ni la suscripcion.
  const alVencerRef = useRef(alVencer);
  const [venceEn, setVenceEn] = useState(null);

  useEffect(() => {
    alVencerRef.current = alVencer;
  }, [alVencer]);

  const vencer = useCallback(() => {
    if (yaVencio.current) return;
    yaVencio.current = true;
    setVenceEn(null);
    alVencerRef.current?.();
  }, []);

  /** Reinicia la cuenta. La llama la navegacion en cada cambio de pantalla. */
  const registrarActividad = useCallback(() => {
    ultimaActividad.current = Date.now();
    yaVencio.current = false;
    setVenceEn(null);
  }, []);

  useEffect(() => {
    if (!activo) {
      // Sin sesion no hay nada que vencer, y al volver a entrar la cuenta empieza limpia.
      registrarActividad();
      return undefined;
    }

    // Caso 1: la app queda en primer plano, encendida y quieta. En el ultimo minuto se avisa con
    // la opcion de seguir conectado, igual que en la web: un cierre sin aviso a media captura es
    // lo que la issue pide evitar. Revisar cada segundo es una resta; el estado solo cambia al
    // entrar y al salir del aviso (React descarta un setVenceEn con el mismo valor).
    const temporizador = setInterval(() => {
      const ahora = Date.now();
      if (haVencidoPorInactividad(ultimaActividad.current, ahora, minutos)) {
        vencer();
        return;
      }
      const restantes = segundosHastaElCierre(ultimaActividad.current, ahora, minutos);
      setVenceEn(
        restantes <= segundosDeAviso ? ultimaActividad.current + minutos * MS_POR_MINUTO : null,
      );
    }, MS_POR_SEGUNDO);

    // Caso 2: la app se va a segundo plano y vuelve mas tarde. El unico dato que sobrevive es el
    // que se guarda aqui: al volver, el temporizador de arriba no corrio ni una vez.
    const suscripcion = AppState.addEventListener("change", (estado) => {
      if (estado === "active") {
        almacenamientoMovil
          .getItem(CLAVE_ULTIMA_ACTIVIDAD_MOVIL)
          .then((guardada) => {
            const marca = Number(guardada);
            // Una marca ilegible o del futuro (reloj movido a mano) no cierra la sesion: ante un
            // dato malo se prefiere no interrumpir a quien esta trabajando.
            if (!Number.isFinite(marca) || marca <= 0 || marca > Date.now()) {
              registrarActividad();
              return;
            }
            if (haVencidoPorInactividad(marca, Date.now(), minutos)) vencer();
            else ultimaActividad.current = marca;
          })
          .catch(() => {
            // Si el almacenamiento falla se sigue con la cuenta en memoria, que es lo que habia
            // antes de esta issue. Un fallo de lectura no puede sacar a nadie de la sesion.
          });
        return;
      }

      // "background" en Android, y tambien "inactive" en iOS, que es el estado intermedio al
      // bajar el centro de control o al cambiar de app.
      almacenamientoMovil.setItem(CLAVE_ULTIMA_ACTIVIDAD_MOVIL, String(ultimaActividad.current));
    });

    return () => {
      clearInterval(temporizador);
      suscripcion.remove();
    };
  }, [activo, minutos, segundosDeAviso, vencer, registrarActividad]);

  return {
    registrarActividad,
    // "Seguir conectado" es exactamente una actividad: reinicia la cuenta y esconde el aviso.
    seguirConectado: registrarActividad,
    avisoVisible: venceEn !== null,
    venceEn,
  };
}
