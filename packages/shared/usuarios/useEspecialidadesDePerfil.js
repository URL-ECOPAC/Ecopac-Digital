// View model de las especialidades de un perfil.
//
// POR QUE EXISTE
//
// perfil_especialidad (00002) es la tabla que responde "¿de que es especialista este medico?", y
// hasta ahora ninguna pantalla la escribia. El recorrido completo del hueco:
//
//   1. La 00058 (issue #175) le dio politica de SELECT. Solo lectura.
//   2. La 00085 (issue #405) agrego los GRANT y las politicas de INSERT y DELETE. Desde
//      entonces la base ACEPTA la escritura.
//   3. El cliente nunca la uso: usuarios/api.js solo tenia funciones de lectura, y el catalogo
//      de componentes no tenia con que dibujar una lista de etiquetas editable (es literalmente
//      lo que dicen los comentarios de useAltaUsuario.js y useEdicionUsuario.js).
//
// Este hook cierra el 3. El componente que faltaba es MultiSelector, que se agrega a los dos
// catalogos en el mismo cambio.
//
// Se mantiene APARTE de useEdicionUsuario y no dentro: las especialidades no son una columna de
// `perfiles` sino otra tabla, con sus propias politicas y su propia forma de escribirse (borrar
// e insertar, porque su PK es la pareja y no hay UPDATE). Meterlas en actualizarUsuario()
// obligaria a esa funcion a escribir dos tablas y a decidir que hacer si una de las dos falla.

import { useCallback, useEffect, useState } from "react";

import {
  listarCatalogoEspecialidades,
  obtenerEspecialidadesDePerfil,
  sincronizarEspecialidadesDePerfil,
} from "./api.js";
import { puedeGestionarEspecialidades } from "./permisos.js";

/**
 * Especialidades de un perfil, su catalogo de sugerencias y como guardarlas.
 *
 * @param {string} perfilId UUID de perfiles.id.
 * @param {object} [opciones]
 * @param {string} [opciones.rol] Rol de quien mira la pantalla.
 * @param {string} [opciones.idSesionActual] UUID del perfil de la sesion, para saber si el
 *   perfil que se edita es el propio.
 * @returns {{
 *   especialidades: string[],
 *   catalogo: {value: string, label: string}[],
 *   editable: boolean,
 *   hayCambios: boolean,
 *   errores: Record<string, string>,
 *   error: object|null,
 *   cargando: boolean,
 *   enviando: boolean,
 *   setEspecialidades: (lista: string[]) => void,
 *   guardar: () => Promise<{ ok: boolean, especialidades?: string[] }>,
 * }}
 */
export function useEspecialidadesDePerfil(perfilId, { rol, idSesionActual } = {}) {
  const [especialidades, setEspecialidades] = useState([]);
  const [iniciales, setIniciales] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);

  const editable = puedeGestionarEspecialidades(rol, {
    esPropioPerfil: Boolean(perfilId) && perfilId === idSesionActual,
  });

  useEffect(() => {
    if (!perfilId) {
      setCargando(false);
      return undefined;
    }

    let vigente = true;
    setCargando(true);

    Promise.all([obtenerEspecialidadesDePerfil(perfilId), listarCatalogoEspecialidades()]).then(
      ([propias, sugerencias]) => {
        if (!vigente) return;

        setEspecialidades(propias.especialidades ?? []);
        setIniciales(propias.especialidades ?? []);
        // El catalogo son las especialidades que YA existen en la base, para sugerir en vez de
        // obligar a reescribir "Pediatria" cada vez. Un fallo al leerlo no es un error de esta
        // pantalla: se puede seguir escribiendo a mano, que es lo que permite `permiteLibre`.
        setCatalogo(sugerencias.especialidades ?? []);
        setError(propias.error ?? null);
        setCargando(false);
      },
    );

    return () => {
      vigente = false;
    };
  }, [perfilId]);

  const guardar = useCallback(async () => {
    if (!editable) return { ok: false };

    setEnviando(true);
    setError(null);

    const resultado = await sincronizarEspecialidadesDePerfil(perfilId, especialidades);

    setEnviando(false);
    setErrores(resultado.errores ?? {});
    setError(resultado.error);

    if (resultado.error || Object.keys(resultado.errores ?? {}).length > 0) return { ok: false };

    setEspecialidades(resultado.especialidades);
    setIniciales(resultado.especialidades);
    return { ok: true, especialidades: resultado.especialidades };
  }, [editable, perfilId, especialidades]);

  // Comparacion por contenido y no por referencia: la lista se reemplaza entera en cada cambio,
  // asi que `!==` seria siempre verdadero y el boton de guardar nunca se apagaria.
  const hayCambios =
    especialidades.length !== iniciales.length ||
    especialidades.some((nombre, indice) => nombre !== iniciales[indice]);

  return {
    especialidades,
    catalogo,
    editable,
    hayCambios,
    errores,
    error,
    cargando,
    enviando,
    setEspecialidades,
    guardar,
  };
}
