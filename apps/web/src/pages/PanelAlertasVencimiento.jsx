import { Table } from "react-bootstrap";
import {
  describirEtapa,
  etiquetaAccionTomada,
  formatearFechaConHora,
  formatearFechaCorta,
  useAlertasVencimiento,
  useAtencionAlertaCaducidad,
} from "@ecopac/shared";

import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import SecondaryButton from "../components/SecondaryButton";
import SectionHeader from "../components/SectionHeader";
import StatusChip from "../components/StatusChip";
import TextField from "../components/TextField";
import ModalAtencionAlerta from "./ModalAtencionAlerta";

// Urgencia de un lote por vencer, para el color del chip: cuanto mas cerca, mas fuerte. Los 7
// dias son un nivel visual, no la regla de los avisos (esa es la configuracion, issue #899).
const DIAS_CRITICOS = 7;

/**
 * Pestana "Alertas" de Inventario (issue #268, RF-19).
 *
 * Issue #899: el PR #881 dejo este panel sin `rolUsuario` -asi que nunca sincronizaba las alertas-
 * y sin el flujo de "Registrar acción tomada", de modo que ninguna alerta se podia atender desde
 * la web y las pendientes bloqueaban los avisos siguientes. Ambas cosas vuelven, con el estado
 * del formulario en packages/shared (useAtencionAlertaCaducidad).
 *
 * @param {{ rolUsuario: string }} props
 */
export default function PanelAlertasVencimiento({ rolUsuario }) {
  const {
    porVencer,
    vencidas,
    cantidadPendientes,
    atendidas,
    errorAtendidas,
    bodegas,
    errorBodegas,
    cargando,
    error,
    recargar,
    busqueda,
    setBusqueda,
    marcarComoAtendida,
    puedeAtender,
    puedeConfigurar,
    resumenAvisos,
    textoSinPorVencer,
    textoVentana,
  } = useAlertasVencimiento({ rolUsuario });

  const atencion = useAtencionAlertaCaducidad({ marcarComoAtendida, bodegas });

  if (cargando) return <LoadingState />;
  if (error) return <ErrorState message={error.mensaje} onRetry={recargar} />;

  const tablaDeAlertas = (alertas, { vencidas: sonVencidas }) => (
    <div className="ec-tabla">
      <Table responsive hover className="mb-0">
        <thead>
          <tr>
            <th>Medicamento</th>
            <th>Lote</th>
            <th className="text-end">Cantidad disponible</th>
            <th>Vencimiento</th>
            <th className="text-center">{sonVencidas ? "Días vencido" : "Días restantes"}</th>
            <th>Último aviso</th>
            {puedeAtender && <th className="text-end">Acción</th>}
          </tr>
        </thead>
        <tbody>
          {alertas.map((alerta) => (
            <tr key={alerta.id}>
              <td>
                <strong>{alerta.medicamento}</strong>
              </td>
              <td className="ec-mono">{alerta.numeroLote}</td>
              <td className="text-end">{alerta.cantidadDisponible}</td>
              <td>
                {alerta.fechaVencimiento ? formatearFechaCorta(alerta.fechaVencimiento) : "—"}
              </td>
              <td className="text-center">
                <StatusChip
                  status={
                    sonVencidas || alerta.diasRestantes <= DIAS_CRITICOS ? "critico" : "por vencer"
                  }
                  label={
                    sonVencidas
                      ? `${Math.abs(alerta.diasRestantes)}d`
                      : alerta.diasRestantes === 0
                        ? "HOY"
                        : `${alerta.diasRestantes}d`
                  }
                />
              </td>
              <td>{describirEtapa(alerta.umbralNotificadoDias)}</td>
              {puedeAtender && (
                <td className="text-end">
                  <SecondaryButton
                    title={sonVencidas ? "Registrar baja" : "Atender"}
                    size="sm"
                    variant={sonVencidas ? "peligro" : "outline"}
                    onClick={() => atencion.abrir(alerta)}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );

  return (
    <div>
      <SectionHeader
        title="Alertas de vencimiento"
        subtitle={`${textoVentana} • ${cantidadPendientes} pendientes • Avisos: ${resumenAvisos}`}
        actions={
          puedeConfigurar
            ? [
                {
                  label: "Configurar avisos",
                  to: "/inventario/avisos-vencimiento",
                  variant: "outline",
                },
              ]
            : []
        }
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
          <p className="ec-subseccion-vacio">{textoSinPorVencer}</p>
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

      {/* Lo ya atendido (issue #755): que se hizo, quien y cuando. Su fallo se dice aqui y no tapa
          las pendientes, que son las que piden accion. */}
      <section className="ec-subseccion" style={{ "--ec-acento": "var(--color-success)" }}>
        <h3 className="ec-subseccion-titulo">Atendidas recientemente ({atendidas.length})</h3>
        {errorAtendidas ? (
          <ErrorState message={errorAtendidas.mensaje} onRetry={recargar} />
        ) : atendidas.length === 0 ? (
          <p className="ec-subseccion-vacio">Todavía no se ha atendido ninguna alerta</p>
        ) : (
          <div className="ec-tabla">
            <Table responsive hover className="mb-0">
              <thead>
                <tr>
                  <th>Medicamento</th>
                  <th>Lote</th>
                  <th>Acción tomada</th>
                  <th>Atendida por</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {atendidas.map((alerta) => (
                  <tr key={alerta.id}>
                    <td>
                      <strong>{alerta.medicamento}</strong>
                    </td>
                    <td className="ec-mono">{alerta.numeroLote}</td>
                    <td>{etiquetaAccionTomada(alerta, bodegas)}</td>
                    <td>
                      {alerta.cerradaSinExistencia ? "Sistema" : (alerta.atendidaPorNombre ?? "—")}
                    </td>
                    <td>{alerta.atendidaEn ? formatearFechaConHora(alerta.atendidaEn) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>

      <ModalAtencionAlerta atencion={atencion} errorBodegas={errorBodegas} />
    </div>
  );
}
