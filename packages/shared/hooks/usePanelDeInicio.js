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
import { modulosVisibles, rolesDelModulo } from "../navegacion.js";

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
  // La jornada en curso se le muestra a quien TIENE el modulo Jornadas, no a cualquier rol que
  // pueda leer una jornada suelta.
  //
  // ISSUE #864. La 00141 le retiro a junta directiva y socio fundador la lectura de `jornadas`,
  // pero puedeVerJornadas() siguio devolviendo true para los cinco roles, asi que el inicio les
  // dibujaba la seccion, disparaba la consulta, RLS la devolvia vacia y acababan leyendo "No hay
  // ninguna jornada en curso ahora mismo" -- que es falso: las hay, pero no son suyas. Decirle a
  // alguien que no existe lo que en realidad no le corresponde ver es peor que no decirle nada.
  //
  // No se toca puedeVerJornadas(), que gobierna el listado y la ficha del modulo: alli lo que ve
  // cada rol lo acota RLS fila por fila, y ese criterio sigue siendo el correcto. Lo que aqui se
  // decide es otra cosa -- si esta pantalla le dedica una seccion al tema.
  const puedeConsultarJornadas = puedeVerJornadas(rol) && rolesDelModulo("jornadas").includes(rol);

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
