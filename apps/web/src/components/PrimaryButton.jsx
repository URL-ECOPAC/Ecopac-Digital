import { Button, Spinner } from "react-bootstrap";

/**
 * Boton de accion principal.
 *
 * Espejo de apps/mobile/src/components/PrimaryButton.js. La unica diferencia de API es el
 * nombre del evento, que el contrato admite: aqui `onClick`, en movil `onPress`.
 */
export default function PrimaryButton({
  title,
  onClick,
  disabled = false,
  loading = false,
  style,
  ...rest
}) {
  const inactivo = disabled || loading;

  return (
    <Button
      variant="primary"
      onClick={onClick}
      disabled={inactivo}
      aria-busy={loading}
      style={style}
      {...rest}
    >
      {loading ? (
        <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
      ) : (
        title
      )}
    </Button>
  );
}
