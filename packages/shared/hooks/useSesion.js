import { useCallback, useEffect, useRef, useState } from "react";

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
import { obtenerPerfil } from "../usuarios/api.js";

const ESTADOS_DE_RESTAURACION = {
  CARGANDO: "cargando",
  LISTO: "listo",
};

const SIN_SESION = {
  usuario: null,
  perfil: null,
  cargando: false,
  error: null,
};

async function cerrarSesionLocal(cliente) {
  try {
    await cliente.auth.signOut({ scope: "local" });
  } catch {
    // Si el cierre reporta un error, el cliente ya no debe conservar estado autenticado.
  } finally {
    cliente.auth.stopAutoRefresh();
  }
}

/**
 * Estado compartido de la sesion: quien es el usuario, cual es su perfil y cual su rol.
 *
 * Supabase obtiene la sesion usando el adaptador que recibio durante su inicializacion. Si el
 * access token vencio, getSession() usa el refresh token para renovarlo antes de devolverlo.
 *
 * El perfil se lee aparte porque la sesion de Supabase solo trae la identidad (id y correo):
 * el nombre y el rol viven en la tabla perfiles, y de ese rol dependen el guard de rutas web
 * y la navegacion movil.
 *
 * No hay ninguna rama por plataforma en este archivo. Lo unico que cambia entre web y movil
 * es el adaptador de almacenamiento, y eso se decidio al construir el cliente.
 *
 * @returns {{
 *   usuario: object|null,
 *   perfil: object|null,
 *   rol: string|null,
 *   cargando: boolean,
 *   error: object|null,
 *   estadoRestauracion: string,
 *   haySesion: boolean,
 *   logout: () => Promise<void>,
 * }}
 */
