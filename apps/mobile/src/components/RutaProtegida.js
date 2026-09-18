import { useSesionCompartida } from "../contexto/SesionProvider";
import AccesoDenegadoScreen from "../screens/AccesoDenegadoScreen";

/**
 * Guard de rol de la navegacion movil (issues #427, #692 y #820).
 *
 * ESTO MEJORA LA EXPERIENCIA, NO ES LA GARANTIA DE SEGURIDAD. Cualquiera puede saltarse un guard
 * de cliente; lo que de verdad protege los datos son las politicas RLS de la base (capa 4 de
 * docs/PERMISOS.md). Aqui se evita que alguien llegue a una pantalla que no va a poder usar.
 *
 * UNA LISTA VACIA DENIEGA (issue #820). Antes la condicion era:
 *
 *   if (!rol || (rolesPermitidos.length > 0 && !rolesPermitidos.includes(rol)))
 *
 * Con `rolesPermitidos = []` se reducia a `!rol`: cualquier sesion autenticada entraba. Y como los
 * roles salen de rolesDelModulo(), que devuelve [] cuando el modulo no existe, un id mal escrito
 * abria la pantalla a los cinco roles en silencio -sin aviso, sin excepcion, con la pantalla
 * dibujandose normal-. Un arreglo vacio significa "nadie", no "sin restriccion": quien quiera
 * abrir una pantalla a todos pasa TODOS_LOS_ROLES, que es una decision escrita, no una omision.
 *
 * El guard de web (apps/web/src/components/RutaProtegida.jsx) nunca tuvo el defecto: alli el valor
 * que significa "solo comprobar que haya sesion" es `null`, y no se usa dentro del layout.
 */
export default function RutaProtegida({ rolesPermitidos = [], children }) {
  const { perfil } = useSesionCompartida();
  const rol = perfil?.rol;

  if (!rol || !rolesPermitidos.includes(rol)) {
    return <AccesoDenegadoScreen />;
  }

  return children;
}
