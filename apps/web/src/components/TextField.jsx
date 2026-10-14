import { Form } from "react-bootstrap";
import { useId } from "react";
import MarcaDeRequerido from "./MarcaDeRequerido";

/**
 * Campo de texto controlado.
 *
 * Espejo de apps/mobile/src/components/TextField.js. La excepcion de nombres del contrato
 * aplica aqui: en web el evento es `onChange` y entrega el evento del DOM, en movil es
 * `onChangeText` y entrega el string directo. Es la unica diferencia deliberada.
 *
 * El resto de props pasa al input subyacente (`value`, `placeholder`, `type`, `maxLength`...),
 * igual que en movil.
 */
export default function TextField({ label, requerido, error, style, ...inputProps }) {
  const id = useId();

  return (
    <Form.Group className="mb-3" style={style}>
      {label && <Form.Label htmlFor={id}>{label}</Form.Label>}
      {label && <MarcaDeRequerido requerido={requerido} />}
      <Form.Control
        id={id}
        isInvalid={Boolean(error)}
        aria-required={requerido === true || undefined}
        {...inputProps}
      />
      {error && <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>}
    </Form.Group>
  );
}
