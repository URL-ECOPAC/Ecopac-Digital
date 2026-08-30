// View model de la ficha de una persona del equipo: sus datos, sus especialidades y las
// jornadas en las que participo, con cargando/error/recargar. Mismo patron que
// pacientes/usePaciente.js: tres consultas en paralelo, sin cache aparte del propio estado del
// hook, sin JSX y sin tocar ninguna API de plataforma (packages/shared no puede).
//
// No recibe `rol`: a diferencia de usePaciente(id, { rol }) o
// useDetalleJornada({ jornadaId, rol }), que lo usan para decidir que pestañas/consultas pedir
// porque esas pantallas las ve mas de un rol con distinta visibilidad, esta ficha no tiene
// ninguna decision que tomar segun quien mira — no hay ninguna consulta que convenga saltarse
// ni ninguna seccion que ocultar. Quien monta este hook decide, con el rol que si conoce, como
// pintar lo que el hook devuelve.

import { useCallback, useEffect, useState } from "react";

import { obtenerJornadasDePersona } from "../jornadas/api.js";
import { obtenerEspecialidadesDePerfil, obtenerPerfil } from "./api.js";

const ESTADO_INICIAL = {
  perfil: null,
  historial: [],
  cargando: true,
  error: null,
  errorHistorial: null,
};

/**
 * Combina las tres respuestas en el estado que expone el hook.
 *
 * El error del perfil es el unico que deja la ficha entera sin nada que mostrar: sin perfil no
 * hay ficha. El del historial es de una sola seccion — se guarda aparte (`errorHistorial`) para
 * que la pestaña Historial pueda distinguir "todavia no hay jornadas" (arreglo vacio, sin error)
 * de "no se pudo cargar el historial" (arreglo vacio CON error): las dos se ven identicas si se
 * pierde el error por el camino, y la primera es exactamente lo que un historial vacio de
 * verdad tiene que mostrar. Las especialidades, en cambio, no tienen un canal de error propio:
 * si fallan quedan en `[]` dentro de `perfil.especialidades`, mismo criterio que ya sigue
 * usePerfilPropio.js con el mismo dato (una lista vacia de especialidades no se puede distinguir
 * de RLS escondiendolas, y no vale la pena bloquear toda la ficha por un dato secundario del
 * mismo tab).
 *
 * Funcion aparte y exportada para poder probarla sin montar el hook (packages/shared corre
 * vitest con environment "node").
 *
 * @param {{ perfil: object|null, error: object|null }} respuestaPerfil
 * @param {{ especialidades: string[], error: object|null }} respuestaEspecialidades
 * @param {{ jornadas: object[], error: object|null }} respuestaHistorial
 */
export function combinarFichaUsuario(respuestaPerfil, respuestaEspecialidades, respuestaHistorial) {
  if (!respuestaPerfil.perfil) {
    return {
      perfil: null,
      historial: [],
      error: respuestaPerfil.error,
      errorHistorial: null,
    };
  }

  return {
    perfil: {
      ...respuestaPerfil.perfil,
      especialidades: respuestaEspecialidades.especialidades ?? [],
    },
    historial: respuestaHistorial.jornadas,
    error: null,
    errorHistorial: respuestaHistorial.error,
  };
}

/**
 * View model de la ficha de una persona del equipo, compartido por la pantalla web y por su
 * futura contraparte movil.
 *
 * @param {string} perfilId UUID de perfiles.id.
 * @returns {{
 *   perfil: object|null,
 *   historial: object[],
 *   cargando: boolean,
 *   error: object|null,
 *   errorHistorial: object|null,
 *   recargar: () => Promise<void>,
 * }}
 */
export function useFichaUsuario(perfilId) {
  const [estado, setEstado] = useState(ESTADO_INICIAL);

  const cargar = useCallback(async () => {
    if (!perfilId) {
      setEstado({
        perfil: null,
        historial: [],
        cargando: false,
        error: null,
        errorHistorial: null,
      });
      return;
    }

    setEstado((anterior) => ({ ...anterior, cargando: true }));

    const [respuestaPerfil, respuestaEspecialidades, respuestaHistorial] = await Promise.all([
      obtenerPerfil(perfilId),
      obtenerEspecialidadesDePerfil(perfilId),
      obtenerJornadasDePersona(perfilId),
    ]);

    const combinado = combinarFichaUsuario(
      respuestaPerfil,
      respuestaEspecialidades,
      respuestaHistorial,
    );
    setEstado({ ...combinado, cargando: false });
  }, [perfilId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return {
    perfil: estado.perfil,
    historial: estado.historial,
    cargando: estado.cargando,
    error: estado.error,
    errorHistorial: estado.errorHistorial,
    recargar: cargar,
  };
}
