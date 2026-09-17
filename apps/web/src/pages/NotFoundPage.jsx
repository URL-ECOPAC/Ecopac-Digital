import { PageHeader, ScreenContainer } from "../components";

// Pagina no encontrada. Tenia su propio "404" en display-3 con un verde escrito a mano (#15803D)
// y un h2 de Bootstrap: la unica pantalla que no se parecia a ninguna otra. Ahora es una
// cabecera como la de cualquier modulo, con la salida como accion.
export default function NotFoundPage() {
  return (
    <ScreenContainer>
      <PageHeader
        title="Página no encontrada"
        subtitle="La ruta a la que intentas acceder no existe, no está disponible o no tienes permisos para verla."
        actions={[{ label: "Volver al inicio", to: "/", variant: "neutra" }]}
      />
    </ScreenContainer>
  );
}
