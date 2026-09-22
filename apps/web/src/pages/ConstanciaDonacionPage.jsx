import {
  ETIQUETAS_TIPO_DONACION,
  TIPOS_DE_DONACION,
  formatearFechaCorta,
  formatearMoneda,
  useConstanciaDonacion,
} from "@ecopac/shared";
import { organizacion } from "@ecopac/ui-tokens";
import { Container, Row, Col, Button, Card, Badge, Alert } from "react-bootstrap";
import { AccionesDeCabecera } from "../components/PageHeader";
import DocumentoImprimible, { LineaDeFirma } from "./DocumentoImprimible";
import { ACCION_VOLVER_A_DONACIONES } from "./donacionesNavegacion";
import "./reportes.css";

function DatosDeLaDonacion({ donacion }) {
  const detalles = donacion.detalles ?? [];
  const esDinero = donacion.tipo === TIPOS_DE_DONACION.DINERO;
  const nombreDonante = donacion.donante_nombre || donacion.donanteNombre || donacion.donante?.nombre || "Anónimo";

  return (
    <>
      <div className="constancia-datos">
        <p>
          <strong>Donante:</strong> {nombreDonante}
        </p>
        <p>
          <strong>Identificación / Teléfono:</strong> {donacion.donante_contacto || donacion.donante?.contacto || "No registrado"}
        </p>
        <p>
          <strong>Tipo de aporte:</strong> {ETIQUETAS_TIPO_DONACION[donacion.tipo] ?? donacion.tipo}
        </p>
        <p>
          <strong>Proyecto asignado:</strong> {donacion.proyectoNombre || "Fondo general"}
        </p>
      </div>

      <h3 className="constancia-subtitulo">Detalle del aporte</h3>
      <table className="constancia-tabla">
        <thead>
          <tr>
            <th style={{ width: "40px" }}>#</th>
            <th>Concepto / Descripción</th>
            <th style={{ width: "170px", textAlign: "right" }}>
              {esDinero ? "Monto" : "Cantidad"}
            </th>
          </tr>
        </thead>
        <tbody>
          {detalles.length === 0 ? (
            <tr>
              <td colSpan="3">Sin detalle registrado.</td>
            </tr>
          ) : (
            detalles.map((item, index) => (
              <tr key={item.id ?? index}>
                <td>{index + 1}</td>
                <td>{item.descripcion}</td>
                <td style={{ textAlign: "right" }}>
                  {esDinero
                    ? formatearMoneda(Number(item.monto || 0))
                    : `${item.cantidad ?? "-"} ${item.unidad || ""}`.trim()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );
}

export default function ConstanciaDonacionPage({ usuarioRol, donacion }) {
  const { tieneAccesoLectura, esValidaParaConstancia, correlativo, manejarImpresion } =
    useConstanciaDonacion({
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
        <Alert variant="secondary">No se ha seleccionado ninguna donación.</Alert>
      </Container>
    );
  }

  if (!esValidaParaConstancia) {
    return (
      <Container style={{ maxWidth: "720px" }} className="my-5">
        <Alert variant="danger">
          <Alert.Heading as="h5">Constancia No Disponible</Alert.Heading>
          <p className="mb-0">
            Esta donación se encuentra en estado <strong>ANULADA</strong>. Las donaciones anuladas
            no pueden generar una constancia de respaldo.
          </p>
        </Alert>
      </Container>
    );
  }

  return (
    <Container style={{ maxWidth: "800px" }} className="py-4">
      <div className="d-flex justify-content-between flex-wrap gap-2 mb-4 d-print-none">
        <AccionesDeCabecera
          actions={[
            {
              ...ACCION_VOLVER_A_DONACIONES,
              label: "Volver al historial",
              to: "/donaciones/historial",
            },
          ]}
        />
        <Button variant="primary" onClick={manejarImpresion}>
          Imprimir / Descargar PDF
        </Button>
      </div>

      <DocumentoImprimible
        documento="Constancia de donación recibida"
        folio={correlativo}
        fecha={donacion.fecha}
        pie={
          <>
            <LineaDeFirma rotulo="Firma de conformidad del donante" />
            <LineaDeFirma rotulo={`Por ${organizacion.nombre} (Administración)`} />
          </>
        }
      >
        <DatosDeLaDonacion donacion={donacion} />
      </DocumentoImprimible>

      <Card className="shadow-sm border border-secondary-subtle p-4 p-md-5">
        <Card.Body className="p-0">
          <div className="border-bottom pb-3 mb-4 d-flex justify-content-between align-items-center gap-3">
            <div className="d-flex align-items-center gap-3">
              <img
                src={organizacion.logo}
                alt=""
                aria-hidden="true"
                style={{ height: "48px", width: "auto" }}
              />
              <div>
                <h1 className="h4 fw-bold text-uppercase mb-1">{organizacion.nombre}</h1>
                <p className="small text-muted mb-0">
                  {organizacion.pais} · Registro de Aportes y Donaciones
                </p>
              </div>
            </div>
            <div className="text-end">
              <Badge bg="secondary" className="font-monospace fs-6 px-3 py-2">
                {correlativo}
              </Badge>
              <p className="small text-muted mt-2 mb-0">
                Fecha: {formatearFechaCorta(donacion.fecha)}
              </p>
            </div>
          </div>

          <h2 className="h5 text-center text-dark fw-bold mb-4 text-decoration-underline">
            CONSTANCIA DE DONACIÓN RECIBIDA
          </h2>

          <DatosDeLaDonacion donacion={donacion} />

          <Row className="pt-5 mt-5 border-top text-center text-muted fs-7">
            <Col xs={6}>
              <div
                className="border-bottom border-dark mx-auto mb-2"
                style={{ width: "75%" }}
              ></div>
              <p className="fw-semibold mb-0">Firma de conformidad del donante</p>
            </Col>
            <Col xs={6}>
              <div
                className="border-bottom border-dark mx-auto mb-2"
                style={{ width: "75%" }}
              ></div>
              <p className="fw-semibold mb-0">Por {organizacion.nombre} (Administración)</p>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </Container>
  );
}