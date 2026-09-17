import { useEffect, useState } from "react";
import {
  enlazarLoteConDonacion,
  ETIQUETAS_TIPO_DONACION,
  ETIQUETAS_TIPO_DONANTE,
  listarBodegas,
  listarMedicamentos,
  listarProveedores,
  obtenerOCrearProveedorPorNombre,
  TIPO_PROVEEDOR,
  TIPOS_DE_DONACION,
  TIPOS_DE_DONANTE,
  useRegistroDonacion,
} from "@ecopac/shared";
import { Container, Row, Col, Card, Form, Button, Alert, Modal } from "react-bootstrap";

import { useSesionCompartida } from "../contexto/SesionProvider";
import PageHeader from "../components/PageHeader";
import { ACCION_VOLVER_A_DONACIONES } from "./donacionesNavegacion";
import ScreenContainer from "../components/ScreenContainer";
import ModalRegistroIngreso from "./ModalRegistroIngreso.jsx";
import { Plus, Trash2 } from "lucide-react";
import SecondaryButton from "../components/SecondaryButton";

export default function RegistroDonacionPage({ usuarioRol }) {
  const { perfil } = useSesionCompartida();
  const [catalogosIngreso, setCatalogosIngreso] = useState({
    medicamentos: [],
    bodegas: [],
    proveedores: [],
  });
  const [formularioIngresoAbierto, setFormularioIngresoAbierto] = useState(false);
  const [proveedorIdIngreso, setProveedorIdIngreso] = useState(null);
  const [resolviendoProveedor, setResolviendoProveedor] = useState(false);

  // Catalogos para "Ingreso a Inventario" (issue #756): la misma forma que ya carga
  // InventarioPage.jsx para ModalRegistroIngreso.jsx. `proveedores` se acota a tipo 'donante'
  // -este flujo siempre nace de una donacion, nunca de una compra.
  useEffect(() => {
    let vigente = true;

    listarMedicamentos({ soloActivos: true }).then(({ medicamentos }) => {
      if (vigente) setCatalogosIngreso((anteriores) => ({ ...anteriores, medicamentos }));
    });
    listarBodegas().then(({ bodegas }) => {
      if (vigente) setCatalogosIngreso((anteriores) => ({ ...anteriores, bodegas }));
    });
    listarProveedores({ tipo: TIPO_PROVEEDOR.DONANTE }).then(({ proveedores }) => {
      if (vigente) setCatalogosIngreso((anteriores) => ({ ...anteriores, proveedores }));
    });

    return () => {
      vigente = false;
    };
  }, []);
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
    observaciones,
    setObservaciones,
    detalles,
    agregarRenglon,
    quitarRenglon,
    actualizarRenglon,
    donantesOptions,
    proyectosOptions,
    modalNuevoDonante,
    setModalNuevoDonante,
    nuevoDonanteNombre,
    setNuevoDonanteNombre,
    nuevoDonanteTipo,
    setNuevoDonanteTipo,
    guardandoNuevoDonante,
    errorNuevoDonante,
    crearDonanteRapido,
    cerrarModalNuevoDonante,
    ofrecerIngresoInventario,
    setOfrecerIngresoInventario,
    resumenRegistro,
    guardando,
    error,
    guardarDonacion,
  } = useRegistroDonacion({ usuarioRol });

  // Nombre del donante de ESTA donacion, tomado de resumenRegistro (issue #756) y no del
  // donanteId en vivo: guardarDonacion() limpia el formulario -incluido donanteId- apenas
  // termina de guardar, para que los campos no se vean llenos como si nada hubiera pasado. El
  // nombre congelado en el resumen es lo unico que sigue disponible para resolver el proveedor
  // del ingreso (obtenerOCrearProveedorPorNombre()).
  const donanteNombre = resumenRegistro?.donanteNombre;

  // Resuelve el proveedor ANTES de abrir el formulario (issue #756): useRegistroIngreso.js solo
  // lee `proveedorIdInicial` en el primer render del modal, asi que tiene que llegar ya resuelto
  // -no hay forma limpia de actualizar un useState inicial despues de montado.
  const abrirFormularioIngreso = async () => {
    setResolviendoProveedor(true);
    const { proveedorId } = await obtenerOCrearProveedorPorNombre(
      donanteNombre,
      TIPO_PROVEEDOR.DONANTE,
    );

    // El select de "Proveedor / Donante" solo dibuja lo que trae catalogosIngreso.proveedores:
    // si obtenerOCrearProveedorPorNombre() acaba de crear uno, todavia no esta ahi -se cargo una
    // sola vez al montar la pagina-, y sin su <option> el select no tiene como mostrarlo.
    if (proveedorId) {
      setCatalogosIngreso((anteriores) => {
        const yaEsta = anteriores.proveedores.some((proveedor) => proveedor.id === proveedorId);
        if (yaEsta) return anteriores;
        return {
          ...anteriores,
          proveedores: [...anteriores.proveedores, { id: proveedorId, nombre: donanteNombre }],
        };
      });
    }

    setProveedorIdIngreso(proveedorId);
    setResolviendoProveedor(false);
    setFormularioIngresoAbierto(true);
  };

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
    <ScreenContainer>
      <PageHeader
        title="Registro de donación"
        subtitle="Donante, tipo de aporte y, si trae medicamentos, su ingreso al inventario"
        actions={[ACCION_VOLVER_A_DONACIONES]}
      />

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
                  {Object.values(TIPOS_DE_DONACION).map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {ETIQUETAS_TIPO_DONACION[tipo]}
                    </option>
                  ))}
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
                      className="btn-icono"
                      onClick={() => setModalNuevoDonante(true)}
                    >
                      <Plus size={14} aria-hidden="true" />
                      Nuevo donante
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

            <Col md={12}>
              <Form.Group controlId="formObservaciones">
                <Form.Label>Observaciones</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  disabled={!permisos?.puedeEscribir}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
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
              {tipoDonacion === TIPOS_DE_DONACION.DINERO && (
                <>
                  <Col md={7}>
                    <Form.Control
                      placeholder="Concepto / Observación"
                      disabled={!permisos?.puedeEscribir}
                      value={item.descripcion || ""}
                      onChange={(e) => actualizarRenglon(item.id, "descripcion", e.target.value)}
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
                  <Col md={5}>
                    <Form.Control
                      placeholder="Nombre de Medicamento / Lote"
                      disabled={!permisos?.puedeEscribir}
                      value={item.descripcion || ""}
                      onChange={(e) => actualizarRenglon(item.id, "descripcion", e.target.value)}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Control
                      type="number"
                      placeholder="Cantidad"
                      disabled={!permisos?.puedeEscribir}
                      value={item.cantidad || ""}
                      onChange={(e) => actualizarRenglon(item.id, "cantidad", e.target.value)}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Control
                      placeholder="Unidad"
                      disabled={!permisos?.puedeEscribir}
                      value={item.unidad || ""}
                      onChange={(e) => actualizarRenglon(item.id, "unidad", e.target.value)}
                    />
                  </Col>
                </>
              )}

              {tipoDonacion === "insumos" && (
                <>
                  <Col md={5}>
                    <Form.Control
                      placeholder="Descripción del insumo"
                      disabled={!permisos?.puedeEscribir}
                      value={item.descripcion || ""}
                      onChange={(e) => actualizarRenglon(item.id, "descripcion", e.target.value)}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Control
                      type="number"
                      placeholder="Cantidad"
                      disabled={!permisos?.puedeEscribir}
                      value={item.cantidad || ""}
                      onChange={(e) => actualizarRenglon(item.id, "cantidad", e.target.value)}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Control
                      placeholder="Unidad"
                      disabled={!permisos?.puedeEscribir}
                      value={item.unidad || ""}
                      onChange={(e) => actualizarRenglon(item.id, "unidad", e.target.value)}
                    />
                  </Col>
                </>
              )}

              {permisos?.puedeEscribir && detalles.length > 1 && (
                <Col md={1} className="text-end">
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => quitarRenglon(item.id)}
                    aria-label="Quitar renglón"
                    title="Quitar renglón"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                </Col>
              )}
            </Row>
          ))}

          {permisos?.puedeEscribir && (
            <SecondaryButton
              title="Agregar renglón"
              size="sm"
              onClick={agregarRenglon}
              className="mt-2"
            />
          )}
        </Card.Body>
      </Card>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error.mensaje}
          {error.campos && (
            <ul className="mb-0 mt-2 ps-3">
              {Object.values(error.campos).map((mensaje, indice) => (
                <li key={indice}>{mensaje}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}

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

      {ofrecerIngresoInventario && !formularioIngresoAbierto && (
        <Modal show onHide={() => setOfrecerIngresoInventario(false)} centered>
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
            <Button
              variant="secondary"
              onClick={() => setOfrecerIngresoInventario(false)}
              disabled={resolviendoProveedor}
            >
              No, omitir
            </Button>
            <Button
              variant="primary"
              onClick={abrirFormularioIngreso}
              disabled={resolviendoProveedor}
            >
              {resolviendoProveedor ? "Preparando..." : "Sí, ingresar a Inventario"}
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {formularioIngresoAbierto && (
        <ModalRegistroIngreso
          abierto={formularioIngresoAbierto}
          onClose={() => {
            setFormularioIngresoAbierto(false);
            setOfrecerIngresoInventario(false);
          }}
          catalogos={catalogosIngreso}
          usuarioId={perfil?.id}
          detallesDonacion={resumenRegistro?.detalles}
          proveedorIdInicial={proveedorIdIngreso}
          onExito={(movimientos, items) => {
            // Enlaza cada lote creado de vuelta a su renglon de donacion (issue #756): items y
            // movimientos vienen en el mismo orden (useRegistroIngreso.js), y solo los items que
            // partieron de un renglon de donacion traen donacionDetalleId.
            movimientos.forEach((movimiento, indice) => {
              const donacionDetalleId = items[indice]?.donacionDetalleId;
              if (donacionDetalleId) {
                enlazarLoteConDonacion(donacionDetalleId, movimiento.lote_id);
              }
            });
          }}
        />
      )}

      <Modal show={modalNuevoDonante} onHide={cerrarModalNuevoDonante} centered>
        <Modal.Header closeButton>
          <Modal.Title as="h5">Registrar Nuevo Donante</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small mb-3">
            Registro rápido de donante sin salir del formulario. El resto de los datos de contacto
            se completan después desde Donantes.
          </p>

          {errorNuevoDonante && (
            <Alert variant="danger" className="py-2">
              {errorNuevoDonante.mensaje}
            </Alert>
          )}

          <Form.Group controlId="formNuevoDonanteNombre" className="mb-3">
            <Form.Label>Nombre</Form.Label>
            <Form.Control
              placeholder="Nombre del Donante"
              value={nuevoDonanteNombre}
              onChange={(e) => setNuevoDonanteNombre(e.target.value)}
              disabled={guardandoNuevoDonante}
            />
          </Form.Group>

          <Form.Group controlId="formNuevoDonanteTipo">
            <Form.Label>Tipo</Form.Label>
            <Form.Select
              value={nuevoDonanteTipo}
              onChange={(e) => setNuevoDonanteTipo(e.target.value)}
              disabled={guardandoNuevoDonante}
            >
              {Object.values(TIPOS_DE_DONANTE).map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ETIQUETAS_TIPO_DONANTE[tipo]}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="primary"
            onClick={crearDonanteRapido}
            disabled={guardandoNuevoDonante || !nuevoDonanteNombre.trim()}
          >
            {guardandoNuevoDonante ? "Guardando..." : "Guardar y Seleccionar"}
          </Button>
        </Modal.Footer>
      </Modal>
    </ScreenContainer>
  );
}
