// View model de la pantalla de inicio (issue #710).
//
// `/` es la ruta a la que cae todo el mundo despues de iniciar sesion, y hasta esta issue era un
// marcador de "pendiente" que citaba la #209, ya cerrada. Lo que muestra ahora se decide por rol:
// los accesos directos salen de modulosVisibles(), la misma funcion que dibuja el sidebar, para
// que un modulo nuevo aparezca aqui sin tocar esta pantalla.
//
// POR QUE NO REUTILIZA EL DASHBOARD DE METRICAS. `/reportes/dashboard` solo lo pueden ver
// administrador y los dos roles consultivos (MODULOS.reportes en navegacion.js). Medico y
// voluntario -que son la mayoria de las cuentas y las que mas entran- caerian en "acceso
// denegado" nada mas iniciar sesion. El inicio tiene que servirle a los cinco roles.
//
// LA JORNADA EN CURSO ES LO PRIMERO. Para un medico o un voluntario, entrar a la web durante una
// jornada y no ver por ningun lado la jornada en la que esta trabajando es el caso que mas duele.
// Se consulta solo si el rol puede ver jornadas; si no, no se dispara la consulta.

import { useCallback, useEffect, useMemo, useState } from "react";

import { ESTADOS_JORNADA } from "../enums.js";
import { listarJornadas } from "../jornadas/api.js";
import { puedeVerJornadas } from "../jornadas/permisos.js";
import { modulosVisibles } from "../navegacion.js";

/**
 * Datos de la pantalla de inicio para un rol.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.rol] Rol de quien entra.
 * @param {string} [opciones.plataforma] "web" (por defecto) o "mobile".
 * @returns {{
 *   accesos: object[],
 *   jornadasEnCurso: object[],
 *   puedeVerJornadaEnCurso: boolean,
 *   cargando: boolean,
 *   error: object|null,
 *   recargar: () => Promise<void>,
 * }}
 */
export function usePanelDeInicio({ rol, plataforma = "web" } = {}) {
  const puedeConsultarJornadas = puedeVerJornadas(rol);

  const [jornadasEnCurso, setJornadasEnCurso] = useState([]);
  const [cargando, setCargando] = useState(puedeConsultarJornadas);
  const [error, setError] = useState(null);

  // El inicio nunca es un acceso directo a si mismo: se excluye de la rejilla.
  const accesos = useMemo(
    () => modulosVisibles(rol, { plataforma }).filter((modulo) => modulo.ruta !== "/"),
    [rol, plataforma],
  );

  const cargar = useCallback(async () => {
    if (!puedeConsultarJornadas) {
      setJornadasEnCurso([]);
      setCargando(false);
      return;
    }

    setCargando(true);

    // Se filtra por estado en la consulta y no en memoria: RLS ya limita las jornadas que el rol
    // ve (00039), y traerse las finalizadas para descartarlas aqui seria trabajo de mas.
    const { jornadas, error: fallo } = await listarJornadas({
      estado: ESTADOS_JORNADA.EN_CURSO,
    });

    if (fallo) {
      setError(fallo);
      setJornadasEnCurso([]);
    } else {
      setError(null);
      setJornadasEnCurso(jornadas ?? []);
    }

    setCargando(false);
  }, [puedeConsultarJornadas]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return {
    accesos,
    jornadasEnCurso,
    puedeVerJornadaEnCurso: puedeConsultarJornadas,
    cargando,
    error,
    recargar: cargar,
  };
}
