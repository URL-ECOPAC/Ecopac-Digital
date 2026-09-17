import { useState } from "react";
import { Table } from "react-bootstrap";
import { formatearFechaCorta, OPCIONES_ACCION_ALERTA, useAlertasVencimiento } from "@ecopac/shared";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import SectionHeader from "../components/SectionHeader";
import Selector from "../components/Selector";
import StatusChip from "../components/StatusChip";
import TextField from "../components/TextField";

export default function PanelAlertasVencimiento({ usuarioId, rolUsuario }) {
  const {
    porVencer,
    vencidas,
    cantidadPendientes,
    cargando,
    error,
    recargar,
    busqueda,
    setBusqueda,
    marcarComoAtendida,
  } = useAlertasVencimiento({ usuarioId, rolUsuario });

  const [alertaAtendiendo, setAlertaAtendiendo] = useState(null);
  const [accionTomada, setAccionTomada] = useState("");
  // El fallo se muestra dentro del modal, junto al boton que lo provoco, en vez de en un alert()
  // del navegador que tapa la pantalla y se lleva el contexto al cerrarse (issue #762).
  const [errorAtender, setErrorAtender] = useState(null);

  const handleAtender = (alerta) => {
    setAlertaAtendiendo(alerta);
    setAccionTomada("");
    setErrorAtender(null);
  };

  const confirmarAtender = async () => {
    if (!alertaAtendiendo) return;
    setErrorAtender(null);
    try {
      await marcarComoAtendida(alertaAtendiendo.id, accionTomada);
      setAlertaAtendiendo(null);
      setAccionTomada("");
    } catch (error) {
      setErrorAtender(error.message || "No se pudo registrar la acción");
    }
  };

  // formatearFechaCorta y no new Date(fecha).toLocaleDateString(): una fecha "2026-09-20" leida
  // con new Date es la medianoche UTC, que en Guatemala todavia es el dia 19.
  const formatoFecha = (fecha) => (fecha ? formatearFechaCorta(fecha) : "—");

  // Urgencia de un lote por vencer: cuanto mas cerca, mas fuerte. Antes era al reves -dentro de
  // 30 dias salia en VERDE, el color de "todo bien"- y un lote que vence en cinco dias se leia
  // como el menos preocupante de la tabla.
  const estadoDeUrgencia = (dias) =>
    dias <= 7 ? "critico" : dias <= 30 ? "por vencer" : "disponible";

  if (cargando) return <LoadingState />;
  if (error) return <ErrorState message={error.mensaje} onRetry={recargar} />;

  const tablaDeAlertas = (alertas, { vencidas: sonVencidas }) => (
    <div className="ec-tabla">
      <Table responsive hover className="mb-0">
        <thead>
          <tr>
            <th>Medicamento</th>
            <th>Lote</th>
            <th className="text-end">Cantidad afectada</th>
            <th>Vencimiento</th>
            <th className="text-center">{sonVencidas ? "Dias vencido" : "Dias restantes"}</th>
            <th className="text-end">Accion</th>
          </tr>
        </thead>
        <tbody>
          {alertas.map((alerta) => (
            <tr key={alerta.id}>
              <td>
                <strong>{alerta.medicamento}</strong>
              </td>
              <td className="ec-mono">{alerta.numeroLote}</td>
              <td className="text-end">{alerta.cantidadAfectada}</td>
              <td>{formatoFecha(alerta.fechaVencimiento)}</td>
              <td className="text-center">
                <StatusChip
                  status={sonVencidas ? "critico" : estadoDeUrgencia(alerta.diasRestantes)}
                  label={
                    sonVencidas
                      ? `${Math.abs(alerta.diasRestantes)}d`
                      : alerta.diasRestantes === 0
                        ? "HOY"
                        : `${alerta.diasRestantes}d`
                  }
                />
              </td>
              <td className="text-end">
                <SecondaryButton
                  title={sonVencidas ? "Registrar baja" : "Atender"}
                  size="sm"
                  variant={sonVencidas ? "peligro" : "outline"}
                  onClick={() => handleAtender(alerta)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );

  return (
    <div>
      {/* La pestana se titula con SectionHeader, y sus dos listas con un rotulo en versalitas
          dentro de su propio bloque: antes las tres usaban el mismo titulo con filete, y
          "Alertas de vencimiento" se confundia con "Proximos a vencer" y "Vencidos". */}
      <SectionHeader
        title="Alertas de vencimiento"
        subtitle={`Medicamentos próximos a caducar (próximos 30 días) • ${cantidadPendientes} pendientes`}
      />

      <div className="ec-filtros">
        <div className="ec-filtro ec-filtro--busqueda">
          <TextField
            label="Buscar alerta"
            placeholder="Buscar medicamento o lote..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ marginBottom: 0 }}
          />
        </div>
      </div>

      <section className="ec-subseccion" style={{ "--ec-acento": "var(--color-warning)" }}>
        <h3 className="ec-subseccion-titulo">Próximos a vencer ({porVencer.length})</h3>
        {porVencer.length === 0 ? (
          <p className="ec-subseccion-vacio">No hay lotes por vencer en los próximos 30 días</p>
        ) : (
          tablaDeAlertas(porVencer, { vencidas: false })
        )}
      </section>

      <section className="ec-subseccion" style={{ "--ec-acento": "var(--color-danger)" }}>
        <h3 className="ec-subseccion-titulo">Vencidos — Para dar de baja ({vencidas.length})</h3>
        {vencidas.length === 0 ? (
          <p className="ec-subseccion-vacio">No hay lotes vencidos</p>
        ) : (
          tablaDeAlertas(vencidas, { vencidas: true })
        )}
      </section>

      {/* El Modal del catalogo: se cierra al tocar fuera o con Escape, como todos. Se monta solo
          mientras hay una alerta elegida, para que al confirmar desaparezca en el acto. */}
      {alertaAtendiendo && (
        <Modal
          visible
          onClose={() => {
            setAlertaAtendiendo(null);
            setErrorAtender(null);
          }}
          title="Registrar Acción Tomada"
        >
          {errorAtender && <ErrorState message={errorAtender} />}

          <dl className="ec-ficha-datos mb-3">
            <div>
              <dt className="ec-rotulo">Medicamento</dt>
              <dd className="mb-0">{alertaAtendiendo.medicamento}</dd>
            </div>
            <div>
              <dt className="ec-rotulo">Lote</dt>
              <dd className="mb-0 ec-mono">{alertaAtendiendo.numeroLote}</dd>
            </div>
            <div>
              <dt className="ec-rotulo">Vencimiento</dt>
              <dd className="mb-0">{formatoFecha(alertaAtendiendo.fechaVencimiento)}</dd>
            </div>
          </dl>

          <Selector
            label="Acción tomada *"
            value={accionTomada || null}
            options={OPCIONES_ACCION_ALERTA}
            onSelect={(valor) => setAccionTomada(valor ?? "")}
            placeholder="Selecciona una acción"
          />

          <div className="ec-form-pie">
            <SecondaryButton
              title="Cancelar"
              variant="neutra"
              onClick={() => {
                setAlertaAtendiendo(null);
                setErrorAtender(null);
              }}
            />
            <PrimaryButton
              title="Confirmar"
              onClick={confirmarAtender}
              disabled={!accionTomada.trim()}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
