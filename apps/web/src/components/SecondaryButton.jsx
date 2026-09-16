import { Button, Spinner } from "react-bootstrap";

/**
 * Boton de accion secundaria (ej. "Cancelar", "Volver", "Editar").
 *
 * Espejo de apps/mobile/src/components/SecondaryButton.js: mismo estilo outline y las mismas
 * props, salvo el nombre del evento (`onClick` aqui, `onPress` en movil).
 *
 * Ahora si acepta `loading`, al contrario de lo que decia el comentario anterior: "Restablecer"
 * en el modal de permisos y "Cargar mas pacientes" en el listado son acciones secundarias que
 * SI disparan una espera, y sin esta prop cada pantalla lo resolvia cambiando el texto a mano
 * ("Cargando...").
 *
 * `variant` distingue las dos jerarquias de accion secundaria que ya existian escritas a mano:
 *   - "outline" (por defecto): la accion alternativa de una cabecera o de un pie de modal.
 *   - "neutra": la que no tiene intencion propia -"Cancelar", "Cerrar"-, en gris en vez de en
 *     verde, para que un pie de modal no ofrezca dos botones que compiten por la vista.
 *   - "peligro": borrar, anular, rechazar.
 *
 * @param {"outline"|"neutra"|"peligro"} [props.variant]
 * @param {"sm"|"md"|"lg"} [props.size]
 * @param {import("react").ReactNode} [props.icon]
 */
const VARIANTES = {
  outline: "outline-primary",
  neutra: "outline-secondary",
  peligro: "outline-danger",
};

export default function SecondaryButton({
  title,
  onClick,
  disabled = false,
  loading = false,
  variant = "outline",
  size = "md",
  icon = null,
  block = false,
  className = "",
  style,
  ...rest
}) {
  const inactivo = disabled || loading;
  const tamano = size === "md" ? undefined : size;

  const clases = ["btn-icono", block ? "w-100" : null, className].filter(Boolean).join(" ");

  return (
    <Button
      variant={VARIANTES[variant] ?? VARIANTES.outline}
      size={tamano}
      onClick={onClick}
      disabled={inactivo}
      aria-busy={loading}
      className={clases}
      style={style}
      {...rest}
    >
      {loading ? (
        <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
      ) : (
        <>
          {icon}
          {title}
        </>
      )}
    </Button>
  );
}
