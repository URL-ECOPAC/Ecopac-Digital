import { Modal as ModalBootstrap } from "react-bootstrap";

/**
 * Dialogo modal.
 *
 * La prop se llama `visible` y no `show` a proposito: es el nombre que fija el contrato del
 * catalogo, y el mismo que usa el Modal de React Native, para que la pantalla no cambie al
 * portarse. Aqui se traduce a la `show` que espera react-bootstrap.
 *
 * En movil el equivalente sube desde abajo como hoja inferior; en web va centrado.
 */
export default function Modal({ visible = false, onClose, title, children, ...rest }) {
  return (
    <ModalBootstrap show={visible} onHide={onClose} centered {...rest}>
      {title && (
        <ModalBootstrap.Header closeButton>
          <ModalBootstrap.Title as="h2" className="h5">
            {title}
          </ModalBootstrap.Title>
        </ModalBootstrap.Header>
      )}
      <ModalBootstrap.Body>{children}</ModalBootstrap.Body>
    </ModalBootstrap>
  );
}
