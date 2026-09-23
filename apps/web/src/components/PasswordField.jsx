import { Eye, EyeOff } from "lucide-react";
import { Form, InputGroup } from "react-bootstrap";
import { useId, useState } from "react";

/**
 * Campo de contrasena con el icono de ojo para mostrar u ocultar el valor (issue #864).
 *
 * Es TextField mas el boton, y no una prop de TextField, porque el estado de visibilidad es
 * propio de cada campo: en "Cambiar contrasena" hay tres campos y cada uno se muestra por su
 * cuenta. Quien lo use no tiene que acordarse de llevar ese estado.
 *
 * El boton lleva `tabIndex={-1}` -- igual que AuthPasswordToggle, del que copia el criterio --
 * para no interponerse entre un campo y el siguiente al tabular, y `aria-label` que dice que
 * hace, porque un icono solo no se lee en voz alta.
 *
 * El resto de las props pasa al input, igual que en TextField (`value`, `onChange`,
 * `autoComplete`, `placeholder`, `disabled`...).
 */
export default function PasswordField({ label, error, style, ...inputProps }) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <Form.Group className="mb-3" style={style}>
      {label && <Form.Label htmlFor={id}>{label}</Form.Label>}
      <InputGroup hasValidation>
        <Form.Control
          id={id}
          type={visible ? "text" : "password"}
          isInvalid={Boolean(error)}
          {...inputProps}
        />
        <button
          type="button"
          className="ec-ojo-contrasena"
          tabIndex={-1}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          onClick={() => setVisible((actual) => !actual)}
          disabled={inputProps.disabled}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
        {error && <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>}
      </InputGroup>
    </Form.Group>
  );
}
