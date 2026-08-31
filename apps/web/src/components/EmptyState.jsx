import { Container, Button } from "react-bootstrap";
import { labels } from "@ecopac/ui-tokens";

/**
 * Componente para mostrar un estado vacío con mensaje y acción sugerida.
 */
export default function EmptyState({
  message = labels?.sinResultados || "No hay datos disponibles.",
  actionLabel,
  onAction,
}) {
  return (
    <Container className="d-flex flex-column align-items-center justify-content-center py-5 text-center bg-white rounded border">
      <p className="text-muted fs-6 mb-3">{message}</p>
      {actionLabel && onAction && (
        <Button variant="success" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Container>
  );
}
