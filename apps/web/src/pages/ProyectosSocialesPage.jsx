import { useState } from "react";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ESTADOS_PROYECTO,
  ETIQUETAS_ESTADO_PROYECTO,
  formatearMoneda,
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

import { DataList } from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";
import ScreenContainer from "../components/ScreenContainer";
import SecondaryButton from "../components/SecondaryButton";
import ModalGasto from "./ModalGasto";
import ModalInsumoProyecto from "./ModalInsumoProyecto";
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
    permisos,
    puedeRegistrarGastos,
    presupuestoProyecto,
    columnasGastos,
    gastosProyecto,
    cargandoGastos,
    errorGastos,
    recargarGastos,
    jornadasDisponibles,
    errorJornadas,
    asociarJornada,
    quitarJornada,
    equipo,
    cargandoEquipo,
    errorEquipo,
    personalDisponible,
    agregarAlEquipo,
    quitarDelEquipo,
    insumos,
    cargandoInsumos,
    errorInsumos,
    erroresInsumo,
    columnasInsumos,
    camposInsumo,
    catalogosInsumo,
    resumenDeInsumos,
    guardarInsumo,
    quitarInsumo,
    guardarProyecto,
    filtrosState,
    setFiltrosState,
    limpiarFiltros,
    hayFiltros,
    setProyectoSeleccionadoId,
    tabActivo,
    setTabActivo,
  } = useProyectosSociales({ usuarioRol });

  const [proyectoEnEdicion, setProyectoEnEdicion] = useState(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);

  // Solo el id de quien mira, para registrar_por de un gasto; nada de decisiones de permiso aqui.
  const { perfil } = useSesionCompartida();
  const [gastoEnEdicion, setGastoEnEdicion] = useState(null);
  const [registrandoGasto, setRegistrandoGasto] = useState(false);
  const [jornadaPorAsociar, setJornadaPorAsociar] = useState("");
  const [jornadaPorQuitar, setJornadaPorQuitar] = useState(null);
  const [personaPorAgregar, setPersonaPorAgregar] = useState("");
  const [rolPorAgregar, setRolPorAgregar] = useState("");
  const [personaPorQuitar, setPersonaPorQuitar] = useState(null);
  const [avisoEquipo, setAvisoEquipo] = useState(null);
  const [insumoEnEdicion, setInsumoEnEdicion] = useState(null);
  const [formularioInsumoAbierto, setFormularioInsumoAbierto] = useState(false);
  const [insumoPorQuitar, setInsumoPorQuitar] = useState(null);
  const [avisoInsumos, setAvisoInsumos] = useState(null);

  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (pathname === "/proyectos/sociales") {
      navigate("/proyectos", { replace: true });
    }
  }, [pathname, navigate]);

  const verDinero = permisos.puedeVerInsumosYGastos;
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

            {/* Mismo boton y misma clase que FilterBar: siempre visible, apagado sin filtros. */}
            <Col md={3} lg={2} className="d-flex align-items-end">
              <div className="ec-filtros-limpiar">
                <SecondaryButton
                  title="Limpiar filtros"
                  variant="neutra"
                  onClick={limpiarFiltros}
                  disabled={!hayFiltros}
                />
              </div>
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
                {/* Dinero: el medico ve el proyecto de su jornada, no lo que cuesta (#864). */}
                {verDinero && (
                  <p className="mb-2">
                    <strong>Presupuesto:</strong>{" "}
                    {formatearMoneda(presupuestoProyecto?.asignado) ?? "-"}
                  </p>
                )}
                <p className="mb-0">
                  <strong>Avance actual:</strong> {proyectoDetalle.porcentajeAvance || 0}%
                </p>
              </div>
            )}

            {pestanaDelProyectoVisible === "insumos" && (
              <div className="d-flex flex-column gap-3">
                <p className="text-muted small mb-0">
                  Lista de lo previsto para este proyecto. No descuenta existencias del inventario.
                </p>
                {(errorInsumos || avisoInsumos) && (
                  <Alert variant="danger" className="mb-0 py-2 px-3 small">
                    {errorInsumos
                      ? `No se pudo actualizar los insumos: ${errorInsumos.mensaje}`
                      : avisoInsumos}
                  </Alert>
                )}
                {permisos.puedeGestionarInsumos && (
                  <div className="d-flex justify-content-end">
                    <PrimaryButton
                      title="Agregar insumo"
                      onClick={() => {
                        setInsumoEnEdicion(null);
                        setFormularioInsumoAbierto(true);
                      }}
                    />
                  </div>
                )}
                {insumoPorQuitar && (
                  <Alert variant="warning" className="mb-0 py-2 px-3 small">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                      <span>
                        ¿Quitar {insumoPorQuitar.articuloNombre} de la lista del proyecto?
                      </span>
                      <span className="d-flex gap-2">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={async () => {
                            const { ok, error } = await quitarInsumo(insumoPorQuitar.id);
                            setAvisoInsumos(ok || error ? null : "No se pudo quitar el insumo.");
                            setInsumoPorQuitar(null);
                          }}
                        >
                          Confirmar
                        </Button>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => setInsumoPorQuitar(null)}
                        >
                          Cancelar
                        </Button>
                      </span>
                    </div>
                  </Alert>
                )}
                <DataList
                  columnas={columnasInsumos}
                  datos={insumos}
                  cargando={cargandoInsumos}
                  vacio="Este proyecto todavía no tiene insumos previstos."
                  onRowPress={
                    permisos.puedeGestionarInsumos
                      ? (insumo) => {
                          setInsumoEnEdicion(insumo);
                          setFormularioInsumoAbierto(true);
                        }
                      : undefined
                  }
                  accionSecundaria={
                    permisos.puedeGestionarInsumos
                      ? { label: "Quitar", onClick: (insumo) => setInsumoPorQuitar(insumo) }
                      : undefined
                  }
                />
                {insumos.length > 0 && (
                  <p className="mb-0 text-end">
                    <strong>Total estimado:</strong>{" "}
                    {formatearMoneda(resumenDeInsumos.totalEstimado)}
                    {resumenDeInsumos.sinCosto > 0 && (
                      <span className="text-muted small ms-2">
                        ({resumenDeInsumos.sinCosto} sin costo estimado)
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}

            {pestanaDelProyectoVisible === "equipo" && (
              <div>
                <h6 className="fw-bold mb-3">Equipo del Proyecto</h6>
                {(errorEquipo || avisoEquipo) && (
                  <Alert variant="danger" className="py-2 px-3 small">
                    {errorEquipo
                      ? `No se pudo completar la operación del equipo: ${errorEquipo.mensaje}`
                      : avisoEquipo}
                  </Alert>
                )}
                {cargandoEquipo ? (
                  <p className="text-muted small mb-0">Cargando equipo...</p>
                ) : equipo.length > 0 ? (
                  <ul className="list-group list-group-flush border-top border-bottom">
                    {equipo.map((miembro) => (
                      <li
                        key={miembro.id}
                        className="list-group-item d-flex justify-content-between align-items-center px-0 py-2"
                      >
                        <span>
                          {miembro.nombre}
                          {miembro.rolEnProyecto && (
                            <span className="text-muted small ms-2">{miembro.rolEnProyecto}</span>
                          )}
                        </span>
                        {permisos.puedeGestionarEquipo &&
                          (personaPorQuitar === miembro.perfilId ? (
                            <span className="d-flex align-items-center gap-2 small">
                              ¿Quitar del equipo?
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={async () => {
                                  const { ok, error } = await quitarDelEquipo(miembro.perfilId);
                                  setAvisoEquipo(
                                    ok || error ? null : "No se pudo quitar a esta persona.",
                                  );
                                  setPersonaPorQuitar(null);
                                }}
                              >
                                Confirmar
                              </Button>
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => setPersonaPorQuitar(null)}
                              >
                                Cancelar
                              </Button>
                            </span>
                          ) : (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => setPersonaPorQuitar(miembro.perfilId)}
                            >
                              Quitar
                            </Button>
                          ))}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted small mb-0">Este proyecto todavía no tiene equipo.</p>
                )}

                {permisos.puedeGestionarEquipo && (
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <Form.Select
                      aria-label="Persona a agregar"
                      className="w-auto flex-grow-1"
                      value={personaPorAgregar}
                      onChange={(e) => setPersonaPorAgregar(e.target.value)}
                    >
                      <option value="">Seleccionar persona</option>
                      {personalDisponible.map((persona) => (
                        <option key={persona.value} value={persona.value}>
                          {persona.label}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Control
                      aria-label="Rol en el proyecto"
                      className="w-auto flex-grow-1"
                      type="text"
                      maxLength={100}
                      placeholder="Rol en el proyecto (opcional)"
                      value={rolPorAgregar}
                      onChange={(e) => setRolPorAgregar(e.target.value)}
                    />
                    <Button
                      variant="outline-primary"
                      disabled={!personaPorAgregar}
                      onClick={async () => {
                        const { ok } = await agregarAlEquipo(personaPorAgregar, rolPorAgregar);
                        setAvisoEquipo(null);
                        if (ok) {
                          setPersonaPorAgregar("");
                          setRolPorAgregar("");
                        }
                      }}
                    >
                      Agregar al equipo
                    </Button>
                  </div>
                )}
              </div>
            )}

            {pestanaDelProyectoVisible === "jornadas" && (
              <div>
                <h6 className="fw-bold mb-3">Jornadas Asociadas</h6>
                {errorJornadas && (
                  <Alert variant="danger" className="py-2 px-3 small">
                    No se pudieron actualizar las jornadas: {errorJornadas.mensaje}
                  </Alert>
                )}
                {jornadasProyecto.length > 0 ? (
                  <ul className="list-group list-group-flush border-top border-bottom">
                    {jornadasProyecto.map((j) => (
                      <li
                        key={j.id}
                        className="list-group-item d-flex justify-content-between align-items-center px-0 py-2"
                      >
                        <span>{j.nombre}</span>
                        <span className="d-flex align-items-center gap-3">
                          <span className="text-muted small">{j.fecha}</span>
                          {permisos.puedeAsociarJornadas &&
                            (jornadaPorQuitar === j.id ? (
                              <span className="d-flex align-items-center gap-2 small">
                                ¿Quitar del proyecto?
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={async () => {
                                    await quitarJornada(j.id);
                                    setJornadaPorQuitar(null);
                                  }}
                                >
                                  Confirmar
                                </Button>
                                <Button
                                  variant="outline-secondary"
                                  size="sm"
                                  onClick={() => setJornadaPorQuitar(null)}
                                >
                                  Cancelar
                                </Button>
                              </span>
                            ) : (
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => setJornadaPorQuitar(j.id)}
                              >
                                Quitar
                              </Button>
                            ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted small mb-0">
                    No hay jornadas asociadas a este proyecto.
                  </p>
                )}

                {permisos.puedeAsociarJornadas && (
                  <div className="d-flex gap-2 mt-3">
                    <Form.Select
                      aria-label="Jornada sin proyecto"
                      value={jornadaPorAsociar}
                      onChange={(e) => setJornadaPorAsociar(e.target.value)}
                    >
                      <option value="">
                        {jornadasDisponibles.length === 0
                          ? "No hay jornadas sin proyecto"
                          : "Seleccionar jornada sin proyecto"}
                      </option>
                      {jornadasDisponibles.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.nombre} - {j.fecha}
                        </option>
                      ))}
                    </Form.Select>
                    <Button
                      variant="outline-primary"
                      disabled={!jornadaPorAsociar}
                      onClick={async () => {
                        const { ok } = await asociarJornada(jornadaPorAsociar);
                        if (ok) setJornadaPorAsociar("");
                      }}
                    >
                      Asociar jornada
                    </Button>
                  </div>
                )}
              </div>
            )}

            {pestanaDelProyectoVisible === "gastos" && (
              <div className="d-flex flex-column gap-3">
                {errorGastos && (
                  <Alert variant="danger" className="mb-0 py-2 px-3 small">
                    No se pudieron cargar los gastos: {errorGastos.mensaje}
                  </Alert>
                )}
                {puedeRegistrarGastos && (
                  <div className="d-flex align-items-center justify-content-end gap-3">
                    {/* Un gasto cuelga de una jornada; sin jornadas en el proyecto no hay donde. */}
                    {jornadasProyecto.length === 0 && (
                      <span className="text-muted small">
                        Asocia una jornada al proyecto para registrar gastos.
                      </span>
                    )}
                    <PrimaryButton
                      title="Registrar gasto"
                      disabled={jornadasProyecto.length === 0}
                      onClick={() => setRegistrandoGasto(true)}
                    />
                  </div>
                )}
                <DataList
                  columnas={columnasGastos}
                  datos={gastosProyecto}
                  cargando={cargandoGastos}
                  vacio="Este proyecto todavía no tiene gastos."
                  catalogos={{
                    jornadas: jornadasProyecto.map((j) => ({ value: j.id, label: j.nombre })),
                    perfiles: catalogos.perfiles,
                  }}
                  onRowPress={(gasto) => setGastoEnEdicion(gasto)}
                />
              </div>
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

      {/* proyectoId acota el selector de jornada a las de este proyecto. */}
      {registrandoGasto && (
        <ModalGasto
          usuarioId={perfil?.id}
          proyectoId={proyectoDetalle?.id}
          rol={usuarioRol}
          onClose={() => setRegistrandoGasto(false)}
          onGuardado={() => {
            setRegistrandoGasto(false);
            recargarGastos();
          }}
        />
      )}
      {gastoEnEdicion && (
        <ModalGasto
          key={gastoEnEdicion.id}
          gasto={gastoEnEdicion}
          usuarioId={perfil?.id}
          proyectoId={proyectoDetalle?.id}
          rol={usuarioRol}
          onClose={() => setGastoEnEdicion(null)}
          onGuardado={() => {
            setGastoEnEdicion(null);
            recargarGastos();
          }}
        />
      )}

      {formularioInsumoAbierto && (
        <ModalInsumoProyecto
          visible
          insumo={insumoEnEdicion}
          campos={camposInsumo}
          catalogos={catalogosInsumo}
          errores={erroresInsumo}
          onClose={() => setFormularioInsumoAbierto(false)}
          onGuardar={guardarInsumo}
        />
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
