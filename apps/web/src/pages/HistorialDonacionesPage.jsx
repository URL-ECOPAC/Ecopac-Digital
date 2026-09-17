import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ESTADOS_DE_DONACION,
  ETIQUETAS_TIPO_DONACION,
  TIPOS_DE_DONACION,
  useHistorialDonaciones,
} from "@ecopac/shared";
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
  Spinner,
} from "react-bootstrap";

import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";

export default function HistorialDonacionesPage({ usuarioRol, proyectosOptions = [] }) {
  const {
    tieneAccesoLectura,
    cargando,
    error,
    donaciones,
    totalesPorTipo,
    filtros,
    modalDetalle,
    anulacion,
  } = useHistorialDonaciones({ usuarioRol });

  // Issue #756: motivo de anulacion, local a la pantalla porque solo una donacion esta
  // seleccionada a la vez (el modal de detalle ya es el contexto de "cual").
  const [anulando, setAnulando] = useState(false);
  const [motivoAnular, setMotivoAnular] = useState("");

  const cerrarDetalleYAnulacion = () => {
    setAnulando(false);
    setMotivoAnular("");
    modalDetalle.cerrarDetalle();
  };

  const confirmarAnulacion = async () => {
    const resultado = await anulacion.anular(modalDetalle.donacionSeleccionada.id, motivoAnular);
    if (resultado.ok) {
      setAnulando(false);
      setMotivoAnular("");
    }
  };

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
    <ScreenContainer>
      <PageHeader
        title="Historial de donaciones recibidas"
        subtitle="Consulta, detalle y anulación de las donaciones registradas"
      />

      {error && (
        <Alert variant="danger">
          No se pudo cargar el historial: {error.mensaje || "error inesperado."}
        </Alert>
      )}

      {/* Totales por Tipo */}
      <Row className="g-3 mb-4">
        <Col md={4}>
          <Card className="border-primary bg-light">
            <Card.Body>
              <Card.Subtitle className="mb-2 text-primary fw-semibold">
                Total en dinero
              </Card.Subtitle>
              <Card.Title className="fs-3 fw-bold text-dark mb-0">
                Q {Number(totalesPorTipo?.dinero || 0).toFixed(2)}
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
                {Object.values(TIPOS_DE_DONACION).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {ETIQUETAS_TIPO_DONACION[tipo]}
                  </option>
                ))}
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
            <Button variant="outline-secondary" size="sm" onClick={filtros.limpiarFiltros}>
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
              {cargando ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted py-4">
                    <Spinner animation="border" size="sm" className="me-2" />
                    Cargando donaciones...
                  </td>
                </tr>
              ) : (donaciones || []).length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted py-4">
                    No se encontraron registros de donaciones con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                donaciones.map((d) => {
                  const esAnulada = d.estado === ESTADOS_DE_DONACION.ANULADA;
                  return (
                    <tr key={d.id} className={esAnulada ? "table-danger text-muted" : ""}>
                      <td>{d.fecha}</td>
                      <td className="fw-semibold">{d.donanteNombre || "-"}</td>
                      <td>{ETIQUETAS_TIPO_DONACION[d.tipo] ?? d.tipo}</td>
                      <td>{esAnulada ? <del>{d.resumen || "-"}</del> : d.resumen || "-"}</td>
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
                          className="me-2"
                          onClick={() => modalDetalle.abrirDetalle(d)}
                        >
                          Ver Detalle
                        </Button>
                        {/* La fila viaja en el state para que la constancia se dibuje sin una
                            segunda consulta; si se entra por URL la resuelve obtenerDonacion(). */}
                        <Button
                          as={Link}
                          to={`/donaciones/${d.id}/constancia`}
                          state={{ donacion: d }}
                          variant="outline-secondary"
                          size="sm"
                        >
                          Constancia
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
        <Modal show={modalDetalle.modalDetalleAbierto} onHide={cerrarDetalleYAnulacion} centered>
          <Modal.Header closeButton>
            <Modal.Title as="h5">
              Detalle de Donación #{modalDetalle.donacionSeleccionada.id}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="mb-3">
              <p className="mb-1">
                <strong>Donante:</strong> {modalDetalle.donacionSeleccionada.donanteNombre || "-"}
              </p>
              <p className="mb-1">
                <strong>Tipo:</strong>{" "}
                {ETIQUETAS_TIPO_DONACION[modalDetalle.donacionSeleccionada.tipo] ??
                  modalDetalle.donacionSeleccionada.tipo}
              </p>
              <p className="mb-1">
                <strong>Fecha:</strong> {modalDetalle.donacionSeleccionada.fecha}
              </p>
              <p className="mb-1">
                <strong>Estado:</strong> {modalDetalle.donacionSeleccionada.estado}
              </p>
            </div>

            {modalDetalle.donacionSeleccionada.estado === ESTADOS_DE_DONACION.ANULADA && (
              <Alert variant="danger" className="mb-3">
                <p className="mb-1">
                  <strong>Motivo de Anulación:</strong>{" "}
                  {modalDetalle.donacionSeleccionada.motivoAnulacion || "No informado"}
                </p>
                <p className="mb-1">
                  <strong>Anulada por:</strong>{" "}
                  {modalDetalle.donacionSeleccionada.anuladaPorNombre || "-"}
                </p>
                <p className="mb-0">
                  <strong>Fecha de Anulación:</strong>{" "}
                  {modalDetalle.donacionSeleccionada.anuladaEn || "-"}
                </p>
              </Alert>
            )}

            <hr />
            <h6 className="fw-bold mb-2">Renglones del Detalle:</h6>
            <ul className="mb-0 ps-3">
              {(modalDetalle.donacionSeleccionada.detalles || []).length === 0 ? (
                <li>Sin detalles registrados</li>
              ) : (
                modalDetalle.donacionSeleccionada.detalles.map((item) => (
                  <li key={item.id}>
                    {item.descripcion}
                    {item.cantidad !== null && item.cantidad !== undefined
                      ? ` - ${item.cantidad} ${item.unidad || "unidades"}`
                      : ""}
                    {item.monto !== null && item.monto !== undefined
                      ? ` - Q ${Number(item.monto).toFixed(2)}`
                      : ""}
                  </li>
                ))
              )}
            </ul>

            {/* Issue #756: anularDonacion() ya existia (issue #635), sin ningun boton que la
                llamara. */}
            {anulacion.puedeAnular &&
              modalDetalle.donacionSeleccionada.estado !== ESTADOS_DE_DONACION.ANULADA && (
                <>
                  <hr />
                  {anulacion.errorAnular && (
                    <Alert variant="danger" className="py-2">
                      {anulacion.errorAnular.mensaje}
                    </Alert>
                  )}
                  {anulando ? (
                    <Form.Group controlId="formMotivoAnulacion">
                      <Form.Label>Motivo de la anulación</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={motivoAnular}
                        onChange={(e) => setMotivoAnular(e.target.value)}
                        disabled={anulacion.anulando}
                      />
                    </Form.Group>
                  ) : (
                    <Button variant="outline-danger" size="sm" onClick={() => setAnulando(true)}>
                      Anular donación
                    </Button>
                  )}
                </>
              )}
          </Modal.Body>
          <Modal.Footer>
            {anulando ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAnulando(false);
                    setMotivoAnular("");
                  }}
                  disabled={anulacion.anulando}
                >
                  Cancelar anulación
                </Button>
                <Button
                  variant="danger"
                  onClick={confirmarAnulacion}
                  disabled={anulacion.anulando || !motivoAnular.trim()}
                >
                  {anulacion.anulando ? "Anulando..." : "Confirmar anulación"}
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={cerrarDetalleYAnulacion}>
                Cerrar
              </Button>
            )}
          </Modal.Footer>
        </Modal>
      )}
    </ScreenContainer>
  );
}
