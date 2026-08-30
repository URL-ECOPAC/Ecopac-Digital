import { useHistorialDonaciones } from "@ecopac/shared";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Table,
  Badge,
  Alert,
  Modal,
} from "react-bootstrap";

export default function HistorialDonacionesPage({
  usuarioRol,
  donacionesIniciales = [],
  proyectosOptions = [],
}) {
  const {
    tieneAccesoLectura,
    donaciones,
    totalesPorTipo,
    filtros,
    modalDetalle,
  } = useHistorialDonaciones({
    usuarioRol,
    donacionesIniciales,
    proyectosOptions,
  });

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
      <h1 className="h3 mb-4">Historial de Donaciones Recibidas</h1>

      {/* Totales por Tipo */}
      <Row className="g-3 mb-4">
        <Col md={4}>
          <Card className="border-primary bg-light">
            <Card.Body>
              <Card.Subtitle className="mb-2 text-primary fw-semibold">
                Total Económico
              </Card.Subtitle>
              <Card.Title className="fs-3 fw-bold text-dark mb-0">
                Q {(totalesPorTipo?.economica || 0).toFixed(2)}
              </Card.Title>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-success bg-light">
            <Card.Body>
              <Card.Subtitle className="mb-2 text-success fw-semibold">
                Total Medicamentos
              </Card.Subtitle>
              <Card.Title className="fs-3 fw-bold text-dark mb-0">
                {totalesPorTipo?.medicamentos || 0} unidades
              </Card.Title>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-info bg-light">
            <Card.Body>
              <Card.Subtitle className="mb-2 text-info fw-semibold">
                Total Insumos / Bienes
              </Card.Subtitle>
              <Card.Title className="fs-3 fw-bold text-dark mb-0">
                {totalesPorTipo?.insumos || 0} ítems
              </Card.Title>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filtros */}
      <Card className="mb-4">
        <Card.Header as="h5">Filtros de Búsqueda</Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={6} lg={3}>
              <Form.Control
                type="text"
                placeholder="Buscar por donante..."
                value={filtros.filtroDonante}
                onChange={(e) => filtros.setFiltroDonante(e.target.value)}
              />
            </Col>

            <Col md={6} lg={2}>
              <Form.Select
                value={filtros.filtroTipo}
                onChange={(e) => filtros.setFiltroTipo(e.target.value)}
              >
                <option value="">Todos los tipos</option>
                <option value="economica">Económica</option>
                <option value="medicamentos">Medicamentos</option>
                <option value="insumos">Insumos</option>
              </Form.Select>
            </Col>

            <Col md={6} lg={3}>
              <Form.Select
                value={filtros.filtroProyecto}
                onChange={(e) => filtros.setFiltroProyecto(e.target.value)}
              >
                <option value="">Todos los proyectos</option>
                {proyectosOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Form.Select>
            </Col>

            <Col md={6} lg={2}>
              <Form.Control
                type="date"
                placeholder="Desde"
                value={filtros.fechaInicio}
                onChange={(e) => filtros.setFechaInicio(e.target.value)}
              />
            </Col>

            <Col md={6} lg={2}>
              <Form.Control
                type="date"
                placeholder="Hasta"
                value={filtros.fechaFin}
                onChange={(e) => filtros.setFechaFin(e.target.value)}
              />
            </Col>
          </Row>

          <div className="d-flex justify-content-end mt-3">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={filtros.limpiarFiltros}
            >
              Limpiar Filtros
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* Tabla de Historial */}
      <Card>
        <Card.Header as="h5">Listado de Donaciones</Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover striped className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Donante</th>
                <th>Tipo</th>
                <th>Resumen Detalle</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(donaciones || []).length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted py-4">
                    No se encontraron registros de donaciones con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                donaciones.map((d) => {
                  const esAnulada = d.estado === "anulada";
                  return (
                    <tr
                      key={d.id}
                      className={esAnulada ? "table-danger text-muted" : ""}
                    >
                      <td>{d.fecha}</td>
                      <td className="fw-semibold">{d.donante_nombre}</td>
                      <td className="text-capitalize">{d.tipo}</td>
                      <td>
                        {esAnulada ? (
                          <del>{d.resumen || "-"}</del>
                        ) : (
                          d.resumen || "-"
                        )}
                      </td>
                      <td>
                        {esAnulada ? (
                          <Badge bg="danger">Anulada</Badge>
                        ) : (
                          <Badge bg="success">Activa</Badge>
                        )}
                      </td>
                      <td className="text-end">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => modalDetalle.abrirDetalle(d)}
                        >
                          Ver Detalle
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* Modal de Detalle Completo */}
      {modalDetalle.modalDetalleAbierto && modalDetalle.donacionSeleccionada && (
        <Modal
          show={modalDetalle.modalDetalleAbierto}
          onHide={modalDetalle.cerrarDetalle}
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title as="h5">
              Detalle de Donación #{modalDetalle.donacionSeleccionada.id}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="mb-3">
              <p className="mb-1">
                <strong>Donante:</strong>{" "}
                {modalDetalle.donacionSeleccionada.donante_nombre}
              </p>
              <p className="mb-1">
                <strong>Tipo:</strong> {modalDetalle.donacionSeleccionada.tipo}
              </p>
              <p className="mb-1">
                <strong>Fecha:</strong> {modalDetalle.donacionSeleccionada.fecha}
              </p>
              <p className="mb-1">
                <strong>Estado:</strong> {modalDetalle.donacionSeleccionada.estado}
              </p>
            </div>

            {modalDetalle.donacionSeleccionada.estado === "anulada" && (
              <Alert variant="danger" className="mb-3">
                <p className="mb-1">
                  <strong>Motivo de Anulación:</strong>{" "}
                  {modalDetalle.donacionSeleccionada.motivo_anulacion ||
                    "No informado"}
                </p>
                <p className="mb-1">
                  <strong>Anulada por:</strong>{" "}
                  {modalDetalle.donacionSeleccionada.anulada_por || "-"}
                </p>
                <p className="mb-0">
                  <strong>Fecha de Anulación:</strong>{" "}
                  {modalDetalle.donacionSeleccionada.anulada_en || "-"}
                </p>
              </Alert>
            )}

            <hr />
            <h6 className="fw-bold mb-2">Renglones del Detalle:</h6>
            <ul className="mb-0 ps-3">
              {(modalDetalle.donacionSeleccionada.detalles || []).length === 0 ? (
                <li>Sin detalles registrados</li>
              ) : (
                modalDetalle.donacionSeleccionada.detalles.map((item, i) => (
                  <li key={i}>
                    {item.concepto} - Cantidad/Monto: {item.cantidad || item.monto}
                  </li>
                ))
              )}
            </ul>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={modalDetalle.cerrarDetalle}>
              Cerrar
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </Container>
  );
}