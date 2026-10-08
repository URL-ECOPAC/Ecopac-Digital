import { useNavigate } from "react-router-dom";
import { etiquetaDeRol } from "@ecopac/shared";
import { EmptyState, ErrorState, PageHeader, ScreenContainer } from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";

/**
 * Pantalla de acceso denegado.
 *
 * La dibuja RutaProtegida cuando hay sesion pero el rol no alcanza el modulo. Se renderiza EN
 * EL SITIO, sin cambiar de ruta: si redirigiera, se perderia la URL que la persona intento
 * abrir y no habria a donde volver cuando alguien le de el permiso.
 *
 * Dice de que rol se trata y a quien pedirle el acceso, en vez de un "403" a secas: quien lo lee
 * esta trabajando, no depurando, y lo unico que necesita saber es como seguir.
 *
 * Sin rol (no se pudo leer el perfil), "Reintentar" vuelve a leerlo (issue #911). Antes solo
 * navegaba al inicio, que pasaba por la misma ruta protegida y mostraba el mismo error hasta
 * recargar la pagina.
 *
 * Con un rol que no alcanza no hay nada que reintentar: no es un error, es el permiso. Se decia
 * "Ha ocurrido un problema" con un boton "Reintentar" que llevaba al inicio (issue #925); ahora es
 * un aviso con "Volver al inicio".
 */
export default function AccesoDenegadoPage({ rol }) {
  const navigate = useNavigate();
  const { refrescarPerfil } = useSesionCompartida();

  const mensaje = rol
    ? `Tu usuario tiene el rol de ${etiquetaDeRol(rol)} y ese rol no alcanza esta seccion. ` +
      "Si necesitas entrar, pídeselo a la administradora."
    : "No se pudo confirmar tu rol, así que no es posible abrir esta sección. " +
      "Vuelve a iniciar sesión y, si sigue pasando, avisa a la administradora.";

  return (
    <ScreenContainer>
      <PageHeader title="Acceso restringido" />
      {rol ? (
        <EmptyState
          message={mensaje}
          actionLabel="Volver al inicio"
          onAction={() => navigate("/")}
        />
      ) : (
        <ErrorState message={mensaje} onRetry={refrescarPerfil} />
      )}
    </ScreenContainer>
  );
}
