import { Link } from "react-router-dom";
import { ESTADOS_PROYECTO, ETIQUETAS_ESTADO_PROYECTO, useProyectosSociales } from "@ecopac/shared";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Table,
  Badge,
  ProgressBar,
  Modal,
  Nav,
  Alert,
  Spinner,
} from "react-bootstrap";

export default function ProyectosSocialesPage({ usuarioRol }) {
  const {
    tieneAccesoLectura,
    cargando,
    error,
    proyectos,
    proyectoDetalle,
    jornadasProyecto,
    puedeEditar,
    filtrosState,
    setFiltrosState,
    setProyectoSeleccionadoId,
    tabActivo,
    setTabActivo,
  } = useProyectosSociales({ usuarioRol });

  if (!tieneAccesoLectura) {
    return (
      <Container className="my-4">
        <Alert variant="danger">
          Acceso denegado: No tiene permisos para consultar este módulo.
        </Alert>
      </Container>
    );
  }

  return (
    <Container fluid style={{ maxWidth: "1140px" }} className="py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-1 text-dark">Proyectos Sociales</h1>
          <p className="text-muted small mb-0">
            Gestión de proyectos, presupuestos y jornadas de campo
          </p>
        </div>
        {puedeEditar && <Button variant="primary">+ Nuevo Proyecto</Button>}
      </div>

      {error && (
        <Alert variant="danger">
          No se pudieron cargar los proyectos: {error.mensaje || "error inesperado."}
        </Alert>
      )}

      {/* Controles de Filtrado */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Body>
          <Row className="g-3">
            <Col md={4} lg={3}>
              <Form.Group>
                <Form.Label className="small fw-semibold text-secondary mb-1">Estado</Form.Label>
                <Form.Select
                  value={filtrosState.estado}
                  onChange={(e) =>
                    setFiltrosState((prev) => ({
                      ...prev,
                      estado: e.target.value,
                    }))
                  }
                >
                  <option value="">Todos los estados</option>
                  <option value="Planificación">Planificación</option>
                  <option value="En Ejecución">En Ejecución</option>
                  <option value="Finalizado">Finalizado</option>
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={5} lg={4}>
              <Form.Group>
                <Form.Label className="small fw-semibold text-secondary mb-1">
                  Responsable
                </Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Filtrar por responsable..."
                  value={filtrosState.responsable}
                  onChange={(e) =>
                    setFiltrosState((prev) => ({
                      ...prev,
                      responsable: e.target.value,
                    }))
                  }
                />
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Tabla de Proyectos */}
      <Card className="border-0 shadow-sm overflow-hidden mb-4">
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0 align-middle">
            <thead className="table-light text-uppercase fs-7 text-muted">
              <tr>
                <th className="py-3 px-3">Nombre</th>
                <th className="py-3 px-3">Responsable</th>
                <th className="py-3 px-3">Fechas</th>
                <th className="py-3 px-3">Estado</th>
                <th className="py-3 px-3" style={{ minWidth: "140px" }}>
                  Avance
                </th>
                <th className="py-3 px-3 text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted py-4">
                    <Spinner animation="border" size="sm" className="me-2" />
                    Cargando proyectos...
                  </td>
                </tr>
              ) : proyectos.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted py-4">
                    No hay proyectos que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                proyectos.map((p) => (
                  <tr
                    key={p.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setProyectoSeleccionadoId(p.id)}
                  >
                    <td className="py-3 px-3 fw-medium text-dark">{p.nombre}</td>
                    <td className="py-3 px-3 text-secondary">{p.responsableNombre || "-"}</td>
                    <td className="py-3 px-3 text-muted small">
                      {p.fechaInicio || "-"} - {p.fechaFin || "-"}
                    </td>
                    <td className="py-3 px-3">
                      <Badge bg={p.estado === ESTADOS_PROYECTO.EN_CURSO ? "success" : "secondary"}>
                        {ETIQUETAS_ESTADO_PROYECTO[p.estado] ?? p.estado}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      <ProgressBar
                        now={p.porcentajeAvance || 0}
                        variant="primary"
                        style={{ height: "8px" }}
                      />
                      <span className="extra-small text-muted d-block mt-1">
                        {p.porcentajeAvance || 0}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-end">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProyectoSeleccionadoId(p.id);
                        }}
                      >
                        Ver Detalle
                      </Button>
                      {/* El proyecto viaja en el state para que el seguimiento no repita la
                          consulta que este listado ya hizo. */}
                      <Button
                        as={Link}
                        to={`/proyectos/${p.id}/seguimiento`}
                        state={{ proyecto: p }}
                        variant="outline-secondary"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Seguimiento
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* Modal / Panel de Detalle */}
      {proyectoDetalle && (
        <Modal
          show={!!proyectoDetalle}
          onHide={() => setProyectoSeleccionadoId(null)}
          centered
          size="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title as="h5">{proyectoDetalle.nombre}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="text-secondary small mb-3">{proyectoDetalle.descripcion}</p>

            {/* Tabs de Detalle */}
            <Nav
              variant="tabs"
              activeKey={tabActivo}
              onSelect={(selectedKey) => setTabActivo(selectedKey)}
              className="mb-3"
            >
              {["resumen", "equipo", "jornadas", "insumos", "gastos"].map((tab) => (
                <Nav.Item key={tab}>
                  <Nav.Link eventKey={tab} className="text-capitalize">
                    {tab}
                  </Nav.Link>
                </Nav.Item>
              ))}
            </Nav>

            {/* Contenido según Tab Activo */}
            {tabActivo === "resumen" && (
              <div className="fs-6 space-y-2">
                <p className="mb-2">
                  <strong>Responsable:</strong> {proyectoDetalle.responsableNombre || "-"}
                </p>
                <p className="mb-2">
                  <strong>Presupuesto:</strong> Q {proyectoDetalle.presupuesto || "0.00"}
                </p>
                <p className="mb-0">
                  <strong>Avance actual:</strong> {proyectoDetalle.porcentajeAvance || 0}%
                </p>
              </div>
            )}

            {tabActivo === "jornadas" && (
              <div>
                <h6 className="fw-bold mb-3">Jornadas Asociadas</h6>
                {jornadasProyecto.length > 0 ? (
                  <ul className="list-group list-group-flush border-top border-bottom">
                    {jornadasProyecto.map((j) => (
                      <li
                        key={j.id}
                        className="list-group-item d-flex justify-content-between align-items-center px-0 py-2"
                      >
                        <span>{j.nombre}</span>
                        <span className="text-muted small">{j.fecha}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted small mb-0">
                    No hay jornadas asociadas a este proyecto.
                  </p>
                )}
              </div>
            )}

            {tabActivo === "gastos" && (
              <Alert variant="warning" className="mb-0 py-2 px-3 small">
                El tab Gastos depende del módulo de Presupuestos (#274), actualmente pendiente de
                asignación.
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setProyectoSeleccionadoId(null)}>
              Cerrar
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </Container>
  );
}
