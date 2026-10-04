import { useState } from "react";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ESTADOS_PROYECTO,
  ETIQUETAS_ESTADO_PROYECTO,
  formatearFechaCorta,
  formatearMoneda,
  MENSAJE_PROYECTO_CANCELADO,
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

import { BotonLimpiarFiltros, DataList, StatCard } from "../components";
import ContenidoDeBodega from "../components/ContenidoDeBodega";
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
    puedeCrear,
    puedeEditar,
    proyectoCancelado,
    permisos,
    presupuestoProyecto,
    columnasGastos,
    gastosProyecto,
    resumenDeGastos,
    cargandoGastos,
    errorGastos,
    jornadasDisponibles,
    errorJornadas,
    asociarJornada,
    equipo,
    cargandoEquipo,
    errorEquipo,
    ocupadoEquipo,
    personalDisponible,
    agregarAlEquipo,
    quitarDelEquipo,
    insumosPorJornada,
    insumosSinJornada,
    bodegasDeJornadas,
    existenciasEnBodegas,
    valorDeBodegas,
    entregadoDesdeLaPrincipal,
    valorEntregadoDesdeLaPrincipal,
    columnasEntregadoDesdeLaPrincipal,
    cargandoInsumos,
    errorInsumos,
    columnasInsumos,
    resumenDeInsumos,
    pasarInsumoAJornada,
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

  const [jornadaPorAsociar, setJornadaPorAsociar] = useState("");
  const [personaPorAgregar, setPersonaPorAgregar] = useState("");
  const [rolPorAgregar, setRolPorAgregar] = useState("");
  const [personaPorQuitar, setPersonaPorQuitar] = useState(null);
  const [avisoEquipo, setAvisoEquipo] = useState(null);
  const [insumoPorPasar, setInsumoPorPasar] = useState(null);
  const [jornadaDestino, setJornadaDestino] = useState("");

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
          puedeCrear
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
              <BotonLimpiarFiltros onClick={limpiarFiltros} hayFiltros={hayFiltros} />
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
                          consulta que este listado ya hizo. El personal de campo no lo ve
                          (00148): su detalle es de consulta. */}
                      {permisos.puedeVerSeguimiento && (
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
                      )}
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

            {/* 00154 y 00172: un proyecto cancelado o finalizado se consulta, no se edita. Los botones de agregar,
                quitar, asociar y editar ya no aparecen (permisos del proyecto abierto). */}
            {proyectoCancelado && (
              <Alert variant="secondary" className="py-2 px-3 small">
                {MENSAJE_PROYECTO_CANCELADO}
              </Alert>
            )}

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

            {/* Insumos: desde la 00178 son lo que hay en la bodega movil de cada jornada, que se
                carga en el detalle de la jornada. Los previstos (00151) quedan de las jornadas
                anteriores. Aqui solo se ven, con su valor arriba. */}
            {pestanaDelProyectoVisible === "insumos" && (
              <div className="d-flex flex-column gap-3">
                <div className="ec-kpis">
                  <StatCard
                    label="Valor en las bodegas"
                    value={formatearMoneda(valorDeBodegas.valor)}
                    caption={
                      valorDeBodegas.lotesSinCosto > 0
                        ? `${valorDeBodegas.lotesSinCosto} lote(s) sin costo no se suman`
                        : `${valorDeBodegas.unidades} unidades`
                    }
                    accent="var(--accent-inventario)"
                  />
                  {entregadoDesdeLaPrincipal.length > 0 && (
                    <StatCard
                      label="Entregado de la bodega principal"
                      value={formatearMoneda(valorEntregadoDesdeLaPrincipal)}
                      caption="En las recetas de sus jornadas"
                      accent="var(--color-success)"
                    />
                  )}
                  {(insumosPorJornada.length > 0 || insumosSinJornada.length > 0) && (
                    <StatCard
                      label="Previsto (estimado)"
                      value={formatearMoneda(resumenDeInsumos.totalEstimado)}
                      caption={
                        resumenDeInsumos.sinCosto > 0
                          ? `${resumenDeInsumos.sinCosto} sin costo estimado`
                          : "Planificado antes de cargar las bodegas"
                      }
                      accent="var(--accent-jornadas)"
                    />
                  )}
                </div>
                <p className="text-muted small mb-0">
                  Si la jornada tiene una bodega asignada, su inventario pasa a ser parte de los
                  insumos de la jornada. Se carga desde el detalle de cada jornada, en su pestaña
                  Insumos, y lo que se consumió está en su pestaña Consumo.
                </p>
                {errorInsumos && (
                  <Alert variant="danger" className="mb-0 py-2 px-3 small">
                    No se pudieron cargar los insumos: {errorInsumos.mensaje}
                  </Alert>
                )}
                {cargandoInsumos && <p className="text-muted small mb-0">Cargando insumos...</p>}
                {!cargandoInsumos &&
                  bodegasDeJornadas.length === 0 &&
                  entregadoDesdeLaPrincipal.length === 0 &&
                  insumosPorJornada.length === 0 &&
                  insumosSinJornada.length === 0 && (
                    <p className="text-muted small mb-0">
                      Ninguna jornada de este proyecto tiene insumos todavía.
                    </p>
                  )}

                {/* Issue #911: lo que hay en la bodega movil de cada jornada es insumo del
                    proyecto. */}
                {bodegasDeJornadas.length > 0 && (
                  <div>
                    <h6 className="fw-bold mb-1">En las bodegas móviles de sus jornadas</h6>
                    <ul className="text-muted small mb-2 ps-3">
                      {bodegasDeJornadas.map((bodega) => (
                        <li key={bodega.bodegaId}>
                          {bodega.bodegaNombre ?? "Bodega"} ·{" "}
                          {bodega.jornadas.length === 1 ? "jornada" : "jornadas"}{" "}
                          {bodega.jornadas.join(", ")}
                        </li>
                      ))}
                    </ul>
                    <ContenidoDeBodega
                      contenido={existenciasEnBodegas}
                      cargando={cargandoInsumos}
                      vacio="Las bodegas móviles de sus jornadas no tienen existencias."
                      mostrarBodega={bodegasDeJornadas.length > 1}
                      conValor
                    />
                  </div>
                )}

                {/* 00181: de la bodega principal solo cuenta lo entregado en sus jornadas; su
                    existencia es de toda la organizacion. */}
                {entregadoDesdeLaPrincipal.length > 0 && (
                  <div>
                    <h6 className="fw-bold mb-1">Entregado de la bodega principal</h6>
                    <p className="text-muted small mb-2">
                      Lo que salió en las recetas de las jornadas que entregan directo de la bodega
                      principal.
                    </p>
                    <DataList
                      columnas={columnasEntregadoDesdeLaPrincipal}
                      datos={entregadoDesdeLaPrincipal}
                      cargando={cargandoInsumos}
                    />
                  </div>
                )}

                {insumosPorJornada.length > 0 && <h6 className="fw-bold mb-0 mt-2">Previstos</h6>}
                {insumosPorJornada.map((grupo) => (
                  <div key={grupo.jornadaId}>
                    <div className="d-flex justify-content-between align-items-baseline mb-1">
                      <span className="fw-semibold">{grupo.jornadaNombre}</span>
                      <span className="text-muted small">
                        {formatearFechaCorta(grupo.jornadaFecha)} ·{" "}
                        {formatearMoneda(grupo.resumen.totalEstimado)}
                      </span>
                    </div>
                    <DataList columnas={columnasInsumos} datos={grupo.insumos} vacio={null} />
                  </div>
                ))}

                {/* Lo que se habia planeado para el proyecto antes de la 00151, sin jornada. */}
                {insumosSinJornada.length > 0 && (
                  <div>
                    <h6 className="fw-bold mb-1">Previstos para el proyecto, sin jornada</h6>
                    <p className="text-muted small mb-2">
                      Se anotaron antes de que los insumos se planearan por jornada.
                      {permisos.puedeGestionarInsumos && " Pásalos a la jornada que corresponda."}
                    </p>
                    {insumoPorPasar && (
                      <Alert variant="secondary" className="py-2 px-3 small">
                        <div className="d-flex flex-wrap align-items-center gap-2">
                          <span>Pasar {insumoPorPasar.articuloNombre} a</span>
                          <Form.Select
                            size="sm"
                            aria-label="Jornada destino"
                            className="w-auto"
                            value={jornadaDestino}
                            onChange={(e) => setJornadaDestino(e.target.value)}
                          >
                            <option value="">Seleccionar jornada</option>
                            {jornadasProyecto.map((j) => (
                              <option key={j.id} value={j.id}>
                                {j.nombre}
                              </option>
                            ))}
                          </Form.Select>
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={!jornadaDestino}
                            onClick={async () => {
                              const { ok } = await pasarInsumoAJornada(
                                insumoPorPasar.id,
                                jornadaDestino,
                              );
                              if (ok) {
                                setInsumoPorPasar(null);
                                setJornadaDestino("");
                              }
                            }}
                          >
                            Pasar
                          </Button>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => {
                              setInsumoPorPasar(null);
                              setJornadaDestino("");
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </Alert>
                    )}
                    <DataList
                      columnas={columnasInsumos}
                      datos={insumosSinJornada}
                      vacio={null}
                      accionSecundaria={
                        permisos.puedeGestionarInsumos && jornadasProyecto.length > 0
                          ? { label: "Pasar a una jornada", onClick: setInsumoPorPasar }
                          : undefined
                      }
                    />
                  </div>
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
                          {/* 00150: el equipo es tambien el de sus jornadas. Se dice de cual, y
                              quien solo viene de una jornada se quita en esa jornada, no aqui. */}
                          {miembro.jornadas.length > 0 && (
                            <span className="d-block text-muted small">
                              En {miembro.jornadas.join(", ")}
                            </span>
                          )}
                        </span>
                        {permisos.puedeGestionarEquipo &&
                          miembro.enEquipoDelProyecto &&
                          (personaPorQuitar === miembro.perfilId ? (
                            <span className="d-flex align-items-center gap-2 small">
                              ¿Quitar del equipo?
                              <Button
                                variant="danger"
                                size="sm"
                                disabled={ocupadoEquipo}
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
                  <p className="text-muted small mb-0">
                    Este proyecto todavía no tiene equipo: se arma con el personal de sus jornadas y
                    con quien se agregue aquí.
                  </p>
                )}

                {/* Agregar a alguien que no esta en ninguna jornada (quien solo coordina, por
                    ejemplo). Los tres controles en una fila: el boton no se parte en dos lineas. */}
                {permisos.puedeGestionarEquipo && (
                  <div className="ec-fila-agregar mt-3">
                    <Form.Select
                      aria-label="Persona a agregar"
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
                      type="text"
                      maxLength={100}
                      placeholder="Rol en el proyecto (opcional)"
                      value={rolPorAgregar}
                      onChange={(e) => setRolPorAgregar(e.target.value)}
                    />
                    <Button
                      variant="outline-primary"
                      className="text-nowrap"
                      disabled={!personaPorAgregar || ocupadoEquipo}
                      aria-busy={ocupadoEquipo}
                      onClick={async () => {
                        const { ok, yaEstaba } = await agregarAlEquipo(
                          personaPorAgregar,
                          rolPorAgregar,
                        );
                        setAvisoEquipo(null);
                        // Si ya estaba en el equipo, tambien se limpia: la persona ya aparece.
                        if (ok || yaEstaba) {
                          setPersonaPorAgregar("");
                          setRolPorAgregar("");
                        }
                      }}
                    >
                      {ocupadoEquipo ? "Agregando..." : "Agregar al equipo"}
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
                        {/* Sin "Quitar": desde la 00169 una jornada no se queda sin proyecto.
                            Para pasarla a otro proyecto se edita la jornada. */}
                        <span className="text-muted small">{j.fecha}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted small mb-0">
                    No hay jornadas asociadas a este proyecto.
                  </p>
                )}

                {permisos.puedeAsociarJornadas && (
                  <div className="ec-fila-agregar mt-3">
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
                      className="text-nowrap"
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
                {/* Solo consulta: los gastos de las jornadas del proyecto. Se registran contra una
                    jornada en Presupuestos, donde pasan por la aprobacion. */}
                <div className="ec-kpis">
                  <StatCard
                    label="Total gastado"
                    value={formatearMoneda(resumenDeGastos.aprobado)}
                    caption="Gastos aprobados"
                    accent="var(--color-success)"
                  />
                  <StatCard
                    label="Por aprobar"
                    value={formatearMoneda(resumenDeGastos.pendiente)}
                    caption={
                      resumenDeGastos.rechazados > 0
                        ? `${resumenDeGastos.rechazados} rechazado(s) no se suman`
                        : "Esperan aprobación"
                    }
                    accent="var(--color-warning)"
                  />
                  <StatCard
                    label="Presupuesto"
                    value={formatearMoneda(presupuestoProyecto?.asignado) ?? "—"}
                    caption="Asignado al proyecto"
                    accent="var(--accent-presupuestos)"
                  />
                </div>
                <p className="text-muted small mb-0">
                  Los gastos de las jornadas de este proyecto. Se registran en Presupuestos o en la
                  pestaña Gastos de cada jornada.
                </p>
                <DataList
                  columnas={columnasGastos}
                  datos={gastosProyecto}
                  cargando={cargandoGastos}
                  vacio="Las jornadas de este proyecto todavía no tienen gastos."
                  catalogos={{
                    jornadas: jornadasProyecto.map((j) => ({ value: j.id, label: j.nombre })),
                    perfiles: catalogos.perfiles,
                  }}
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
