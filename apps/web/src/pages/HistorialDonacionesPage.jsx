import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ESTADOS_DE_DONACION,
  ETIQUETAS_TIPO_DONACION,
  formatearMoneda,
  TIPOS_DE_DONACION,
  useHistorialDonaciones,
} from "@ecopac/shared";
import {
  Container,
  Card,
  Form,
  Button,
  Table,
  Badge,
  Alert,
  Modal,
  Spinner,
} from "react-bootstrap";

import DateField from "../components/DateField";
import PageHeader from "../components/PageHeader";
import SecondaryButton from "../components/SecondaryButton";
import Selector from "../components/Selector";
import StatCard from "../components/StatCard";
import TextField from "../components/TextField";
import { ACCION_VOLVER_A_DONACIONES } from "./donacionesNavegacion";
import ScreenContainer from "../components/ScreenContainer";

export default function HistorialDonacionesPage({ usuarioRol }) {
  const {
    tieneAccesoLectura,
    cargando,
    error,
    donaciones,
    totalesPorTipo,
    filtros,
    modalDetalle,
    anulacion,
  } = useHistorialDonaciones({ usuarioRol });

  // Issue #756: motivo de anulacion, local a la pantalla porque solo una donacion esta
  // seleccionada a la vez (el modal de detalle ya es el contexto de "cual").
  const [anulando, setAnulando] = useState(false);
  const [motivoAnular, setMotivoAnular] = useState("");

  const cerrarDetalleYAnulacion = () => {
    setAnulando(false);
    setMotivoAnular("");
    modalDetalle.cerrarDetalle();
  };

  const confirmarAnulacion = async () => {
    const resultado = await anulacion.anular(modalDetalle.donacionSeleccionada.id, motivoAnular);
    if (resultado.ok) {
      setAnulando(false);
      setMotivoAnular("");
    }
  };

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
        title="Historial de donaciones recibidas"
        subtitle="Consulta, detalle y anulación de las donaciones registradas"
        actions={[ACCION_VOLVER_A_DONACIONES]}
      />

      {error && (
        <Alert variant="danger">
          No se pudo cargar el historial: {error.mensaje || "error inesperado."}
        </Alert>
      )}

      {/* Totales por tipo con StatCard, como el resumen de donaciones, inventario y presupuestos.
          Eran tres <Card> de Bootstrap con borde azul, verde y celeste, fondo gris y el monto con
          toFixed(2) en vez de formatearMoneda. */}
      <div className="ec-kpis">
        <StatCard
          label="Total en dinero"
          value={formatearMoneda(totalesPorTipo?.dinero || 0)}
          accent="var(--accent-donaciones)"
          esTexto
        />
        <StatCard
          label="Medicamentos"
          value={totalesPorTipo?.medicamentos || 0}
          caption="unidades"
          accent="var(--color-primary)"
        />
        <StatCard
          label="Insumos y bienes"
          value={totalesPorTipo?.insumos || 0}
          caption="items"
          accent="var(--color-warning)"
        />
      </div>

      {/* Filtros con la barra comun: mismas etiquetas, mismo "Limpiar filtros" al final. */}
      <div className="ec-filtros">
        <div className="ec-filtro ec-filtro--busqueda">
          <TextField
            label="Buscar donante"
            placeholder="Nombre del donante"
            value={filtros.filtroDonante}
            onChange={(e) => filtros.setFiltroDonante(e.target.value)}
            style={{ marginBottom: 0 }}
          />
        </div>
        <div className="ec-filtro">
          <Selector
            label="Tipo"
            value={filtros.filtroTipo || null}
            options={Object.values(TIPOS_DE_DONACION).map((tipo) => ({
              value: tipo,
              label: ETIQUETAS_TIPO_DONACION[tipo],
            }))}
            onSelect={(valor) => filtros.setFiltroTipo(valor ?? "")}
            placeholder="Todos los tipos"
            style={{ marginBottom: 0 }}
          />
        </div>
        <div className="ec-filtro">
          <Selector
            label="Proyecto"
            value={filtros.filtroProyecto || null}
            options={filtros.proyectosOptions ?? []}
            onSelect={(valor) => filtros.setFiltroProyecto(valor ?? "")}
            placeholder="Todos los proyectos"
            disabled={(filtros.proyectosOptions ?? []).length === 0}
            style={{ marginBottom: 0 }}
          />
        </div>
        <fieldset className="ec-filtro ec-filtro--rango">
          <legend className="form-label">Fecha</legend>
          <div className="ec-rango-doble">
            <DateField
              aria-label="Fecha: desde"
              value={filtros.fechaInicio || null}
              onChange={(valor) => filtros.setFechaInicio(valor ?? "")}
              style={{ marginBottom: 0 }}
            />
            <span className="ec-rango-separador" aria-hidden="true">
              -
            </span>
            <DateField
              aria-label="Fecha: hasta"
              value={filtros.fechaFin || null}
              onChange={(valor) => filtros.setFechaFin(valor ?? "")}
              style={{ marginBottom: 0 }}
            />
          </div>
        </fieldset>
        <div className="ec-filtros-limpiar">
          <SecondaryButton
            title="Limpiar filtros"
            variant="neutra"
            onClick={filtros.limpiarFiltros}
          />
        </div>
      </div>

      {/* Tabla de Historial */}
      <Card>
        <Card.Header className="bg-transparent">
          <h2 className="ec-seccion-titulo mb-0">Listado de donaciones</h2>
        </Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover striped className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Donante</th>
                <th>Tipo</th>
                <th>Resumen Detalle</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted py-4">
                    <Spinner animation="border" size="sm" className="me-2" />
                    Cargando donaciones...
                  </td>
                </tr>
              ) : (donaciones || []).length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted py-4">
                    No se encontraron registros de donaciones con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                donaciones.map((d) => {
                  const esAnulada = d.estado === ESTADOS_DE_DONACION.ANULADA;
                  return (
                    <tr key={d.id} className={esAnulada ? "table-danger text-muted" : ""}>
                      <td>{d.fecha}</td>
                      <td className="fw-semibold">{d.donanteNombre || "-"}</td>
                      <td>{ETIQUETAS_TIPO_DONACION[d.tipo] ?? d.tipo}</td>
                      <td>{esAnulada ? <del>{d.resumen || "-"}</del> : d.resumen || "-"}</td>
                      <td>
                        {esAnulada ? (
                          <Badge bg="danger">Anulada</Badge>
                        ) : (
                          <Badge bg="success">Activa</Badge>
                        )}
                      </td>
                      <td className="text-end">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-2"
                          onClick={() => modalDetalle.abrirDetalle(d)}
                        >
                          Ver Detalle
                        </Button>
                        {/* La fila viaja en el state para que la constancia se dibuje sin una
                            segunda consulta; si se entra por URL la resuelve obtenerDonacion(). */}
                        <Button
                          as={Link}
                          to={`/donaciones/${d.id}/constancia`}
                          state={{ donacion: d }}
                          variant="outline-secondary"
                          size="sm"
                        >
                          Constancia
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* Modal de Detalle Completo */}
      {modalDetalle.modalDetalleAbierto && modalDetalle.donacionSeleccionada && (
        <Modal show={modalDetalle.modalDetalleAbierto} onHide={cerrarDetalleYAnulacion} centered>
          <Modal.Header closeButton>
            <Modal.Title as="h5">
              Detalle de Donación #{modalDetalle.donacionSeleccionada.id}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="mb-3">
              <p className="mb-1">
                <strong>Donante:</strong> {modalDetalle.donacionSeleccionada.donanteNombre || "-"}
              </p>
              <p className="mb-1">
                <strong>Tipo:</strong>{" "}
                {ETIQUETAS_TIPO_DONACION[modalDetalle.donacionSeleccionada.tipo] ??
                  modalDetalle.donacionSeleccionada.tipo}
              </p>
              <p className="mb-1">
                <strong>Fecha:</strong> {modalDetalle.donacionSeleccionada.fecha}
              </p>
              <p className="mb-1">
                <strong>Estado:</strong> {modalDetalle.donacionSeleccionada.estado}
              </p>
            </div>

            {modalDetalle.donacionSeleccionada.estado === ESTADOS_DE_DONACION.ANULADA && (
              <Alert variant="danger" className="mb-3">
                <p className="mb-1">
                  <strong>Motivo de Anulación:</strong>{" "}
                  {modalDetalle.donacionSeleccionada.motivoAnulacion || "No informado"}
                </p>
                <p className="mb-1">
                  <strong>Anulada por:</strong>{" "}
                  {modalDetalle.donacionSeleccionada.anuladaPorNombre || "-"}
                </p>
                <p className="mb-0">
                  <strong>Fecha de Anulación:</strong>{" "}
                  {modalDetalle.donacionSeleccionada.anuladaEn || "-"}
                </p>
              </Alert>
            )}

            <hr />
            <h6 className="fw-bold mb-2">Renglones del Detalle:</h6>
            <ul className="mb-0 ps-3">
              {(modalDetalle.donacionSeleccionada.detalles || []).length === 0 ? (
                <li>Sin detalles registrados</li>
              ) : (
                modalDetalle.donacionSeleccionada.detalles.map((item) => (
                  <li key={item.id}>
                    {item.descripcion}
                    {item.cantidad !== null && item.cantidad !== undefined
                      ? ` - ${item.cantidad} ${item.unidad || "unidades"}`
                      : ""}
                    {item.monto !== null && item.monto !== undefined
                      ? ` - Q ${Number(item.monto).toFixed(2)}`
                      : ""}
                  </li>
                ))
              )}
            </ul>

            {/* Issue #756: anularDonacion() ya existia (issue #635), sin ningun boton que la
                llamara. */}
            {anulacion.puedeAnular &&
              modalDetalle.donacionSeleccionada.estado !== ESTADOS_DE_DONACION.ANULADA && (
                <>
                  <hr />
                  {anulacion.errorAnular && (
                    <Alert variant="danger" className="py-2">
                      {anulacion.errorAnular.mensaje}
                    </Alert>
                  )}
                  {anulando ? (
                    <Form.Group controlId="formMotivoAnulacion">
                      <Form.Label>Motivo de la anulación</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={motivoAnular}
                        onChange={(e) => setMotivoAnular(e.target.value)}
                        disabled={anulacion.anulando}
                      />
                    </Form.Group>
                  ) : (
                    <Button variant="outline-danger" size="sm" onClick={() => setAnulando(true)}>
                      Anular donación
                    </Button>
                  )}
                </>
              )}
          </Modal.Body>
          <Modal.Footer>
            {anulando ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAnulando(false);
                    setMotivoAnular("");
                  }}
                  disabled={anulacion.anulando}
                >
                  Cancelar anulación
                </Button>
                <Button
                  variant="danger"
                  onClick={confirmarAnulacion}
                  disabled={anulacion.anulando || !motivoAnular.trim()}
                >
                  {anulacion.anulando ? "Anulando..." : "Confirmar anulación"}
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={cerrarDetalleYAnulacion}>
                Cerrar
              </Button>
            )}
          </Modal.Footer>
        </Modal>
      )}
    </ScreenContainer>
  );
}
