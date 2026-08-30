import { Container, Button, Alert } from "react-bootstrap";
import { labels } from "@ecopac/ui-tokens";

/**
 * Componente para mostrar estados de error normalizados con opción de reintento.
 */
export default function ErrorState({
  message = labels?.errorDeConexion || "Ha ocurrido un error al cargar la información.",
  onRetry,
}) {
  return (
    <Container className="py-4 px-0">
      <Alert variant="danger" className="d-flex flex-column align-items-center text-center m-0">
        <Alert.Heading className="fs-6 fw-bold mb-2">Ha ocurrido un problema</Alert.Heading>
        <p className="mb-3" style={{ fontSize: "14px" }}>
          {message}
        </p>
        {onRetry && (
          <Button variant="outline-danger" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        )}
      </Alert>
    </Container>
  );
}
