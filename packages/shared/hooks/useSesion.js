import { useCallback, useEffect, useState } from "react";

import { obtenerSupabase } from "../api/cliente.js";

const ESTADOS_DE_RESTAURACION = {
  CARGANDO: "cargando",
  LISTO: "listo",
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
 * Estado compartido de la sesión persistida por Supabase.
 *
 * Supabase obtiene la sesión usando el adaptador que recibió durante su inicialización. Si el
 * access token venció, getSession() usa el refresh token para renovarlo antes de devolverlo.
 */
export function useSesion() {
  const [estadoRestauracion, setEstadoRestauracion] = useState(
    ESTADOS_DE_RESTAURACION.CARGANDO,
  );
  const [haySesion, setHaySesion] = useState(false);

  useEffect(() => {
    const cliente = obtenerSupabase();
    let activo = true;

    async function restaurarSesion() {
      try {
        const { data, error } = await cliente.auth.getSession();
        const sesion = data?.session;

        if (error || !sesion) {
          if (error) {
            await cerrarSesionLocal(cliente);
          } else {
            cliente.auth.stopAutoRefresh();
          }

          if (activo) {
            setHaySesion(false);
          }
          return;
        }

        cliente.auth.startAutoRefresh();
        if (activo) {
          setHaySesion(true);
        }
      } catch {
        await cerrarSesionLocal(cliente);
        if (activo) {
          setHaySesion(false);
        }
      } finally {
        if (activo) {
          setEstadoRestauracion(ESTADOS_DE_RESTAURACION.LISTO);
        }
      }
    }

    const { data: suscripcion } = cliente.auth.onAuthStateChange((evento, sesion) => {
      if (!activo) {
        return;
      }

      if (evento === "SIGNED_OUT" || !sesion) {
        cliente.auth.stopAutoRefresh();
        setHaySesion(false);
        return;
      }

      cliente.auth.startAutoRefresh();
      setHaySesion(true);
    });

    restaurarSesion();

    return () => {
      activo = false;
      suscripcion.subscription.unsubscribe();
    };
  }, []);

  const logout = useCallback(async () => {
    const cliente = obtenerSupabase();
    await cerrarSesionLocal(cliente);
    setHaySesion(false);
  }, []);

  return {
    estadoRestauracion,
    haySesion,
    logout,
  };
}

export { ESTADOS_DE_RESTAURACION };
