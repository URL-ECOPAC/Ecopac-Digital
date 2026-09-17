import { WifiOff } from "lucide-react";

/**
 * Franja fija bajo la cabecera cuando el navegador se queda sin red (issue #762).
 *
 * Antes no habia nada: la cabecera seguia diciendo "Sistema activo" y el primer indicio de que
 * no habia red era un guardado que fallaba -o, peor, una lista vacia que se leia como "no hay
 * datos"-. En jornada la senal se cae a media atencion, y quien atiende tiene que saberlo antes de
 * escribir una consulta entera, no despues.
 */
export default function AvisoSinConexion({ enLinea }) {
  if (enLinea) return null;

  return (
    <div className="app-sin-conexion" role="status" aria-live="polite">
      <WifiOff size={16} aria-hidden="true" />
      <span>
        <strong>Sin conexión.</strong> Lo que guardes ahora no llegará a la base de datos: espera a
        recuperar la señal antes de registrar datos nuevos.
      </span>
    </div>
  );
}
