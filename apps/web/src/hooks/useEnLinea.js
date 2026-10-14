import { useEffect, useState } from "react";

/**
 * Si el navegador tiene red (issue #762, "fallos de red").
 *
 * Vive en apps/web y no en packages/shared porque lee `navigator` y escucha eventos de `window`,
 * que shared no puede tocar. `navigator.onLine` en `false` es fiable (no hay red de ningun tipo);
 * en `true` solo dice que hay una interfaz de red, no que Supabase responda. Por eso esto alimenta
 * un aviso, no una decision: quien sabe si una escritura llego es la respuesta de la API.
 */
export function useEnLinea() {
  const [enLinea, setEnLinea] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  );

  useEffect(() => {
    const alConectar = () => setEnLinea(true);
    const alDesconectar = () => setEnLinea(false);
    window.addEventListener("online", alConectar);
    window.addEventListener("offline", alDesconectar);
    return () => {
      window.removeEventListener("online", alConectar);
      window.removeEventListener("offline", alDesconectar);
    };
  }, []);

  return enLinea;
}
