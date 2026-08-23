import { Form } from 'react-bootstrap';
import { useId } from 'react';

/**
 * Campo de fecha. Mismo patron visual que TextField (label arriba, error abajo), pero el
 * valor se elige en vez de escribirse.
 *
 * `onChange` entrega el VALOR ya resuelto y se llama igual en las dos plataformas: aqui no
 * aplica la excepcion onChange/onChangeText, porque no es un input de texto libre.
 *
 * El valor viaja siempre como cadena ISO 'YYYY-MM-DD', que es lo que produce
 * <input type="date"> y lo que espera una columna DATE de Postgres. Es la misma forma que
 * packages/shared/formato/fechas.js sabe leer como dia de calendario, sin correrse de dia
 * por zona horaria. Un campo vacio se reporta como null, no como ''.
 */
export default function DateField({
  label,
  value = null,
  onChange,
  minDate,
  maxDate,
  error,
  style,
  ...rest
}) {
  const id = useId();

  return (
    <Form.Group className="mb-3" style={style}>
      {label && <Form.Label htmlFor={id}>{label}</Form.Label>}
      <Form.Control
        id={id}
        type="date"
        value={value ?? ''}
        min={minDate}
        max={maxDate}
        isInvalid={Boolean(error)}
        onChange={(evento) => onChange?.(evento.target.value === '' ? null : evento.target.value)}
        {...rest}
      />
      {error && <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>}
    </Form.Group>
  );
}
