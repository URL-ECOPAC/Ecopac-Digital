import { Container, Button } from "react-bootstrap";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <Container className="d-flex flex-column align-items-center justify-content-center text-center py-5">
      <h1 className="display-3 fw-bold text-success mb-2" style={{ color: "#15803D" }}>
        404
      </h1>
      <h2 className="fs-4 fw-semibold mb-2 text-dark">Página no encontrada</h2>
      <p className="text-muted mb-4" style={{ maxWidth: "420px", fontSize: "14px" }}>
        La ruta a la que intentas acceder no existe, no está disponible o no tienes permisos para
        verla.
      </p>
      <Button as={Link} to="/" variant="success">
        Volver al Inicio
      </Button>
    </Container>
  );
}
