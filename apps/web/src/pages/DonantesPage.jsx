import { TIPOS_DE_CAMPO, useDonantesPage } from "@ecopac/shared";
import { Container, Row, Col, Button, Form, Card, Alert, Modal } from "react-bootstrap";

import DataList from "../components/DataList";

/** `type` de `<Form.Control>` segun el tipo de campo del descriptor (campos.js). Los tipos de
 * CAMPOS_DONANTE que no llevan un `type` de HTML propio (SELECT) no pasan por aqui. */
function tipoDeControl(tipoDeCampo) {
  if (tipoDeCampo === TIPOS_DE_CAMPO.EMAIL) return "email";
  if (tipoDeCampo === TIPOS_DE_CAMPO.TELEFONO) return "tel";
  return "text";
}

export default function DonantesPage({ usuarioRol }) {
  const {
    permisos,
    cargando,
    error,
    columnas,
    camposSpec,
    catalogos,
    donantes,
    busqueda,
    setBusqueda,
    filtroTipo,
    setFiltroTipo,
    modalAbierto,
    cerrarModal,
    donanteSeleccionado,
    modoEdicion,
    valoresFormulario,
    setCampoFormulario,
    errorFormulario,
    guardando,
    abrirAlta,
    abrirEdicion,
    verFicha,
    guardarDonante,
  } = useDonantesPage({ usuarioRol });

  const guardar = () => {
    guardarDonante(valoresFormulario);
  };

  if (!permisos?.tieneAccesoLectura) {
    return (
      <Container className="my-4">
        <Alert variant="danger">Acceso denegado: No cuenta con permisos para ver donantes.</Alert>
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
          <Form.Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="todos">Todos los tipos</option>
            <option value="individual">Individual</option>
            <option value="empresa">Empresa</option>
            <option value="organizacion">Organización</option>
          </Form.Select>
        </Col>
      </Row>

      {error ? (
        <Alert variant="danger">{error.mensaje}</Alert>
      ) : (
        <DataList
          columnas={columnas}
          datos={donantes}
          cargando={cargando}
          vacio="No se encontraron donantes."
          onRowPress={(fila) => verFicha(fila.id)}
          accionSecundaria={
            permisos?.puedeEscribir ? { label: "Editar", onClick: abrirEdicion } : undefined
          }
          catalogos={catalogos}
        />
      )}

      {donanteSeleccionado && !modalAbierto && (
        <Card className="mt-4">
          <Card.Header as="h5">Ficha: {donanteSeleccionado.nombre}</Card.Header>
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
                  {donacion.fecha} - {donacion.monto ? `$${donacion.monto}` : donacion.descripcion}
                </li>
              ))}
            </ul>
          </Card.Body>
        </Card>
      )}

      <Modal show={modalAbierto} onHide={cerrarModal} centered>
        <Modal.Header closeButton>
          <Modal.Title as="h5">
            {modoEdicion ? "Editar Donante" : "Registrar Nuevo Donante"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {errorFormulario && (
            <Alert variant="danger" className="py-2">
              {errorFormulario.mensaje}
              {errorFormulario.campos && (
                <ul className="mb-0 mt-2 ps-3">
                  {Object.values(errorFormulario.campos).map((mensaje, indice) => (
                    <li key={indice}>{mensaje}</li>
                  ))}
                </ul>
              )}
            </Alert>
          )}

          {(camposSpec || []).map((campo) => (
            <Form.Group controlId={`formDonante-${campo.id}`} className="mb-3" key={campo.id}>
              <Form.Label>{campo.label}</Form.Label>
              {campo.tipo === TIPOS_DE_CAMPO.SELECT ? (
                <Form.Select
                  value={valoresFormulario[campo.id] ?? ""}
                  onChange={(e) => setCampoFormulario(campo.id, e.target.value)}
                  disabled={guardando}
                >
                  {(campo.opciones || []).map((opcion) => (
                    <option key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </option>
                  ))}
                </Form.Select>
              ) : (
                <Form.Control
                  type={tipoDeControl(campo.tipo)}
                  value={valoresFormulario[campo.id] ?? ""}
                  onChange={(e) => setCampoFormulario(campo.id, e.target.value)}
                  disabled={guardando}
                />
              )}
            </Form.Group>
          ))}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={cerrarModal} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : modoEdicion ? "Guardar Cambios" : "Registrar Donante"}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
