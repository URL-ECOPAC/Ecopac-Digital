import { Form, InputGroup } from "react-bootstrap";
import { useId } from "react";

/**
 * Campo numerico.
 *
 * `onChange` entrega un number ya convertido, o null si el campo quedo vacio: quien lo usa no
 * deberia tener que acordarse de que el DOM siempre devuelve texto. Se llama igual en las dos
 * plataformas.
 *
 * `suffix` es el texto pegado al valor (ej. 'anios'), el mismo dato que las columnas declaran
 * como `sufijo` en packages/shared/pacientes/columnas.js.
 */
export default function NumberField({
  label,
  value = null,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  error,
  style,
  ...rest
}) {
  const id = useId();

  const alCambiar = (evento) => {
    const crudo = evento.target.value;
    if (crudo === "") {
      onChange?.(null);
      return;
    }
    const numero = Number(crudo);
    onChange?.(Number.isNaN(numero) ? null : numero);
  };

  const control = (
    <Form.Control
      id={id}
      type="number"
      value={value ?? ""}
      min={min}
      max={max}
      step={step}
      isInvalid={Boolean(error)}
      onChange={alCambiar}
      {...rest}
    />
  );

  return (
    <Form.Group className="mb-3" style={style}>
      {label && <Form.Label htmlFor={id}>{label}</Form.Label>}
      {suffix ? (
        <InputGroup hasValidation>
          {control}
          <InputGroup.Text>{suffix}</InputGroup.Text>
          {error && <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>}
        </InputGroup>
      ) : (
        <>
          {control}
          {error && <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>}
        </>
      )}
    </Form.Group>
  );
}
