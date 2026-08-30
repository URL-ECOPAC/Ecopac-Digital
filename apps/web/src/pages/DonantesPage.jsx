import { useDonantesPage } from "@ecopac/shared";
import {
  Container,
  Row,
  Col,
  Button,
  Table,
  Form,
  Card,
  Alert,
  Spinner,
} from "react-bootstrap";

export default function DonantesPage({ usuarioRol }) {
  const {
    permisos,
    cargando,
    error,
    columnas,
    donantes,
    busqueda,
    setBusqueda,
    filtroTipo,
    setFiltroTipo,
    modalAbierto,
    donanteSeleccionado,
    abrirAlta,
    abrirEdicion,
    verFicha,
  } = useDonantesPage({ usuarioRol });

  if (!permisos?.tieneAccesoLectura) {
    return (
      <Container className="my-4">
        <Alert variant="danger">
          Acceso denegado: No cuenta con permisos para ver donantes.
        </Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Administración de Donantes</h1>
        {permisos?.puedeEscribir && (
          <Button variant="primary" onClick={abrirAlta}>
            + Nuevo Donante
          </Button>
        )}
      </div>

      <Row className="g-3 mb-4">
        <Col md={6}>
          <Form.Control
            type="text"
            placeholder="Buscar por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </Col>
        <Col md={6}>
          <Form.Select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
          >
            <option value="todos">Todos los tipos</option>
            <option value="individual">Individual</option>
            <option value="empresa">Empresa</option>
            <option value="organizacion">Organización</option>
          </Form.Select>
        </Col>
      </Row>

      {cargando ? (
        <div className="d-flex align-items-center gap-2 my-4">
          <Spinner animation="border" size="sm" role="status" />
          <span>Cargando donantes...</span>
        </div>
      ) : error ? (
        <Alert variant="danger">{error}</Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              {(columnas || []).map((col) => (
                <th key={col.key || col.accessor}>{col.header || col.label}</th>
              ))}
              {permisos?.puedeEscribir && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {(donantes || []).length === 0 ? (
              <tr>
                <td
                  colSpan={(columnas?.length || 0) + (permisos?.puedeEscribir ? 1 : 0)}
                  className="text-center text-muted"
                >
                  No se encontraron donantes.
                </td>
              </tr>
            ) : (
              donantes.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => verFicha(row.id)}
                  style={{ cursor: "pointer" }}
                >
                  {(columnas || []).map((col) => {
                    const key = col.key || col.accessor;
                    return <td key={key}>{row[key]}</td>;
                  })}
                  {permisos?.puedeEscribir && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => abrirEdicion(row)}
                      >
                        Editar
                      </Button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </Table>
      )}

      {donanteSeleccionado && !modalAbierto && (
        <Card className="mt-4">
          <Card.Header as="h5">
            Ficha: {donanteSeleccionado.nombre}
          </Card.Header>
          <Card.Body>
            <Card.Text>
              <strong>Tipo:</strong> {donanteSeleccionado.tipo}
            </Card.Text>
            <Card.Text>
              <strong>Contacto:</strong> {donanteSeleccionado.contacto}
            </Card.Text>
            <h6 className="mt-4 fw-bold">Histórico de Aportes</h6>
            <ul className="mb-0">
              {(donanteSeleccionado.donaciones || []).map((donacion) => (
                <li key={donacion.id}>
                  {donacion.fecha} -{" "}
                  {donacion.monto ? `$${donacion.monto}` : donacion.descripcion}
                </li>
              ))}
            </ul>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
}