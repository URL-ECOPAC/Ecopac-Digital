// Entrada del modulo de donaciones: es la ruta que el sidebar enlaza (MODULOS de
// packages/shared/navegacion.js), asi que hasta que exista el resumen del modulo tiene que al
// menos llevar a sus pantallas. Antes montaba PaginaPendiente y dejaba el modulo entero sin
// forma de alcanzarse: las cuatro pantallas existian y no habia un solo enlace hacia ellas.
//
// Esto no es el resumen con KPIs que el prototipo dibuja para el modulo -en movil eso es la
// issue #265 y en web no hay issue equivalente-, sino el indice mientras esa pantalla no
// exista.

import { Link } from "react-router-dom";
import { Card, Col, Container, Row } from "react-bootstrap";

const PANTALLAS = [
  {
    ruta: "/donaciones/registro",
    titulo: "Registrar donación",
    descripcion: "Alta de una donación recibida, con su donante y sus renglones de detalle.",
  },
  {
    ruta: "/donaciones/historial",
    titulo: "Historial de donaciones",
    descripcion: "Donaciones recibidas, con filtros por tipo, proyecto y rango de fechas.",
  },
  {
    ruta: "/donantes",
    titulo: "Donantes",
    descripcion: "Catálogo de donantes y el histórico de lo que ha aportado cada uno.",
  },
];

export default function DonacionesPage() {
  return (
    <Container fluid style={{ maxWidth: "1140px" }} className="py-4">
      <h1 className="h3 mb-1">Control de donaciones</h1>
      <p className="text-body-secondary mb-4">
        La constancia de una donación se abre desde su fila en el historial.
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
