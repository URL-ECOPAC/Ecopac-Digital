import { useNavigate } from "react-router-dom";
import { etiquetaDeRol } from "@ecopac/shared";
import { ErrorState, PageHeader, ScreenContainer } from "../components";

/**
 * Pantalla de acceso denegado.
 *
 * La dibuja RutaProtegida cuando hay sesion pero el rol no alcanza el modulo. Se renderiza EN
 * EL SITIO, sin cambiar de ruta: si redirigiera, se perderia la URL que la persona intento
 * abrir y no habria a donde volver cuando alguien le de el permiso.
 *
 * Dice de que rol se trata y a quien pedirle el acceso, en vez de un "403" a secas: quien lo lee
 * esta trabajando, no depurando, y lo unico que necesita saber es como seguir.
 */
export default function AccesoDenegadoPage({ rol }) {
  const navigate = useNavigate();

  const mensaje = rol
    ? `Tu usuario tiene el rol de ${etiquetaDeRol(rol)} y ese rol no alcanza esta seccion. ` +
      "Si necesitas entrar, pídeselo a la administradora."
    : "No se pudo confirmar tu rol, así que no es posible abrir esta sección. " +
      "Vuelve a iniciar sesión y, si sigue pasando, avisa a la administradora.";

  return (
    <ScreenContainer>
      <PageHeader title="Acceso restringido" />
      <ErrorState message={mensaje} onRetry={() => navigate("/")} />
    </ScreenContainer>
  );
}
