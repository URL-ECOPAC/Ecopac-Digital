// Entrada del modulo de proyectos. Mismo caso que DonacionesPage: es lo que enlaza el sidebar,
// y montaba PaginaPendiente aunque las dos pantallas del modulo ya existian, asi que no habia
// forma de llegar a ellas. El tablero kanban de proyectos (issue #308) todavia no existe; cuando
// exista, se agrega aqui.

import { Link } from "react-router-dom";
import { Card, Col, Container, Row } from "react-bootstrap";

const PANTALLAS = [
  {
    ruta: "/proyectos/sociales",
    titulo: "Proyectos sociales",
    descripcion: "Listado de proyectos con su responsable, estado y porcentaje de avance.",
  },
];

export default function ProyectosPage() {
  return (
    <Container fluid style={{ maxWidth: "1140px" }} className="py-4">
      <h1 className="h3 mb-1">Gestión de proyectos</h1>
      <p className="text-body-secondary mb-4">
        El seguimiento de avance e hitos de un proyecto se abre desde su fila en el listado.
      </p>

      <Row className="g-3">
        {PANTALLAS.map((pantalla) => (
          <Col md={6} lg={4} key={pantalla.ruta}>
            <Card as={Link} to={pantalla.ruta} className="h-100 text-decoration-none">
              <Card.Body>
                <Card.Title as="h2" className="h6 mb-2">
                  {pantalla.titulo}
                </Card.Title>
                <Card.Text className="text-body-secondary small mb-0">
                  {pantalla.descripcion}
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
  );
}
