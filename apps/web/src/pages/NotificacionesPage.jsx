import { CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { FILTROS_NOTIFICACIONES, useBuzonNotificaciones } from "@ecopac/shared";

import {
  ErrorState,
  FilterBar,
  LoadingState,
  PageHeader,
  ScreenContainer,
  Tabs,
} from "../components";
import ItemNotificacion, { acentoDeCategoria } from "../components/ItemNotificacion";
import { useSesionCompartida } from "../contexto/SesionProvider";

// Ventana dedicada de notificaciones (issue #755), en /notificaciones. Es donde se filtra: por
// texto, por una categoria en especial y por estado de lectura (FILTROS_NOTIFICACIONES), y se ve
// en orden de llegada o agrupado por categoria. La campana de la cabecera muestra solo las mas
// recientes y trae aqui; el perfil tambien, con un boton, en vez de cargar el buzon entero.
//
// Solo presentacion: la lista, los filtros, el agrupado y el marcar como leida salen de
// useBuzonNotificaciones(). El movil tiene su espejo en NotificacionesScreen.js.

const VISTA_LLEGADA = "llegada";
const VISTA_CATEGORIA = "categoria";

const VISTAS = [
  { id: VISTA_LLEGADA, label: "Por llegada" },
  { id: VISTA_CATEGORIA, label: "Por categoría" },
];

export default function NotificacionesPage() {
  const navigate = useNavigate();
  const { perfil } = useSesionCompartida();
  const {
    notificaciones,
    total,
    grupos,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros,
    agrupar,
    setAgrupar,
    noLeidas,
    cargando,
    error,
    errorAccion,
    recargar,
    abrir,
    marcarTodas,
  } = useBuzonNotificaciones({ perfilId: perfil?.id });

  const alAbrir = async (notificacion) => {
    const marcada = await abrir(notificacion);
    if (marcada) navigate(notificacion.enlace);
  };

  const lista = (items) => (
    <ul className="notificacion-lista">
      {items.map((notificacion) => (
        <ItemNotificacion key={notificacion.id} notificacion={notificacion} onAbrir={alAbrir} />
      ))}
    </ul>
  );

  let contenido;
  if (cargando && total === 0) {
    contenido = <LoadingState />;
  } else if (error) {
    contenido = <ErrorState message={error.mensaje} onRetry={recargar} />;
  } else if (total === 0) {
    contenido = <p className="ec-subseccion-vacio">No tienes notificaciones.</p>;
  } else if (notificaciones.length === 0) {
    contenido = (
      <p className="ec-subseccion-vacio">Ninguna notificación coincide con los filtros.</p>
    );
  } else if (agrupar) {
    contenido = grupos.map((grupo) => (
      <section
        key={grupo.categoria}
        className="ec-subseccion"
        style={acentoDeCategoria(grupo.categoria)}
      >
        <h3 className="ec-subseccion-titulo">
          {grupo.etiqueta} ({grupo.notificaciones.length})
          {grupo.noLeidas > 0 && ` · ${grupo.noLeidas} sin leer`}
        </h3>
        {lista(grupo.notificaciones)}
      </section>
    ));
  } else {
    contenido = lista(notificaciones);
  }

  return (
    <ScreenContainer>
      <PageHeader
        title="Notificaciones"
        subtitle={noLeidas > 0 ? `${noLeidas} sin leer` : "Todo al día"}
        actions={
          noLeidas > 0
            ? [
                {
                  label: "Marcar todas como leídas",
                  onClick: marcarTodas,
                  variant: "secondary",
                  icon: <CheckCheck size={16} aria-hidden="true" />,
                },
              ]
            : []
        }
      />

      {errorAccion && <ErrorState message={errorAccion.mensaje} />}

      <FilterBar
        campos={FILTROS_NOTIFICACIONES}
        valores={filtros}
        onChange={setFiltro}
        onLimpiar={limpiarFiltros}
        hayFiltros={hayFiltros}
      />

      <Tabs
        tabs={VISTAS}
        activo={agrupar ? VISTA_CATEGORIA : VISTA_LLEGADA}
        onChange={(vista) => setAgrupar(vista === VISTA_CATEGORIA)}
      >
        {contenido}
      </Tabs>
    </ScreenContainer>
  );
}