export function useSesion() {
  const [estadoRestauracion, setEstadoRestauracion] = useState(ESTADOS_DE_RESTAURACION.CARGANDO);
  const [sesion, setSesion] = useState({
    usuario: null,
    perfil: null,
    cargando: true,
    error: null,
  });

  // Cada resolucion de sesion se numera. Si mientras se lee un perfil llega otro evento de
  // Supabase, la lectura vieja termina despues y pisaria al usuario nuevo; comparar el numero
  // al volver descarta esa respuesta tardia.
  const resolucion = useRef(0);
  // logout() y una sesion expirada llegan las dos como SIGNED_OUT. Sin esta marca, cerrar
  // sesion a proposito mostraria el aviso de sesion expirada.
  const cierreIntencional = useRef(false);
  const activo = useRef(true);

  useEffect(() => {
    activo.current = true;
    const cliente = obtenerSupabase();

    /** Deja el estado en "sin sesion", con el aviso que corresponda o sin ninguno. */
    function limpiarSesion(error) {
      resolucion.current += 1;
      cliente.auth.stopAutoRefresh();
      if (!activo.current) return;
      setSesion({ ...SIN_SESION, error: error ?? null });
    }

    /** Guarda al usuario de la sesion y resuelve su perfil. */
    async function aplicarSesion(sesionDeSupabase) {
      const turno = (resolucion.current += 1);
      const usuario = sesionDeSupabase.user;

      cliente.auth.startAutoRefresh();

      if (activo.current) {
        setSesion((anterior) => ({
          usuario,
          // Conservar el perfil cuando es el mismo usuario evita que la pantalla se quede sin
          // nombre ni rol mientras se vuelve a leer.
          perfil: anterior.perfil?.id === usuario.id ? anterior.perfil : null,
          cargando: true,
          error: null,
        }));
      }

      const { perfil, error } = await obtenerPerfil(usuario.id);

      // Llego otro evento mientras se leia: esta respuesta ya no describe la sesion actual.
      if (!activo.current || turno !== resolucion.current) return;

      if (error) {
        // La sesion es valida aunque el perfil no se haya podido leer. Se conserva para que la
        // aplicacion pueda reintentar, en vez de mandar al login a alguien que si tiene sesion.
        setSesion({ usuario, perfil: null, cargando: false, error });
        return;
      }

      if (!perfil) {
        // Hay token pero no hay fila que leer: o el perfil no existe o RLS no lo deja ver.
        // Sin perfil no hay rol, y sin rol no se puede autorizar nada.
        await cerrarSesionLocal(cliente);
        limpiarSesion(construirError(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO));
        return;
      }

      if (perfil.activo === false) {
        // RNF-10: dar de baja a alguien tiene que surtir efecto aunque su token siga vigente.
        await cerrarSesionLocal(cliente);
        limpiarSesion(construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CUENTA_DESACTIVADA));
        return;
      }

      setSesion({ usuario, perfil, cargando: false, error: null });
    }

    /**
     * Restauracion al montar.
     *
     * estadoRestauracion no pasa a LISTO hasta que el perfil tambien esta resuelto: si pasara
     * antes, la aplicacion pintaria un instante sin rol y el guard de rutas mandaria al login
     * a alguien que si tiene sesion. Ese es el parpadeo que hay que evitar.
     */
    async function restaurarSesion() {
      try {
        const { data, error } = await cliente.auth.getSession();
        const sesionDeSupabase = data?.session;

        if (error) {
          await cerrarSesionLocal(cliente);
          limpiarSesion(normalizarError(error));
          return;
        }

        if (!sesionDeSupabase) {
          // Nadie ha iniciado sesion todavia. No es un error y no se avisa de nada.
          limpiarSesion(null);
          return;
        }

        await aplicarSesion(sesionDeSupabase);
      } catch (error) {
        await cerrarSesionLocal(cliente);
        limpiarSesion(normalizarError(error));
      } finally {
        if (activo.current) {
          setEstadoRestauracion(ESTADOS_DE_RESTAURACION.LISTO);
        }
      }
    }

    const { data: suscripcion } = cliente.auth.onAuthStateChange((evento, sesionDeSupabase) => {
      if (!activo.current) return;

      // INITIAL_SESSION describe lo mismo que getSession() y llega casi a la vez. Atenderlo
      // aqui significaria leer el perfil dos veces en cada arranque.
      if (evento === "INITIAL_SESSION") return;

      if (evento === "SIGNED_OUT" || !sesionDeSupabase) {
        // Un SIGNED_OUT que nadie pidio es la sesion que expiro y no se pudo refrescar. Hay
        // que decirlo: la pantalla que el usuario tiene enfrente dejo de servir.
        const fueIntencional = cierreIntencional.current;
        cierreIntencional.current = false;
        limpiarSesion(
          fueIntencional ? null : construirError(CODIGOS_DE_ERROR_DE_SUPABASE.SESION_EXPIRADA),
        );
        return;
      }

      if (evento === "TOKEN_REFRESHED") {
        // Renovar el token no cambia de usuario. Se refresca la identidad y se deja el perfil
        // como esta, para no consultar la base de datos cada vez que vence un access token.
        cliente.auth.startAutoRefresh();
        setSesion((anterior) =>
          anterior.usuario === null
            ? anterior
            : { ...anterior, usuario: sesionDeSupabase.user, error: null },
        );
        return;
      }

      aplicarSesion(sesionDeSupabase);
    });

    restaurarSesion();

    return () => {
      activo.current = false;
      suscripcion.subscription.unsubscribe();
    };
  }, []);

  const logout = useCallback(async () => {
    // Se marca antes de cerrar, porque signOut() dispara SIGNED_OUT antes de resolver.
    cierreIntencional.current = true;
    const cliente = obtenerSupabase();
    await cerrarSesionLocal(cliente);
    resolucion.current += 1;
    setSesion({ ...SIN_SESION });
  }, []);

  return {
    usuario: sesion.usuario,
    perfil: sesion.perfil,
    rol: sesion.perfil?.rol ?? null,
    cargando: sesion.cargando,
    error: sesion.error,

    // Lo que ya consumian apps/mobile/App.js y AjustesScreen. Se mantiene tal cual.
    estadoRestauracion,
    haySesion: sesion.usuario !== null,
    logout,
  };
}

export { ESTADOS_DE_RESTAURACION };
