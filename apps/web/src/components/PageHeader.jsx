import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";

/**
 * Encabezado de pantalla: titulo, subtitulo opcional y acciones.
 *
 * En web las acciones van alineadas a la derecha, en la misma fila que el titulo. En movil
 * bajan a una fila propia debajo, porque en ancho angosto no caben al lado.
 *
 * Cada accion es { label, onClick, variant }. `variant` acepta 'primary' (por defecto) o
 * 'secondary', y se resuelve a los botones del catalogo en vez de a un Button suelto, para
 * que un boton de encabezado se vea igual que cualquier otro de la app.
 */
export default function PageHeader({ title, subtitle, actions = [] }) {
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
      </div>

      {actions.length > 0 && (
        <div className="d-flex flex-wrap gap-2">
          {actions.map((accion) => {
            const Boton = accion.variant === "secondary" ? SecondaryButton : PrimaryButton;
            return <Boton key={accion.label} title={accion.label} onClick={accion.onClick} />;
          })}
        </div>
      )}
    </div>
  );
}
