import { Form } from 'react-bootstrap';
import { useId } from 'react';

/**
 * Selector tipo dropdown.
 *
 * Espejo de apps/mobile/src/components/Selector.js. `onSelect` recibe el VALOR ya resuelto,
 * no el evento, y se llama igual en las dos plataformas: es lo que permite mover una pantalla
 * de web a movil sin tocar el handler.
 *
 * Las opciones vienen como [{ label, value }], que es la forma que publica shared desde la
 * issue #399. Antes convivian dos formas y este componente normalizaba por dentro; hoy no hay
 * nada que normalizar y un catalogo ausente se resuelve con una lista vacia.
 *
 * Un valor sin elegir se representa con '' en el DOM, que es lo que entiende <select>, pero
 * hacia afuera se conserva null.
 */
export default function Selector({
  label,
  value,
  options = [],
  onSelect,
  placeholder = 'Seleccionar',
  error,
  style,
  disabled = false,
}) {
  const id = useId();
  const opciones = Array.isArray(options) ? options : [];

  const alCambiar = (evento) => {
    const crudo = evento.target.value;
    if (crudo === '') {
      onSelect?.(null);
      return;
    }
    // <select> siempre entrega texto: se devuelve el value original de la opcion para no
    // convertir un id numerico en string a mitad de camino.
    const elegida = opciones.find((opcion) => String(opcion.value) === crudo);
    onSelect?.(elegida ? elegida.value : crudo);
  };

  return (
    <Form.Group className="mb-3" style={style}>
      {label && <Form.Label htmlFor={id}>{label}</Form.Label>}
      <Form.Select
        id={id}
        value={value ?? ''}
        onChange={alCambiar}
        isInvalid={Boolean(error)}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {opciones.map((opcion) => (
          <option key={String(opcion.value)} value={String(opcion.value)}>
            {opcion.label}
          </option>
        ))}
      </Form.Select>
      {error && <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>}
    </Form.Group>
  );
}
