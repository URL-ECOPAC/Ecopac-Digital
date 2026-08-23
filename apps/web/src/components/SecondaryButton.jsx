import { Button } from 'react-bootstrap';

/**
 * Boton de accion secundaria (ej. "Cancelar", "Volver").
 *
 * Espejo de apps/mobile/src/components/SecondaryButton.js: mismo estilo outline y, a
 * diferencia de PrimaryButton, sin `loading`, porque se usa para acciones que no disparan
 * una espera.
 */
export default function SecondaryButton({ title, onClick, disabled = false, style, ...rest }) {
  return (
    <Button variant="outline-primary" onClick={onClick} disabled={disabled} style={style} {...rest}>
      {title}
    </Button>
  );
}
