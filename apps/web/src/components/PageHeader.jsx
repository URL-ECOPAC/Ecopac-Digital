import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";

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
          {actions.map((accion, indice) => {
            const key = accion.key ?? accion.label ?? indice;

            if (accion.custom) {
              return <span key={key}>{accion.custom}</span>;
            }

            const Boton = accion.variant === "secondary" ? SecondaryButton : PrimaryButton;
            return <Boton key={key} title={accion.label} onClick={accion.onClick} />;
          })}
        </div>
      )}
    </div>
  );
}
