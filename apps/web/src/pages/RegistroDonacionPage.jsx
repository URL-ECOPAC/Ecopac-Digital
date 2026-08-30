import { useRegistroDonacion } from "@ecopac/shared";
import { Container, Row, Col, Card, Form, Button, Alert, Modal } from "react-bootstrap";

export default function RegistroDonacionPage({ usuarioRol }) {
  const {
    permisos,
    tipoDonacion,
    setTipoDonacion,
    donanteId,
    setDonanteId,
    proyectoId,
    setProyectoId,
    fecha,
    setFecha,
    detalles,
    agregarRenglon,
    quitarRenglon,
    actualizarRenglon,
    modalNuevoDonante,
    setModalNuevoDonante,
    ofrecerIngresoInventario,
    setOfrecerIngresoInventario,
    resumenRegistro,
    guardando,
    guardarDonacion,
    donantesOptions = [],
    proyectosOptions = [],
  } = useRegistroDonacion({ usuarioRol });

  if (!permisos?.tieneAccesoLectura) {
    return (
      <Container className="my-4">
        <Alert variant="danger">
          Acceso denegado: No tiene permisos para consultar este módulo.
        </Alert>
      </Container>
    );
  }

  return (
    <Container tabIndex="-1" style={{ maxWidth: "960px" }} className="py-4">
      <h1 className="h3 mb-4">Registro de Donación</h1>

      {!permisos?.puedeEscribir && (
        <Alert variant="warning" className="mb-4">
          Modo de solo lectura: Únicamente el rol Administrador puede registrar donaciones.
        </Alert>
      )}

      <Card className="mb-4">
        <Card.Header as="h5">Información General</Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Group controlId="formTipoDonacion">
                <Form.Label>Tipo de Donación</Form.Label>
                <Form.Select
                  disabled={!permisos?.puedeEscribir}
                  value={tipoDonacion}
                  onChange={(e) => setTipoDonacion(e.target.value)}
                >
                  <option value="economica">Económica</option>
                  <option value="medicamentos">Medicamentos</option>
                  <option value="insumos">Insumos / Bienes</option>
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group controlId="formFecha">
                <Form.Label>Fecha</Form.Label>
                <Form.Control
                  type="date"
                  disabled={!permisos?.puedeEscribir}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group controlId="formDonante">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <Form.Label className="mb-0">Donante</Form.Label>
                  {permisos?.puedeEscribir && (
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 text-decoration-none"
                      onClick={() => setModalNuevoDonante(true)}
                    >
                      + Nuevo Donante
                    </Button>
                  )}
                </div>
                <Form.Select
                  disabled={!permisos?.puedeEscribir}
                  value={donanteId}
                  onChange={(e) => setDonanteId(e.target.value)}
                >
                  <option value="">Seleccione un donante...</option>
                  {donantesOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group controlId="formProyecto">
                <Form.Label>Proyecto Asociado</Form.Label>
                <Form.Select
                  disabled={!permisos?.puedeEscribir}
                  value={proyectoId}
                  onChange={(e) => setProyectoId(e.target.value)}
                >
                  <option value="">Sin proyecto asociado...</option>
                  {proyectosOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Header as="h5">Detalle de la Donación</Card.Header>
        <Card.Body>
          {(detalles || []).map((item) => (
            <Row key={item.id} className="g-2 align-items-center mb-3">
              {tipoDonacion === "economica" && (
                <>
                  <Col md={7}>
                    <Form.Control
                      placeholder="Concepto / Observación"
                      disabled={!permisos?.puedeEscribir}
                      value={item.concepto || ""}
                      onChange={(e) => actualizarRenglon(item.id, "concepto", e.target.value)}
                    />
                  </Col>
                  <Col md={4}>
                    <Form.Control
                      type="number"
                      placeholder="Monto"
                      disabled={!permisos?.puedeEscribir}
                      value={item.monto || ""}
                      onChange={(e) => actualizarRenglon(item.id, "monto", e.target.value)}
                    />
                  </Col>
                </>
              )}

              {tipoDonacion === "medicamentos" && (
                <>
                  <Col md={7}>
                    <Form.Control
                      placeholder="Nombre de Medicamento / Lote"
                      disabled={!permisos?.puedeEscribir}
                      value={item.concepto || ""}
                      onChange={(e) => actualizarRenglon(item.id, "concepto", e.target.value)}
                    />
                  </Col>
                  <Col md={4}>
                    <Form.Control
                      type="number"
                      placeholder="Cantidad"
                      disabled={!permisos?.puedeEscribir}
                      value={item.cantidad || ""}
                      onChange={(e) => actualizarRenglon(item.id, "cantidad", e.target.value)}
                    />
                  </Col>
                </>
              )}

              {tipoDonacion === "insumos" && (
                <>
                  <Col md={7}>
                    <Form.Control
                      placeholder="Descripción del insumo"
                      disabled={!permisos?.puedeEscribir}
                      value={item.concepto || ""}
                      onChange={(e) => actualizarRenglon(item.id, "concepto", e.target.value)}
                    />
                  </Col>
                  <Col md={4}>
                    <Form.Control
                      type="number"
                      placeholder="Cantidad"
                      disabled={!permisos?.puedeEscribir}
                      value={item.cantidad || ""}
                      onChange={(e) => actualizarRenglon(item.id, "cantidad", e.target.value)}
                    />
                  </Col>
                </>
              )}

              {permisos?.puedeEscribir && detalles.length > 1 && (
                <Col md={1} className="text-end">
                  <Button variant="outline-danger" size="sm" onClick={() => quitarRenglon(item.id)}>
                    ✕
                  </Button>
                </Col>
              )}
            </Row>
          ))}

          {permisos?.puedeEscribir && (
            <Button variant="outline-secondary" size="sm" onClick={agregarRenglon} className="mt-2">
              + Agregar Renglón
            </Button>
          )}
        </Card.Body>
      </Card>

      {permisos?.puedeEscribir && (
        <div className="d-flex justify-content-end mb-4">
          <Button variant="primary" onClick={guardarDonacion} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar Donación"}
          </Button>
        </div>
      )}

      {resumenRegistro && (
        <Card className="mb-4">
          <Card.Header as="h5">Resumen del Registro</Card.Header>
          <Card.Body>
            <Card.Text>
              <strong>Tipo:</strong> {resumenRegistro.tipo}
            </Card.Text>
            <Card.Text>
              <strong>Fecha:</strong> {resumenRegistro.fecha}
            </Card.Text>
            <Card.Text>
              <strong>Renglones registrados:</strong> {resumenRegistro.detalles?.length || 0}
            </Card.Text>
          </Card.Body>
        </Card>
      )}

      <Modal
        show={ofrecerIngresoInventario}
        onHide={() => setOfrecerIngresoInventario(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title as="h5">Ingreso a Inventario</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">
            Se ha registrado una donación de medicamentos. ¿Desea generar automáticamente el
            registro de ingreso en el módulo de Inventario?
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setOfrecerIngresoInventario(false)}>
            No, omitir
          </Button>
          <Button variant="primary" onClick={() => setOfrecerIngresoInventario(false)}>
            Sí, ingresar a Inventario
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={modalNuevoDonante} onHide={() => setModalNuevoDonante(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title as="h5">Registrar Nuevo Donante</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small mb-3">
            Registro rápido de donante sin salir del formulario.
          </p>
          <Form.Group controlId="formNuevoDonanteNombre">
            <Form.Control placeholder="Nombre del Donante" className="mb-3" />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setModalNuevoDonante(false)}>
            Guardar y Seleccionar
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
