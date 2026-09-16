import React from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import { formatearMoneda, useResumenDonaciones } from "@ecopac/shared";
import StatCard from "../components/StatCard";
import { useSesionCompartida } from "../contexto/SesionProvider";

const ACCESOS_NAV = [
  { ruta: "/donaciones/registro", etiqueta: "Registrar donación", variante: "primary" },
  {
    ruta: "/donaciones/historial",
    etiqueta: "Historial de donaciones",
    variante: "outline-primary",
  },
  { ruta: "/donantes", etiqueta: "Catálogo de donantes", variante: "outline-primary" },
];

export default function DonacionesPage() {
  // `rol` y no `usuario.rol`: `usuario` es la cuenta de Auth y no trae rol, que vive en perfiles.
  // Con `usuario?.rol` llegaba undefined, puedeVerDonaciones() respondia false y la pantalla le
  // decia "No tienes permisos de lectura" hasta a la administradora.
  const { rol } = useSesionCompartida();

  const { fechaInicio, setFechaInicio, fechaFin, setFechaFin, cargando, error, datos } =
    useResumenDonaciones({ rolUsuario: rol });

  const { totalesPorTipo, donacionesRecientes, donantesFrecuentes } = datos;

  return (
    <Container fluid style={{ maxWidth: "1200px" }} className="py-4">
      {/* Encabezado y Navegación rápida */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <h1 className="h3 mb-1">Resumen de Donaciones</h1>
          <p className="text-body-secondary mb-0">
            Indicadores principales, donaciones recientes y métricas del módulo.
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {ACCESOS_NAV.map((item) => (
            <Button key={item.ruta} as={Link} to={item.ruta} variant={item.variante} size="sm">
              {item.etiqueta}
            </Button>
          ))}
        </div>
      </div>

      {/* Filtro de Rango de Fechas */}
      <Card className="mb-4 border-0 shadow-sm bg-body-tertiary">
        <Card.Body className="py-3">
          <Form>
            <Row className="g-3 align-items-end">
              <Col xs={12} sm={5} md={4}>
                <Form.Group controlId="fechaInicio">
                  <Form.Label className="small text-body-secondary fw-semibold mb-1">
                    Fecha inicio
                  </Form.Label>
                  <Form.Control
                    type="date"
                    size="sm"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col xs={12} sm={5} md={4}>
                <Form.Group controlId="fechaFin">
                  <Form.Label className="small text-body-secondary fw-semibold mb-1">
                    Fecha fin
                  </Form.Label>
                  <Form.Control
                    type="date"
                    size="sm"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col xs={12} sm={2} md={4}>
                {(fechaInicio || fechaFin) && (
                  <Button
                    variant="link"
                    size="sm"
                    className="text-decoration-none p-0 text-muted"
                    onClick={() => {
                      setFechaInicio("");
                      setFechaFin("");
                    }}
                  >
                    Limpiar fechas
                  </Button>
                )}
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Tarjetas de indicador por tipo de aporte.
        StatCard, la misma pieza que usa inventario, en vez de cuatro <Card> con el borde
        izquierdo tenido y las utilidades de color de Bootstrap (border-primary, text-info,
        text-dark). Aquellas tomaban su color de la paleta de Bootstrap y no de la de Ecopac
        -"text-dark" es negro, no un color de la marca-, y ademas escribian la cifra con `h3`
        y las unidades con `fs-6`, una escala propia que no coincidia con la de ningun otro
        modulo. */}
      <div className="ec-kpis">
        <StatCard
          label="Dinero recibido"
          value={formatearMoneda(totalesPorTipo.dinero || 0)}
          accent="var(--accent-donaciones)"
          esTexto
        />
        <StatCard
          label="Medicamentos"
          value={totalesPorTipo.medicamentos || 0}
          caption="unidades"
          accent="var(--color-primary)"
        />
        <StatCard
          label="Insumos"
          value={totalesPorTipo.insumos || 0}
          caption="unidades"
          accent="var(--color-warning)"
        />
        <StatCard
          label="Servicios"
          value={totalesPorTipo.servicios || 0}
          caption="aportes"
          accent="var(--color-danger)"
        />
      </div>

      {/* Sección Principal: Tablas de Donaciones Recientes y Donantes Frecuentes */}
      <Row className="g-4">
        <Col lg={8}>
          <Card className="shadow-sm h-100">
            <Card.Header className="bg-transparent py-3 d-flex justify-content-between align-items-center">
              <h2 className="h6 mb-0 fw-bold">Donaciones Recientes</h2>
              <Button
                as={Link}
                to="/donaciones/historial"
                variant="link"
                size="sm"
                className="p-0 text-decoration-none"
              >
                Ver historial completo
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              {cargando ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" size="sm" />
                  <p className="small text-muted mt-2 mb-0">Cargando donaciones...</p>
                </div>
              ) : donacionesRecientes.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <p className="mb-0">No se encontraron donaciones para el periodo seleccionado.</p>
                </div>
              ) : (
                <Table responsive hover className="mb-0 align-middle">
                  <thead className="table-light small">
                    <tr>
                      <th>Fecha</th>
                      <th>Donante</th>
                      <th>Tipo</th>
                      <th>Detalle</th>
                      <th className="text-end">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="small">
                    {donacionesRecientes.map((d) => (
                      <tr key={d.id}>
                        <td className="text-nowrap">{d.fecha}</td>
                        <td className="fw-semibold">{d.donanteNombre || "Anónimo"}</td>
                        <td>
                          <Badge bg="light" text="dark" className="border">
                            {d.tipo}
                          </Badge>
                        </td>
                        <td
                          className="text-truncate"
                          style={{ maxWidth: "220px" }}
                          title={d.resumen}
                        >
                          {d.resumen || "-"}
                        </td>
                        <td className="text-end text-nowrap">
                          <Button
                            as={Link}
                            to={`/donaciones/${d.id}/constancia`}
                            variant="outline-primary"
                            size="sm"
                            className="py-0 px-2"
                          >
                            Constancia
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card className="shadow-sm h-100">
            <Card.Header className="bg-transparent py-3">
              <h2 className="h6 mb-0 fw-bold">Donantes más frecuentes</h2>
            </Card.Header>
            <Card.Body>
              {cargando ? (
                <div className="text-center py-4">
                  <Spinner animation="border" variant="primary" size="sm" />
                </div>
              ) : donantesFrecuentes.length === 0 ? (
                <p className="text-muted small mb-0">Sin datos de donantes en este periodo.</p>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {donantesFrecuentes.map((donante, index) => (
                    <div
                      key={donante.id}
                      className="d-flex justify-content-between align-items-center"
                    >
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-secondary rounded-pill">{index + 1}</span>
                        <span className="fw-semibold small">{donante.nombre}</span>
                      </div>
                      <Badge bg="primary" pill>
                        {donante.totalDonaciones}{" "}
                        {donante.totalDonaciones === 1 ? "donación" : "donaciones"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
