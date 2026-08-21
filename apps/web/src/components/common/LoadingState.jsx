import { Spinner, Container } from 'react-bootstrap';
import { labels } from '@ecopac/ui-tokens';

/**
 * Componente de estado de carga dentro del área de contenido.
 */
export default function LoadingState({ message = labels?.cargando || 'Cargando...' }) {
  return (
    <Container className="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
      <Spinner animation="border" variant="success" role="status" className="mb-3" />
      <span className="fw-medium">{message}</span>
    </Container>
  );
}