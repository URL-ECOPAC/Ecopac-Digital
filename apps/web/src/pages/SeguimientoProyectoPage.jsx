import { useState } from "react";
import { ETIQUETAS_ESTADO_PROYECTO, useSeguimientoProyecto } from "@ecopac/shared";
import { Container, Row, Col, Card, Form, Button, Badge, Alert, Spinner } from "react-bootstrap";

import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import StatusChip from "../components/StatusChip";
import ModalHito from "./ModalHito";
import SecondaryButton from "../components/SecondaryButton";

export default function SeguimientoProyectoPage({
  proyectoId,
  proyectoInicial,
  usuarioActual = "Usuario Actual",
  onVolver,
}) {
  const {
    proyecto,
    hitos,
    bitacora,
    indicadoresJornadas,
    campos,
    cargando,
    errorCarga,
    nuevoPorcentaje,
    setNuevoPorcentaje,
    nuevaNota,
    setNuevaNota,
    errorAccion,
    erroresHito,
    cargandoAccion,
    guardarSeguimiento,
    cambiarEstadoHito,
    guardarHito,
  } = useSeguimientoProyecto({ proyectoId, proyectoInicial });

  const [hitoEnEdicion, setHitoEnEdicion] = useState(null);
  const [formularioHitoAbierto, setFormularioHitoAbierto] = useState(false);

  const proyectoDatos = proyecto || proyectoInicial;

  if (cargando && !proyectoDatos) {
    return (
      <Container className="my-5 text-center">
        <Spinner animation="border" />
      </Container>
    );
  }

  if (!proyectoDatos) {
    return (
      <Container className="my-5 text-center">
        <p className="text-muted">
          {errorCarga?.mensaje || "No se seleccionó ningún proyecto para el seguimiento."}
        </p>
        {onVolver && (
          <Button variant="secondary" size="sm" onClick={onVolver} className="mt-2">
            Volver
          </Button>
        )}
      </Container>
    );
  }

  const abrirAltaHito = () => {
    setHitoEnEdicion(null);
    setFormularioHitoAbierto(true);
  };

  const abrirEdicionHito = (hito) => {
    setHitoEnEdicion(hito);
    setFormularioHitoAbierto(true);
  };

  return (
    <ScreenContainer>
      {/* Encabezado. "Volver al listado" era un enlace suelto encima del titulo y el estado un
          Badge azul de Bootstrap con la clave cruda del enum: ahora es una accion neutra de la
          cabecera y el mismo StatusChip, con su etiqueta, que usa el listado. */}
      <PageHeader
        title={proyectoDatos.nombre || "Proyecto sin título"}
        subtitle={proyectoDatos.descripcion || "Sin descripción disponible."}
        actions={
          onVolver ? [{ label: "Volver al listado", onClick: onVolver, variant: "neutra" }] : []
        }
      >
        {proyectoDatos.estado && (
          <div className="mt-2">
            <StatusChip
              status={proyectoDatos.estado}
              label={ETIQUETAS_ESTADO_PROYECTO[proyectoDatos.estado] ?? proyectoDatos.estado}
            />
          </div>
        )}
      </PageHeader>

      {/* Indicadores Agregados */}
      <Row className="g-3 mb-4">
        <Col sm={6} lg={4}>
          <Card className="border shadow-sm h-100">
            <Card.Body>
              <Card.Subtitle className="text-uppercase text-muted extra-small fw-bold mb-1">
                Total Jornadas
              </Card.Subtitle>
              <Card.Title className="fs-2 fw-bold text-dark mb-0">
                {indicadoresJornadas.totalJornadas}
              </Card.Title>
            </Card.Body>
          </Card>
        </Col>

        <Col sm={6} lg={4}>
          <Card className="border shadow-sm h-100">
            <Card.Body>
              <Card.Subtitle className="text-uppercase text-muted extra-small fw-bold mb-1">
                Jornadas Completadas
              </Card.Subtitle>
              <Card.Title className="fs-2 fw-bold text-success mb-0">
                {indicadoresJornadas.completadas}
              </Card.Title>
            </Card.Body>
          </Card>
        </Col>

        <Col sm={6} lg={4}>
          <Card className="border shadow-sm h-100">
            <Card.Body>
              <Card.Subtitle className="text-uppercase text-muted extra-small fw-bold mb-1">
                Presupuesto Asignado
              </Card.Subtitle>
              <Card.Title className="fs-2 fw-bold text-dark mb-0">
                Q{indicadoresJornadas.presupuestoTotal.toLocaleString()}
              </Card.Title>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-4">
        {/* Columna Izquierda: Avance y Bitácora */}
        <Col lg={8}>
          <Card className="border shadow-sm mb-4">
            <Card.Body className="p-4">
              <Card.Title as="h5" className="mb-3 text-dark fw-bold">
                Actualizar Avance y Bitácora
              </Card.Title>

              {errorAccion && (
                <Alert variant="danger" className="py-2 px-3 small mb-3">
                  {errorAccion}
                </Alert>
              )}

              <Form className="d-flex flex-column gap-3">
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <Form.Label className="small fw-medium mb-0">
                      Porcentaje de avance (%)
                    </Form.Label>
                    <span className="fw-bold text-primary">{nuevoPorcentaje}%</span>
                  </div>
                  <Form.Range
                    min={0}
                    max={100}
                    value={nuevoPorcentaje}
                    onChange={(e) => setNuevoPorcentaje(Number(e.target.value))}
                  />
                </div>

                <Form.Group>
                  <Form.Label className="small fw-medium mb-1">Nota de seguimiento</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={nuevaNota}
                    onChange={(e) => setNuevaNota(e.target.value)}
                    placeholder="Escribe los detalles o avances alcanzados..."
                  />
                </Form.Group>

                <div className="d-flex justify-content-end">
                  <Button variant="primary" onClick={guardarSeguimiento} disabled={cargandoAccion}>
                    {cargandoAccion ? "Guardando..." : "Guardar Actualización"}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>

          <Card className="border shadow-sm">
            <Card.Body className="p-4">
              <Card.Title as="h5" className="mb-3 text-dark fw-bold">
                Bitácora de Notas
              </Card.Title>

              {bitacora.length === 0 ? (
                <p className="text-muted fst-italic text-center py-3 mb-0 small">
                  No hay notas de seguimiento registradas.
                </p>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {bitacora.map((item) => (
                    <Card key={item.id} className="bg-light border-0">
                      <Card.Body className="p-3">
                        {item.nota ? (
                          <p className="small mb-2 text-dark">{item.nota}</p>
                        ) : (
                          <p className="small mb-2 text-muted fst-italic">
                            Avance actualizado a {item.porcentajeNuevo}%
                            {item.porcentajeAnterior != null
                              ? ` (antes ${item.porcentajeAnterior}%)`
                              : ""}
                            .
                          </p>
                        )}
                        <div className="d-flex justify-content-between text-muted extra-small pt-2 border-top">
                          <span>
                            Registrado por: <strong>{item.registradoPor || usuarioActual}</strong>
                          </span>
                          <span>
                            {item.createdAt
                              ? new Date(item.createdAt).toLocaleString()
                              : "Recientemente"}
                          </span>
                        </div>
                      </Card.Body>
                    </Card>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Columna Derecha: Hitos */}
        <Col lg={4}>
          <Card className="border shadow-sm">
            <Card.Body className="p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="ec-seccion-titulo mb-0">Hitos del proyecto</h2>
                <SecondaryButton title="Agregar hito" size="sm" onClick={abrirAltaHito} />
              </div>

              {hitos.length === 0 ? (
                <p className="text-muted fst-italic text-center py-3 mb-0 small">
                  No hay hitos asignados a este proyecto.
                </p>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {hitos.map((hito) => {
                    let cardVariant = "bg-white border";
                    if (hito.esVencido) cardVariant = "bg-danger-subtle border-danger";
                    else if (hito.esCumplido)
                      cardVariant = "bg-success-subtle border-success-subtle";

                    return (
                      <div key={hito.id} className={`p-3 rounded ${cardVariant}`}>
                        <div className="d-flex align-items-start gap-2">
                          <Form.Check
                            type="checkbox"
                            checked={hito.esCumplido}
                            onChange={(e) => cambiarEstadoHito(hito.id, e.target.checked)}
                            className="mt-1"
                          />
                          <div className="flex-grow-1">
                            <p
                              className={`small fw-medium mb-1 ${
                                hito.esCumplido
                                  ? "text-decoration-line-through text-muted"
                                  : "text-dark"
                              }`}
                            >
                              {hito.nombre}
                            </p>
                            <p className="extra-small text-muted mb-0">
                              Previsto: {hito.fechaPrevista || "Sin fecha"}
                            </p>
                            {hito.esVencido && (
                              <Badge bg="danger" className="mt-1">
                                ¡Vencido!
                              </Badge>
                            )}
                            {hito.esCumplido && hito.fechaReal && (
                              <p className="extra-small text-success mt-1 mb-0">
                                Cumplido el: {hito.fechaReal}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 text-decoration-none"
                            onClick={() => abrirEdicionHito(hito)}
                          >
                            Corregir
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <ModalHito
        visible={formularioHitoAbierto}
        hito={hitoEnEdicion}
        campos={campos}
        errores={erroresHito}
        onClose={() => setFormularioHitoAbierto(false)}
        onGuardar={guardarHito}
      />
    </ScreenContainer>
  );
}
