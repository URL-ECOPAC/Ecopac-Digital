import { useState } from "react";
import { Table } from "react-bootstrap";
import {
  accionesPermitidasParaAlerta,
  efectoDeAccionSobreElStock,
  ETIQUETAS_ACCION_ALERTA,
  formatearFechaConHora,
  formatearFechaCorta,
  OPCIONES_ACCION_ALERTA,
  requiereBodegaDestino,
  useAlertasVencimiento,
} from "@ecopac/shared";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import Modal from "../components/Modal";
import NumberField from "../components/NumberField";
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
  } = useAlertasVencimiento({ usuarioId, rolUsuario });

  const [alertaAtendiendo, setAlertaAtendiendo] = useState(null);
  // Acciones ya agregadas a la lista que se va a mandar al confirmar (PLAN.md punto 5: una
  // alerta se puede repartir en varias, en vez de una sola sobre el total).
  const [acciones, setAcciones] = useState([]);
  // El renglon que se esta armando, todavia sin agregar a la lista de arriba.
  const [accionActual, setAccionActual] = useState("");
  const [cantidadActual, setCantidadActual] = useState(null);
  const [bodegaDestinoActual, setBodegaDestinoActual] = useState("");
  const [errorRenglon, setErrorRenglon] = useState(null);
  // El fallo se muestra dentro del modal, junto al boton que lo provoco, en vez de en un alert()
  // del navegador que tapa la pantalla y se lleva el contexto al cerrarse (issue #762).
  const [errorAtender, setErrorAtender] = useState(null);

  const limpiarRenglonActual = () => {
    setAccionActual("");
    setCantidadActual(null);
    setBodegaDestinoActual("");
    setErrorRenglon(null);
  };

  const handleAtender = (alerta) => {
    setAlertaAtendiendo(alerta);
    setAcciones([]);
    limpiarRenglonActual();
    setErrorAtender(null);
  };

  // El total a repartir es cantidadDisponible -lo que de verdad queda hoy en el lote (issue
  // #859), no cantidadAfectada, que es la instantanea congelada al generar la alerta y no baja
  // cuando se registra una salida del lote por fuera de este flujo. El servidor vuelve a validar
  // contra el disponible VIVO del lote (00143) de todas formas: si alguien mas lo movio entre que
  // se cargo esta pantalla y que se confirma, el mensaje de error del RPC trae el numero correcto
  // para ajustar la lista.
  const totalDisponible = alertaAtendiendo?.cantidadDisponible ?? 0;
  const asignado = acciones.reduce((total, item) => total + item.cantidad, 0);
  const restante = totalDisponible - asignado;

  const agregarDeshabilitado =
    !accionActual ||
    !(cantidadActual > 0) ||
    cantidadActual > restante ||
    (requiereBodegaDestino(accionActual) && !bodegaDestinoActual);

  const agregarAccionALaLista = () => {
    setErrorRenglon(null);

    if (!accionActual) {
      setErrorRenglon("Selecciona una acción.");
      return;
    }
    if (!(cantidadActual > 0)) {
      setErrorRenglon("La cantidad debe ser mayor a cero.");
      return;
    }
    if (cantidadActual > restante) {
      setErrorRenglon(`No puedes asignar más de lo que falta (${restante}).`);
      return;
    }
    if (requiereBodegaDestino(accionActual) && !bodegaDestinoActual) {
      setErrorRenglon("Para reubicar hay que elegir la bodega destino.");
      return;
    }

    setAcciones((anteriores) => [
      ...anteriores,
      {
        id: Date.now(),
        accion: accionActual,
        cantidad: cantidadActual,
        bodegaDestinoId: requiereBodegaDestino(accionActual) ? bodegaDestinoActual : undefined,
      },
    ]);
    limpiarRenglonActual();
  };

  const quitarAccionDeLaLista = (id) => {
    setAcciones((anteriores) => anteriores.filter((item) => item.id !== id));
  };

  const confirmarAtender = async () => {
    if (!alertaAtendiendo || restante !== 0) return;
    setErrorAtender(null);
    try {
      await marcarComoAtendida(alertaAtendiendo.id, acciones, totalDisponible);
      setAlertaAtendiendo(null);
      setAcciones([]);
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
            <th className="text-end">Cantidad disponible</th>
            <th>Vencimiento</th>
            <th className="text-center">{sonVencidas ? "Dias vencido" : "Dias restantes"}</th>
            <th className="text-end">Acción</th>
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
        subtitle={`Lotes que vencen en los próximos 30 días o que ya vencieron • ${cantidadPendientes} pendientes`}
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

      {/* Lo ya atendido (issue #755): la alerta atendida desaparece de las dos listas de arriba, y
          sin este bloque no quedaba en ninguna pantalla que se hizo con ella, quien ni cuando.
          Su fallo se dice aqui y no tapa las pendientes, que son las que piden accion. */}
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
                    <td>
                      {alerta.accion ? (
                        <StatusChip
                          status="atendida"
                          label={ETIQUETAS_ACCION_ALERTA[alerta.accion] ?? alerta.accion}
                        />
                      ) : (
                        // accion queda NULL cuando la alerta se repartio en varias (00143): el
                        // desglose completo vive en alerta.detalle.
                        <div className="d-flex flex-column gap-1">
                          {(alerta.detalle ?? []).map((item, indice) => (
                            <span key={indice} className="small">
                              {ETIQUETAS_ACCION_ALERTA[item.accion] ?? item.accion}: {item.cantidad}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>{alerta.atendidaPorNombre ?? "—"}</td>
                    <td>{alerta.atendidaEn ? formatearFechaConHora(alerta.atendidaEn) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
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

          {/* Una alerta ya no se resuelve con una sola accion sobre el total: se pueden agregar
              varias -parte donada, parte descartada- mientras sumen exacto lo que falta
              (PLAN.md punto 5). Lo ya agregado se lista abajo, con su propio boton para quitarlo
              antes de confirmar. */}
          {acciones.length > 0 && (
            <div className="ec-tabla mb-3">
              <Table responsive size="sm" className="mb-0">
                <thead>
                  <tr>
                    <th>Acción</th>
                    <th className="text-end">Cantidad</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {acciones.map((item) => (
                    <tr key={item.id}>
                      <td>{ETIQUETAS_ACCION_ALERTA[item.accion] ?? item.accion}</td>
                      <td className="text-end">{item.cantidad}</td>
                      <td className="text-end">
                        <SecondaryButton
                          title="Quitar"
                          size="sm"
                          variant="neutra"
                          onClick={() => quitarAccionDeLaLista(item.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}

          <p className="ec-subseccion-vacio mb-3">
            {restante > 0
              ? `Faltan ${restante} de ${totalDisponible} unidades por asignar.`
              : "Todas las unidades quedaron asignadas."}
          </p>

          {restante > 0 && (
            <>
              {errorRenglon && <ErrorState message={errorRenglon} />}

              {/* Un lote vencido no se reubica: accionesPermitidasParaAlerta() lo deja fuera, la
                  misma regla que aplica fn_atender_alerta_caducidad (00138/00143) en la base. */}
              <Selector
                label="Acción *"
                value={accionActual || null}
                options={accionesPermitidasParaAlerta(alertaAtendiendo, OPCIONES_ACCION_ALERTA)}
                onSelect={(valor) => {
                  setAccionActual(valor ?? "");
                  setBodegaDestinoActual("");
                }}
                placeholder="Selecciona una acción"
              />

              <NumberField
                label="Cantidad *"
                value={cantidadActual}
                onChange={setCantidadActual}
                min={1}
                max={restante}
              />

              {requiereBodegaDestino(accionActual) && (
                <>
                  {errorBodegas && <ErrorState message={errorBodegas.mensaje} />}
                  <Selector
                    label="Bodega destino *"
                    value={bodegaDestinoActual || null}
                    options={bodegas.map((bodega) => ({ value: bodega.id, label: bodega.nombre }))}
                    onSelect={(valor) => setBodegaDestinoActual(valor ?? "")}
                    placeholder="Selecciona la bodega destino"
                  />
                </>
              )}

              {/* Atender ya no es solo cerrar la alerta: mueve o da de baja el stock (issue
                  #755). Se dice antes de confirmar, no despues. */}
              {accionActual && cantidadActual > 0 && (
                <p className="ec-subseccion-vacio mb-3">
                  {efectoDeAccionSobreElStock(accionActual, cantidadActual)}
                </p>
              )}

              <div className="mb-3">
                <SecondaryButton
                  title="Agregar acción"
                  onClick={agregarAccionALaLista}
                  disabled={agregarDeshabilitado}
                />
              </div>
            </>
          )}

          <div className="ec-form-pie">
            <SecondaryButton
              title="Cancelar"
              variant="neutra"
              onClick={() => {
                setAlertaAtendiendo(null);
                setErrorAtender(null);
              }}
            />
            <PrimaryButton title="Confirmar" onClick={confirmarAtender} disabled={restante !== 0} />
          </div>
        </Modal>
      )}
    </div>
  );
}
