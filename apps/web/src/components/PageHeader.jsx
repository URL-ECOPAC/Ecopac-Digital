import { Link } from "react-router-dom";
import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";

/**
 * Cabecera de pantalla: titulo, subtitulo, filete de color y la fila de acciones de la pantalla.
 *
 * Es la UNICA forma de titular una pantalla de la web. El aspecto vive en ui.css
 * (`.ec-cabecera*`): titulo en --texto-xl y negrita, subtitulo apagado en --texto-sm y el filete
 * del color del modulo debajo. Una pantalla que escribe su propio <h1> vuelve a abrir la
 * diferencia que este componente cierra.
 *
 * Cada entrada de `actions` es { label, onClick | to, variant?, icon?, loading?, disabled?, key? }.
 * `to` en vez de `onClick` hace de la accion un enlace de verdad (un <a href>, que se puede abrir
 * en otra pestana), para las acciones que solo llevan a otra pantalla. `variant` acepta lo que
 * aceptan los dos botones del catalogo:
 *
 *   - sin variant (o "primary"): la accion principal, en verde solido.
 *   - "secondary" / "outline": la alternativa, en contorno verde.
 *   - "neutra": sin intencion propia ("Volver", "Actualizar").
 *   - "peligro": destructiva.
 *   - "danger" / "warning" / "success": accion principal con otra intencion.
 *
 * Los botones ponen solos el "+" de una accion de alta y el basurero de una de borrado (ver
 * iconosDeAccion.js): no hace falta pasar `icon` para eso.
 *
 * `accent` tine el filete con otro color que el del modulo, siempre como variable de tokens
 * (`var(--accent-pacientes)`), nunca como un color escrito a mano. Sin `accent`, el filete toma
 * `--ec-acento-modulo`, que MainLayout publica a partir de la ruta: por eso todas las pantallas de
 * un modulo llevan el mismo color que su tarjeta del inicio sin que ninguna lo repita.
 *
 * `children` se dibuja bajo el filete (un chip de estado, un dato de contexto).
 */
export default function PageHeader({ title, subtitle, actions = [], accent, children }) {
  return (
    <div className="ec-cabecera">
      <div className="ec-cabecera-texto">
        <h1 className="ec-cabecera-titulo">{title}</h1>
        {subtitle && <p className="ec-cabecera-subtitulo">{subtitle}</p>}
        <span
          aria-hidden="true"
          className="ec-cabecera-acento"
          data-testid="cabecera-acento"
          style={accent ? { "--ec-acento": accent } : undefined}
        />
        {children}
      </div>

      <AccionesDeCabecera actions={actions} />
    </div>
  );
}

const VARIANTES_SECUNDARIAS = {
  secondary: "outline",
  outline: "outline",
  neutra: "neutra",
  peligro: "peligro",
};

/**
 * La fila de acciones de PageHeader, sola. La usan las pestanas de una pantalla que ya tiene su
 * cabecera -un reporte dentro del hub de reportes- y necesitan sus propios botones sin un segundo
 * titulo de pagina.
 */
export function AccionesDeCabecera({ actions = [] }) {
  if (actions.length === 0) return null;

  return (
    <div className="ec-acciones">
      {actions.map((accion, indice) => {
        const key = accion.key ?? accion.label ?? indice;

        if (accion.custom) {
          return <span key={key}>{accion.custom}</span>;
        }

        const comoSecundaria = VARIANTES_SECUNDARIAS[accion.variant];
        const enlace = accion.to ? { as: Link, to: accion.to } : {};
        const comunes = {
          title: accion.label,
          onClick: accion.onClick,
          icon: accion.icon,
          loading: accion.loading,
          disabled: accion.disabled,
          ...enlace,
        };

        return comoSecundaria ? (
          <SecondaryButton key={key} variant={comoSecundaria} {...comunes} />
        ) : (
          <PrimaryButton key={key} variant={accion.variant ?? "primary"} {...comunes} />
        );
      })}
    </div>
  );
}
