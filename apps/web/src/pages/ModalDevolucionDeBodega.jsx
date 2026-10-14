import { X } from "lucide-react";

import { formatearFechaCorta, useDevolucionDeBodegaDeJornada } from "@ecopac/shared";

import Modal from "../components/Modal";
import NumberField from "../components/NumberField";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import Selector from "../components/Selector";

/** "Amoxicilina (500 mg) · Lote L-1 · vence 31/01/2027 · 30 de esta jornada" */
function etiquetaDeLote(fila) {
  const vence = fila.fechaVencimiento
    ? `vence ${formatearFechaCorta(fila.fechaVencimiento)}`
    : "no vence";
  return `${fila.articulo} · Lote ${fila.numeroLote ?? "—"} · ${vence} · ${fila.cantidadDisponible} de esta jornada`;
}

/**
 * "Devolver a otra bodega" de la pestana Insumos de una jornada (00179): lo que sobra en la bodega
 * movil vuelve a una bodega fija. Estado y llamada en useDevolucionDeBodegaDeJornada(); aqui solo
 * se dibuja.
 */
export default function ModalDevolucionDeBodega({
  visible,
  jornadaId,
  bodega,
  contenido,
  rol,
  onClose,
  onDevuelto,
}) {
  const {
    lotes,
    claveLote,
    seleccionarLote,
    bodegasDestino,
    bodegaDestinoId,
    setBodegaDestinoId,
    cantidad,
    setCantidad,
    avisoCantidad,
    puedeGuardar,
    guardando,
    error,
    guardar,
  } = useDevolucionDeBodegaDeJornada({
    jornadaId,
    bodegaId: bodega?.id ?? null,
    rol,
    contenido,
    activo: visible,
    onDevuelto,
  });

  const enviar = async (evento) => {
    evento?.preventDefault();
    const { ok } = await guardar();
    if (ok) onClose?.();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={`Devolver de la bodega ${bodega?.nombre ?? ""}`}
    >
      <p className="text-muted small">
        Lo que sobra en la bodega móvil vuelve a una bodega fija. Queda en el consumo de la jornada
        como devuelto. Lo vencido no se devuelve: se da de baja desde su alerta de vencimiento.
      </p>

      {error && (
        <div className="alert alert-danger" role="alert">
          No se pudo devolver: {error.mensaje}
        </div>
      )}

      <form onSubmit={enviar} noValidate>
        <Selector
          label="Lote"
          requerido
          value={claveLote || null}
          options={lotes.map((fila) => ({ value: fila.loteId, label: etiquetaDeLote(fila) }))}
          onSelect={seleccionarLote}
          placeholder={lotes.length === 0 ? "No hay nada que devolver" : "Seleccionar"}
          disabled={guardando || lotes.length === 0}
        />

        <Selector
          label="Bodega destino"
          requerido
          value={bodegaDestinoId || null}
          options={bodegasDestino}
          onSelect={setBodegaDestinoId}
          disabled={guardando}
        />

        <NumberField
          label="Cantidad"
          requerido
          value={cantidad === "" ? null : Number(cantidad)}
          min={1}
          step={1}
          onChange={(valor) => setCantidad(valor === null ? "" : String(valor))}
          error={avisoCantidad ?? undefined}
          disabled={guardando || !claveLote}
        />

        <div className="d-flex justify-content-end gap-2 mt-3">
          <SecondaryButton
            title="Cancelar"
            onClick={onClose}
            disabled={guardando}
            icon={<X size={16} aria-hidden="true" />}
          />
          <PrimaryButton
            title="Devolver"
            onClick={enviar}
            loading={guardando}
            disabled={!puedeGuardar}
          />
        </div>
      </form>
    </Modal>
  );
}
