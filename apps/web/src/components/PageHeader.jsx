import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";

/**
 * Cabecera de pantalla: titulo, subtitulo y la fila de acciones de la pantalla.
 *
 * Cada entrada de `actions` es { label, onClick, variant?, icon?, loading?, disabled?, key? }.
 * `variant` acepta lo que aceptan los dos botones del catalogo:
 *
 *   - sin variant (o "primary"): la accion principal, en verde solido.
 *   - "secondary" / "outline": la alternativa, en contorno verde. Es el valor que ya usaban las
 *     pantallas y se conserva tal cual para no tocarlas.
 *   - "neutra": sin intencion propia ("Volver").
 *   - "peligro": destructiva.
 *   - "danger" / "warning" / "success": accion principal con otra intencion.
 *
 * `accent` tine el filete bajo el titulo con el color del modulo, que llega como variable de
 * tokens (`var(--accent-pacientes)`), nunca como un color escrito a mano.
 */
const VARIANTES_SECUNDARIAS = {
  secondary: "outline",
  outline: "outline",
  neutra: "neutra",
  peligro: "peligro",
};

export default function PageHeader({ title, subtitle, actions = [], accent }) {
  return (
    <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
      <div>
        <h1 className="h4 mb-1" style={{ color: "var(--color-text)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mb-0" style={{ color: "var(--color-text-muted)" }}>
            {subtitle}
          </p>
        )}
        {accent && (
          <span
            aria-hidden="true"
            className="d-block mt-2"
            style={{
              backgroundColor: accent,
              borderRadius: "var(--radio-pill)",
              height: "3px",
              width: "48px",
            }}
          />
        )}
      </div>

      {actions.length > 0 && (
        <div className="ec-acciones">
          {actions.map((accion, indice) => {
            const key = accion.key ?? accion.label ?? indice;

            if (accion.custom) {
              return <span key={key}>{accion.custom}</span>;
            }

            const comoSecundaria = VARIANTES_SECUNDARIAS[accion.variant];

            if (comoSecundaria) {
              return (
                <SecondaryButton
                  key={key}
                  title={accion.label}
                  onClick={accion.onClick}
                  variant={comoSecundaria}
                  icon={accion.icon}
                  loading={accion.loading}
                  disabled={accion.disabled}
                />
              );
            }

            return (
              <PrimaryButton
                key={key}
                title={accion.label}
                onClick={accion.onClick}
                variant={accion.variant ?? "primary"}
                icon={accion.icon}
                loading={accion.loading}
                disabled={accion.disabled}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
