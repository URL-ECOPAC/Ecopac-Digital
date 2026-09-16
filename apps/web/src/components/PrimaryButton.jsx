import { Button, Spinner } from "react-bootstrap";

/**
 * Boton de accion principal.
 *
 * Espejo de apps/mobile/src/components/PrimaryButton.js. La unica diferencia de API es el
 * nombre del evento, que el contrato admite: aqui `onClick`, en movil `onPress`.
 *
 * `variant`, `size` e `icon` se agregan para que deje de haber acciones dibujadas a mano. Antes,
 * cualquier boton que no fuera "el primario verde" -borrar, aprobar, una accion pequena dentro
 * de una fila- se escribia como un <button className="btn ..."> suelto en la pantalla, y de ahi
 * salian las cuatro formas distintas de dibujar lo mismo. El aspecto de cada variante lo resuelve
 * src/ui.css contra los tokens; aqui solo se elige cual.
 *
 * @param {object} props
 * @param {string} props.title Texto del boton.
 * @param {() => void} [props.onClick]
 * @param {"primary"|"danger"|"warning"|"success"} [props.variant] Intencion de la accion.
 * @param {"sm"|"md"|"lg"} [props.size]
 * @param {import("react").ReactNode} [props.icon] Icono a la izquierda del texto.
 * @param {boolean} [props.block] Ocupa todo el ancho disponible.
 */
export default function PrimaryButton({
  title,
  onClick,
  disabled = false,
  loading = false,
  variant = "primary",
  size = "md",
  icon = null,
  block = false,
  className = "",
  style,
  ...rest
}) {
  const inactivo = disabled || loading;

  // "md" es el tamano base y no existe como clase en Bootstrap: se pasa undefined.
  const tamano = size === "md" ? undefined : size;

  const clases = ["btn-icono", block ? "w-100" : null, className].filter(Boolean).join(" ");

  return (
    <Button
      variant={variant}
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
