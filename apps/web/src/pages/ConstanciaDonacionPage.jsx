import { useConstanciaDonacion } from "@ecopac/shared";
import {
  Container,
  Row,
  Col,
  Button,
  Table,
  Card,
  Badge,
  Alert,
} from "react-bootstrap";

export default function ConstanciaDonacionPage({ usuarioRol, donacion }) {
  const {
    tieneAccesoLectura,
    esValidaParaConstancia,
    correlativo,
    manejarImpresion,
  } = useConstanciaDonacion({
    usuarioRol,
    donacion,
    onImprimir: () => window.print(),
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

  if (!donacion) {
    return (
      <Container className="my-4">
        <Alert variant="secondary">
          No se ha seleccionado ninguna donación.
        </Alert>
      </Container>
    );
  }

  if (!esValidaParaConstancia) {
    return (
      <Container style={{ maxWidth: "720px" }} className="my-5">
        <Alert variant="danger">
          <Alert.Heading as="h5">Constancia No Disponible</Alert.Heading>
          <p className="mb-0">
            Esta donación se encuentra en estado <strong>ANULADA</strong>. Las
            donaciones anuladas no pueden generar una constancia de respaldo.
          </p>
        </Alert>
      </Container>
    );
  }

  return (
    <Container style={{ maxWidth: "800px" }} className="py-4">
      {/* Botones de acción (Ocultos al imprimir) */}
      <div className="d-flex justify-content-end mb-4 d-print-none">
        <Button variant="primary" onClick={manejarImpresion}>
          Imprimir / Descargar PDF
        </Button>
      </div>

      {/* Documento Imprimible */}
      <Card className="shadow-sm border border-secondary-subtle p-4 p-md-5 d-print-block">
        <Card.Body className="p-0">
          {/* Encabezado de la Organización */}
          <div className="border-bottom pb-3 mb-4 d-flex justify-content-between align-items-center">
            <div>
              <h1 className="h4 fw-bold text-uppercase mb-1 tracking-wide">
                Ecopac Digital
              </h1>
              <p className="small text-muted mb-0">
                Comité Agrícola de Desarrollo Integral
              </p>
              <p className="extra-small text-muted mb-0">
                Guatemala · Registro de Aportes y Donaciones
              </p>
            </div>
            <div className="text-end">
              <Badge bg="secondary" className="font-monospace fs-6 px-3 py-2">
                {correlativo}
              </Badge>
              <p className="small text-muted mt-2 mb-0">
                Fecha: {donacion.fecha}
              </p>
            </div>
          </div>

          <h2 className="h5 text-center text-dark fw-bold mb-4 text-decoration-underline">
            CONSTANCIA DE DONACIÓN RECIBIDA
          </h2>

          {/* Datos del Donante */}
          <Card className="bg-light border mb-4">
            <Card.Body className="p-3 fs-6">
              <p className="mb-1">
                <strong>Donante:</strong> {donacion.donante_nombre}
              </p>
              <p className="mb-1">
                <strong>Identificación / Teléfono:</strong>{" "}
                {donacion.donante_contacto || "N/A"}
              </p>
              <p className="mb-1">
                <strong>Tipo de Aporte:</strong>{" "}
                <span className="text-capitalize">{donacion.tipo}</span>
              </p>
              <p className="mb-0">
                <strong>Proyecto Asignado:</strong>{" "}
                {donacion.proyecto_nombre || "Fondo General"}
              </p>
            </Card.Body>
          </Card>

          {/* Detalle de lo donado */}
          <div className="mb-5">
            <h6 className="fw-bold mb-3">Detalle del Aporte</h6>
            <Table bordered responsive size="sm" className="align-middle">
              <thead className="table-light">
                <tr>
                  <th className="text-center" style={{ width: "50px" }}>
                    #
                  </th>
                  <th>Concepto / Descripción</th>
                  <th className="text-end" style={{ width: "180px" }}>
                    Cantidad / Monto
                  </th>
                </tr>
              </thead>
              <tbody>
                {(donacion.detalles || []).length === 0 ? (
                  <tr>
                    <td colSpan="3" className="text-center text-muted py-3">
                      Sin detalles especificantes
                    </td>
                  </tr>
                ) : (
                  donacion.detalles.map((item, index) => (
                    <tr key={index}>
                      <td className="text-center">{index + 1}</td>
                      <td>{item.concepto}</td>
                      <td className="text-end fw-medium">
                        {donacion.tipo === "economica"
                          ? `Q ${Number(item.monto || 0).toFixed(2)}`
                          : item.cantidad}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          {/* Firmas de Respaldo */}
          <Row className="pt-5 mt-5 border-top text-center text-muted fs-7">
            <Col xs={6}>
              <div
                className="border-bottom border-dark mx-auto mb-2"
                style={{ width: "75%" }}
              ></div>
              <p className="fw-semibold mb-0">Firma de Conformidad Donante</p>
            </Col>
            <Col xs={6}>
              <div
                className="border-bottom border-dark mx-auto mb-2"
                style={{ width: "75%" }}
              ></div>
              <p className="fw-semibold mb-0">
                Por Ecopac Digital (Administración)
              </p>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </Container>
  );
}