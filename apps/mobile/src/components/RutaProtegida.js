import { useSesionCompartida } from "../contexto/SesionProvider";
import AccesoDenegadoScreen from "../screens/AccesoDenegadoScreen";

/**
 * Guard para validar el rol del usuario en la navegacion movil (issue #427).
 */
export default function RutaProtegida({ rolesPermitidos = [], children }) {
  const { perfil } = useSesionCompartida();
  const rol = perfil?.rol;

  if (!rol || (rolesPermitidos.length > 0 && !rolesPermitidos.includes(rol))) {
    return <AccesoDenegadoScreen />;
  }

  return children;
}
