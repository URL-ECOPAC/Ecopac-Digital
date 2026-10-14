import { descriptorDeCategoria, formatearFechaConHora } from "@ecopac/shared";
import "./notificaciones.css";

// Una notificacion del buzon (issue #755). La usan la ventana dedicada (NotificacionesPage) y la
// ventana emergente de la campana (CampanaNotificaciones); `compacto` es la de la campana, sin el
// cuerpo completo para que quepan varias sin desplazar.
//
// El color de la categoria es un nombre de token (`tono`, DESCRIPTORES_CATEGORIA_NOTIFICACION) que
// aqui se lee como var(--color-<tono>): el componente no escribe ningun color (docs/DISENO.md).

export function acentoDeCategoria(categoria) {
  return { "--ec-acento": `var(--color-${descriptorDeCategoria(categoria).tono})` };
}

export default function ItemNotificacion({ notificacion, onAbrir, compacto = false }) {
  const { etiqueta } = descriptorDeCategoria(notificacion.categoria);
  const clases = [
    "notificacion-item",
    notificacion.leida ? null : "notificacion-item--sin-leer",
    compacto ? "notificacion-item--compacto" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li>
      <button
        type="button"
        className={clases}
        style={acentoDeCategoria(notificacion.categoria)}
        onClick={() => onAbrir(notificacion)}
      >
        <span className="notificacion-item-cabecera">
          <span className="ec-chip">{etiqueta}</span>
          <time className="notificacion-item-fecha" dateTime={notificacion.createdAt}>
            {formatearFechaConHora(notificacion.createdAt)}
          </time>
        </span>
        <span className="notificacion-item-titulo">
          {!notificacion.leida && <span className="notificacion-punto" aria-label="Sin leer" />}
          {notificacion.titulo}
        </span>
        <span className="notificacion-item-cuerpo">{notificacion.cuerpo}</span>
      </button>
    </li>
  );
}
