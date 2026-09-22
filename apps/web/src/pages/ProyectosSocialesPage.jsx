import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ESTADOS_PROYECTO,
  ETIQUETAS_ESTADO_PROYECTO,
  puedeVerInsumosYGastosDeProyecto,
  useProyectosSociales,
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
  ProgressBar,
  Modal,
  Nav,
  Alert,
  Spinner,
} from "react-bootstrap";

import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import ModalProyecto from "./ModalProyecto";

export default function ProyectosSocialesPage({ usuarioRol }) {
  const {
    tieneAccesoLectura,
    cargando,
    error,
    proyectos,
    proyectoDetalle,
    jornadasProyecto,
    catalogos,
    puedeEditar,
    guardarProyecto,
    filtrosState,
    setFiltrosState,
    setProyectoSeleccionadoId,
    tabActivo,
    setTabActivo,
  } = useProyectosSociales({ usuarioRol });

  const [proyectoEnEdicion, setProyectoEnEdicion] = useState(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);

  const verDinero = puedeVerInsumosYGastosDeProyecto(usuarioRol);
  const pestanasDelProyecto = verDinero
    ? ["resumen", "equipo", "jornadas", "insumos", "gastos"]
    : ["resumen", "equipo", "jornadas"];
  // Si el rol no tiene la pestana abierta, el contenido tampoco se dibuja: `tabActivo` arranca
  // en "resumen", pero nada impide que un dia se guarde en la URL o en el estado de sesion.
  const pestanaDelProyectoVisible = pestanasDelProyecto.includes(tabActivo) ? tabActivo : "resumen";

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
        title="Proyectos sociales"
        subtitle="Gestión de proyectos, presupuestos y jornadas de campo"
        actions={
          puedeEditar
            ? [
                {
                  label: "Nuevo proyecto",
                  onClick: () => {
                    setProyectoEnEdicion(null);
                    setFormularioAbierto(true);
                  },
                },
              ]
            : []
        }
      />

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
                  {/* Los valores eran "Planificación", "En Ejecución" y "Finalizado", escritos a
                      mano: ninguno es un valor del enum estado_proyecto (00007), asi que elegir
                      cualquiera mandaba a la base un filtro que rechaza con 22P02, y "Cancelado"
                      no se podia filtrar. Salen de ESTADOS_PROYECTO, como el chip de la tabla. */}
                  {Object.values(ESTADOS_PROYECTO).map((estado) => (
                    <option key={estado} value={estado}>
                      {ETIQUETAS_ESTADO_PROYECTO[estado]}
                    </option>
                  ))}
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
              activeKey={pestanaDelProyectoVisible}
              onSelect={(selectedKey) => setTabActivo(selectedKey)}
              className="mb-3"
            >
              {/* ISSUE #864: "En proyectos: sin ver insumos ni gastos, y sin poder crear nada".
                  Insumos y gastos son las dos pestanas de dinero del proyecto, y quien las ve lo
                  decide puedeVerInsumosYGastosDeProyecto(rol) en packages/shared. El medico ve el
                  proyecto de su jornada -- que es, en que estado esta, que jornadas cuelgan de
                  el --, no lo que costo. */}
              {pestanasDelProyecto.map((tab) => (
                <Nav.Item key={tab}>
                  <Nav.Link eventKey={tab} className="text-capitalize">
                    {tab}
                  </Nav.Link>
                </Nav.Item>
              ))}
            </Nav>

            {/* Contenido según Tab Activo */}
            {pestanaDelProyectoVisible === "resumen" && (
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

            {pestanaDelProyectoVisible === "jornadas" && (
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

            {pestanaDelProyectoVisible === "gastos" && (
              <Alert variant="warning" className="mb-0 py-2 px-3 small">
                El tab Gastos depende del módulo de Presupuestos (#274), actualmente pendiente de
                asignación.
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            {puedeEditar && (
              <Button
                variant="outline-primary"
                onClick={() => {
                  setProyectoEnEdicion(proyectoDetalle);
                  setFormularioAbierto(true);
                }}
              >
                Editar proyecto
              </Button>
            )}
            <Button variant="secondary" onClick={() => setProyectoSeleccionadoId(null)}>
              Cerrar
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      <ModalProyecto
        visible={formularioAbierto}
        proyecto={proyectoEnEdicion}
        catalogos={catalogos}
        onClose={() => setFormularioAbierto(false)}
        onGuardar={guardarProyecto}
      />
    </ScreenContainer>
  );
}
