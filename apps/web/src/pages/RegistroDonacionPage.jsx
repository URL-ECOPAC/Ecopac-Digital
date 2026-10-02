import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  enlazarLoteConDonacion,
  ETIQUETAS_TIPO_DONACION,
  ETIQUETAS_TIPO_DONANTE,
  listarBodegas,
  listarMedicamentos,
  listarProveedores,
  obtenerProveedorDeDonante,
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
import AltaDeMedicamentoEnLinea from "../components/AltaDeMedicamentoEnLinea";
import CampoDeFormulario from "../components/CampoDeFormulario";
import ModalRegistroIngreso from "./ModalRegistroIngreso.jsx";
import { Plus, Trash2 } from "lucide-react";
import SecondaryButton from "../components/SecondaryButton";
import PrimaryButton from "../components/PrimaryButton";
import { EnFormulario } from "../components/contextoDeFormulario";

export default function RegistroDonacionPage({ usuarioRol }) {
  const { perfil } = useSesionCompartida();
  const navigate = useNavigate();
  const [catalogosIngreso, setCatalogosIngreso] = useState({
    medicamentos: [],
    insumos: [],
    bodegas: [],
    proveedores: [],
  });
  const [formularioIngresoAbierto, setFormularioIngresoAbierto] = useState(false);
  const [proveedorIdIngreso, setProveedorIdIngreso] = useState(null);
  const [resolviendoProveedor, setResolviendoProveedor] = useState(false);

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
    jornadaId,
    setJornadaId,
    jornadasOptions,
    proyectoFijadoPorJornada,
    fecha,
    setFecha,
    observaciones,
    setObservaciones,
    detalles,
    agregarRenglon,
    quitarRenglon,
    actualizarRenglon,
    camposDeRenglon,
    catalogosDeRenglon,
    altaDeMedicamento,
    resumenLegible,
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

  const donanteNombre = resumenRegistro?.donanteNombre;

  const abrirFormularioIngreso = async () => {
    setResolviendoProveedor(true);
    // El catalogo se vuelve a pedir: el que se cargo al montar no tiene lo que se dio de alta en
    // linea durante la donacion, y el ingreso mostraba ese renglon con su UUID y el selector en
    // blanco. El proveedor es el del donante, que la base crea con el (00175).
    const [{ proveedorId }, { medicamentos }] = await Promise.all([
      obtenerProveedorDeDonante(resumenRegistro?.donanteId),
      listarMedicamentos({ soloActivos: true }),
    ]);
    if (medicamentos) {
      setCatalogosIngreso((anteriores) => ({ ...anteriores, medicamentos }));
    }

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
        subtitle="Donante, tipo de aporte y, si trae medicamentos o insumos, su ingreso al inventario"
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

            {/* 00153: la donacion puede ser para una jornada; su proyecto sale de ella. */}
            <Col md={6}>
              <Form.Group controlId="formJornada">
                <Form.Label>Jornada</Form.Label>
                <Form.Select
                  disabled={!permisos?.puedeEscribir}
                  value={jornadaId}
                  onChange={(e) => setJornadaId(e.target.value)}
                >
                  <option value="">Sin jornada...</option>
                  {jornadasOptions.map((opt) => (
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
                  disabled={!permisos?.puedeEscribir || proyectoFijadoPorJornada}
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
                {proyectoFijadoPorJornada && (
                  <Form.Text muted>El proyecto es el de la jornada elegida.</Form.Text>
                )}
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
          {(detalles || []).map((item, indice) => (
            <div key={item.id} className="ec-renglon">
              <div className="ec-form-grid">
                {/* Todos los campos que el tipo declara (camposDeRenglonDeDonacion), salvo el
                    articulo del catalogo, que tiene control propio abajo. Solo se dibujaba
                    "cantidad", asi que una donacion en dinero o de servicios no tenia donde poner
                    el concepto ni el monto. */}
                {camposDeRenglon
                  .filter((campo) => campo.id !== "medicamentoId")
                  .map((campo) => {
                    const errorDeCampo = error?.campos?.[`detalles_${indice}_${campo.id}`];
                    return (
                      <CampoDeFormulario
                        key={campo.id}
                        campo={campo}
                        valor={item[campo.id]}
                        error={errorDeCampo}
                        catalogos={catalogosDeRenglon}
                        disabled={!permisos?.puedeEscribir}
                        onChange={(valor) => actualizarRenglon(item.id, campo.id, valor)}
                      />
                    );
                  })}

                {/* Medicamentos e insumos eligen del catalogo (00135, 00170). Las opciones ya
                    llegan filtradas por el tipo de la donacion, y el alta crea un articulo de ese
                    tipo. El renglon de insumos guardaba el id del articulo como descripcion. */}
                {camposDeRenglon
                  .filter((campo) => campo.id === "medicamentoId")
                  .map((campo) => {
                    const errorDeCampo = error?.campos?.[`detalles_${indice}_${campo.id}`];
                    const control = (
                      <CampoDeFormulario
                        key={campo.id}
                        campo={campo}
                        valor={item[campo.id]}
                        error={errorDeCampo}
                        catalogos={catalogosDeRenglon}
                        disabled={!permisos?.puedeEscribir}
                        onChange={(valor) => actualizarRenglon(item.id, campo.id, valor)}
                      />
                    );
                    if (!altaDeMedicamento.puedeCrear) return control;
                    return (
                      <div key={campo.id} className="ec-form-subgrid ec-form-grid--ancho">
                        {control}
                        {!altaDeMedicamento.abierto && (
                          <div className="ec-form-subgrid-accion">
                            <SecondaryButton
                              title={
                                tipoDonacion === TIPOS_DE_DONACION.INSUMOS
                                  ? "Nuevo insumo"
                                  : "Nuevo medicamento"
                              }
                              size="sm"
                              icon={<Plus size={14} aria-hidden="true" />}
                              onClick={() => altaDeMedicamento.abrir(item.id)}
                              disabled={!permisos?.puedeEscribir}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                {altaDeMedicamento.renglonId === item.id && (
                  <AltaDeMedicamentoEnLinea alta={altaDeMedicamento} />
                )}
              </div>

              {permisos?.puedeEscribir && detalles.length > 1 && (
                <div className="ec-renglon-accion">
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => quitarRenglon(item.id)}
                    aria-label={`Quitar renglón ${indice + 1}`}
                    title="Quitar renglón"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                </div>
              )}
            </div>
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
        <div className="ec-form-pie mb-4">
          <EnFormulario>
            <SecondaryButton
              title="Cancelar"
              onClick={() => navigate(ACCION_VOLVER_A_DONACIONES.to)}
              disabled={guardando}
            />
            <PrimaryButton
              title="Registrar donación"
              onClick={guardarDonacion}
              loading={guardando}
            />
          </EnFormulario>
        </div>
      )}

      {resumenLegible && (
        <Card className="mb-4">
          <Card.Header as="h5">{resumenLegible.titulo}</Card.Header>
          <Card.Body>
            <dl className="ec-recibo">
              {resumenLegible.datos.map((dato) => (
                <div key={dato.label}>
                  <dt>{dato.label}</dt>
                  <dd>{dato.valor}</dd>
                </div>
              ))}
            </dl>
            <ul className="ec-recibo-renglones">
              {resumenLegible.renglones.map((renglon) => (
                <li key={renglon.id}>
                  <span>{renglon.texto}</span>
                  {renglon.detalle && <strong>{renglon.detalle}</strong>}
                </li>
              ))}
            </ul>
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
              Se ha registrado una donación. ¿Desea generar automáticamente el registro de ingreso
              en el módulo de Inventario?
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
          bodegaIdInicial={resumenRegistro?.bodegaIdDeJornada}
          onExito={(movimientos, items) => {
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
            Registro rápido de donante sin salir del formulario.
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
          <EnFormulario>
            <SecondaryButton
              title="Cancelar"
              onClick={cerrarModalNuevoDonante}
              disabled={guardandoNuevoDonante}
            />
            <PrimaryButton
              title="Registrar donante"
              onClick={crearDonanteRapido}
              loading={guardandoNuevoDonante}
              disabled={!nuevoDonanteNombre.trim()}
            />
          </EnFormulario>
        </Modal.Footer>
      </Modal>
    </ScreenContainer>
  );
}
