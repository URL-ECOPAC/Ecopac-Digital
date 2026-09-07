import { useState, useEffect } from "react";
import { Form, Button, Alert } from "react-bootstrap";
import Modal from "../ui/Modal";

export default function CatalogoCondicionesModal({
  show,
  onHide,
  condicion,
  onSubmit,
  enviando,
  errores,
}) {
  const [nombre, setNombre] = useState("");

  useEffect(() => {
    if (condicion) {
      setNombre(condicion.nombre ?? "");
    } else {
      setNombre("");
    }
  }, [condicion, show]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await onSubmit(nombre);
    if (res?.ok) {
      onHide();
    }
  };

  const esEdicion = Boolean(condicion);

  return (
    <Modal
      show={show}
      onHide={onHide}
      title={esEdicion ? "Editar Condición Crónica" : "Nueva Condición Crónica"}
    >
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3" controlId="nombreCondicion">
          <Form.Label>Nombre de la Condición</Form.Label>
          <Form.Control
            type="text"
            placeholder="Ej. Diabetes Mellitus Tipo 2"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            isInvalid={Boolean(errores?.nombre)}
            disabled={enviando}
            autoFocus
          />
          <Form.Control.Feedback type="invalid">
            {errores?.nombre}
          </Form.Control.Feedback>
        </Form.Group>

        {errores?.general && (
          <Alert variant="danger" className="py-2">
            {errores.general}
          </Alert>
        )}

        <div className="d-flex justify-content-end gap-2">
          <Button variant="secondary" onClick={onHide} disabled={enviando}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={enviando}>
            {enviando ? "Guardando..." : esEdicion ? "Guardar Cambios" : "Crear Condición"}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}