import { useLocation } from "react-router-dom";
import { useSeguimientoProyecto } from "@ecopac/shared";
import { Container, Row, Col, Card, Form, Button, Badge, Alert } from "react-bootstrap";

export default function SeguimientoProyectoPage({
  proyectoInicial: propProyectoInicial,
  hitosIniciales: propHitos = [],
  bitacoraInicial: propBitacora = [],
  jornadasIniciales: propJornadas = [],
  usuarioActual = "Usuario Actual",
  onVolver,
}) {
  const location = useLocation();
  const state = location.state || {};

  // Resolución de propiedades (prioriza props directas, luego router location.state)
  const proyectoInicial = propProyectoInicial || state.proyectoInicial || state.proyecto;
  const hitosIniciales =
    propHitos.length > 0
      ? propHitos
      : state.hitosIniciales || proyectoInicial?.hitosIniciales || [];
  const bitacoraInicial =
    propBitacora.length > 0
      ? propBitacora
      : state.bitacoraInicial || proyectoInicial?.bitacoraInicial || [];
  const jornadasIniciales =
    propJornadas.length > 0
      ? propJornadas
      : state.jornadasIniciales || proyectoInicial?.jornadasIniciales || [];

  const {
    proyecto,
    hitos,
    bitacora,
    indicadoresJornadas,
    nuevoPorcentaje,
    setNuevoPorcentaje,
    nuevaNota,
    setNuevaNota,
    errorAccion,
    cargando,
    guardarSeguimiento,
    cambiarEstadoHito,
  } = useSeguimientoProyecto({
    proyectoInicial,
    hitosIniciales,
    bitacoraInicial,
    jornadasIniciales,
    usuarioActual,
  });

  const proyectoDatos = proyecto || proyectoInicial;

  if (!proyectoDatos) {
    return (
      <Container className="my-5 text-center">
        <p className="text-muted">No se seleccionó ningún proyecto para el seguimiento.</p>
        {onVolver && (
          <Button variant="secondary" size="sm" onClick={onVolver} className="mt-2">
            Volver
          </Button>
        )}
      </Container>
    );
  }

  const parsearPresupuesto = (valor) => {
    if (typeof valor === "number") return valor;
    if (typeof valor === "string") {
      const limpio = valor.replace(/[^0-9.]/g, "");
      return parseFloat(limpio) || 0;
    }
    return 0;
  };

  const totalJornadas =
    indicadoresJornadas?.totalJornadas ||
    proyectoDatos.totalJornadas ||
    jornadasIniciales.length ||
    0;

  const jornadasCompletadas =
    indicadoresJornadas?.completadas || proyectoDatos.jornadasCompletadas || 0;

  const presupuestoTotal =
    indicadoresJornadas?.presupuestoTotal && indicadoresJornadas.presupuestoTotal > 0
      ? indicadoresJornadas.presupuestoTotal
      : parsearPresupuesto(proyectoDatos.presupuestoTotal || proyectoDatos.presupuesto);

  const beneficiariosTotales =
    indicadoresJornadas?.beneficiariosTotales ||
    proyectoDatos.beneficiariosAlcanzados ||
    proyectoDatos.beneficiarios ||
    0;

  return (
    <Container fluid style={{ maxWidth: "1140px" }} className="py-4">
      {/* Encabezado */}
      <div className="border-bottom pb-3 mb-4 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3">
        <div>
          {onVolver && (
            <Button
              variant="link"
              onClick={onVolver}
              className="p-0 text-decoration-none text-primary mb-2 small d-inline-flex align-items-center gap-1"
            >
              ← Volver al listado
            </Button>
          )}
          <h1 className="h3 mb-1 text-dark">{proyectoDatos.nombre || "Proyecto sin título"}</h1>
          <p className="text-muted small mb-0">
            {proyectoDatos.descripcion || "Sin descripción disponible."}
          </p>
        </div>
        <div>
          <Badge bg="primary" className="fs-6 px-3 py-2 fw-normal text-capitalize">
            {proyectoDatos.estado || "planificada"}
          </Badge>
        </div>
      </div>

      {/* Indicadores Agregados */}
      <Row className="g-3 mb-4">
        <Col sm={6} lg={3}>
          <Card className="border shadow-sm h-100">
            <Card.Body>
              <Card.Subtitle className="text-uppercase text-muted extra-small fw-bold mb-1">
                Total Jornadas
              </Card.Subtitle>
              <Card.Title className="fs-2 fw-bold text-dark mb-0">{totalJornadas}</Card.Title>
            </Card.Body>
          </Card>
        </Col>

        <Col sm={6} lg={3}>
          <Card className="border shadow-sm h-100">
            <Card.Body>
              <Card.Subtitle className="text-uppercase text-muted extra-small fw-bold mb-1">
                Jornadas Completadas
              </Card.Subtitle>
              <Card.Title className="fs-2 fw-bold text-success mb-0">
                {jornadasCompletadas}
              </Card.Title>
            </Card.Body>
          </Card>
        </Col>

        <Col sm={6} lg={3}>
          <Card className="border shadow-sm h-100">
            <Card.Body>
              <Card.Subtitle className="text-uppercase text-muted extra-small fw-bold mb-1">
                Presupuesto Total
              </Card.Subtitle>
              <Card.Title className="fs-2 fw-bold text-dark mb-0">
                Q{presupuestoTotal.toLocaleString()}
              </Card.Title>
            </Card.Body>
          </Card>
        </Col>

        <Col sm={6} lg={3}>
          <Card className="border shadow-sm h-100">
            <Card.Body>
              <Card.Subtitle className="text-uppercase text-muted extra-small fw-bold mb-1">
                Beneficiarios Alcanzados
              </Card.Subtitle>
              <Card.Title className="fs-2 fw-bold text-primary mb-0">
                {beneficiariosTotales}
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
                  <Button variant="primary" onClick={guardarSeguimiento} disabled={cargando}>
                    {cargando ? "Guardando..." : "Guardar Actualización"}
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
                        <p className="small mb-2 text-dark">{item.nota}</p>
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
              <Card.Title as="h5" className="mb-3 text-dark fw-bold">
                Hitos del Proyecto
              </Card.Title>

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
    </Container>
  );
}
