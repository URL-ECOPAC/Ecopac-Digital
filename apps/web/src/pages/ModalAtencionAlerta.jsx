import { Table } from "react-bootstrap";
import { ETIQUETAS_ACCION_ALERTA, formatearFechaCorta } from "@ecopac/shared";

import ErrorState from "../components/ErrorState";
import Modal from "../components/Modal";
import NumberField from "../components/NumberField";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import Selector from "../components/Selector";

/**
 * "Registrar acción tomada" sobre una alerta de vencimiento (issue #899: el PR #881 se habia
 * llevado este flujo y ninguna alerta se podia atender desde la web). Todo el estado y las reglas
 * vienen de useAtencionAlertaCaducidad() (packages/shared): aqui solo se dibuja.
 *
 * @param {{ atencion: ReturnType<import("@ecopac/shared").useAtencionAlertaCaducidad>,
 *   errorBodegas?: { mensaje: string }|null }} props
 */
export default function ModalAtencionAlerta({ atencion, errorBodegas = null }) {
  const { alerta } = atencion;
  if (!alerta) return null;

  return (
    <Modal visible onClose={atencion.cerrar} title="Registrar Acción Tomada">
      {atencion.errorAtender && <ErrorState message={atencion.errorAtender} />}

      <dl className="ec-ficha-datos mb-3">
        <div>
          <dt className="ec-rotulo">Medicamento</dt>
          <dd className="mb-0">{alerta.medicamento}</dd>
        </div>
        <div>
          <dt className="ec-rotulo">Lote</dt>
          <dd className="mb-0 ec-mono">{alerta.numeroLote}</dd>
        </div>
        <div>
          <dt className="ec-rotulo">Vencimiento</dt>
          <dd className="mb-0">
            {alerta.fechaVencimiento ? formatearFechaCorta(alerta.fechaVencimiento) : "—"}
          </dd>
        </div>
      </dl>

      {/* Una alerta se puede repartir en varias acciones -parte donada, parte descartada- que
          sumen exacto lo que queda del lote (00143). */}
      {atencion.acciones.length > 0 && (
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
              {atencion.acciones.map((item) => (
                <tr key={item.id}>
                  <td>{ETIQUETAS_ACCION_ALERTA[item.accion] ?? item.accion}</td>
                  <td className="text-end">{item.cantidad}</td>
                  <td className="text-end">
                    <SecondaryButton
                      title="Quitar"
                      size="sm"
                      variant="neutra"
                      onClick={() => atencion.quitar(item.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <p className="ec-subseccion-vacio mb-3">{atencion.textoRestante}</p>

      {atencion.restante > 0 && (
        <>
          {atencion.errorRenglon && <ErrorState message={atencion.errorRenglon} />}

          {/* Un lote vencido no se reubica: opcionesAccion ya lo deja fuera, la misma regla que
              aplica fn_atender_alerta_caducidad en la base. */}
          <Selector
            label="Acción"
            requerido
            value={atencion.accionActual || null}
            options={atencion.opcionesAccion}
            onSelect={atencion.setAccionActual}
            placeholder="Selecciona una acción"
          />

          <NumberField
            label="Cantidad"
            requerido
            value={atencion.cantidadActual}
            onChange={atencion.setCantidadActual}
            min={1}
            max={atencion.restante}
          />

          {atencion.pideBodega && (
            <>
              {errorBodegas && <ErrorState message={errorBodegas.mensaje} />}
              <Selector
                label="Bodega destino"
                requerido
                value={atencion.bodegaDestinoActual || null}
                options={atencion.opcionesBodega}
                onSelect={(valor) => atencion.setBodegaDestinoActual(valor ?? "")}
                placeholder="Selecciona la bodega destino"
              />
            </>
          )}

          {/* Atender mueve o da de baja el stock: se dice antes de confirmar. */}
          {atencion.efecto && <p className="ec-subseccion-vacio mb-3">{atencion.efecto}</p>}

          <div className="mb-3">
            <SecondaryButton
              title="Agregar acción"
              onClick={atencion.agregar}
              disabled={atencion.agregarDeshabilitado}
            />
          </div>
        </>
      )}

      <div className="ec-form-pie">
        <SecondaryButton title="Cancelar" variant="neutra" onClick={atencion.cerrar} />
        <PrimaryButton
          title="Confirmar"
          onClick={atencion.confirmar}
          disabled={atencion.confirmarDeshabilitado}
          loading={atencion.confirmando}
        />
      </div>
    </Modal>
  );
}
