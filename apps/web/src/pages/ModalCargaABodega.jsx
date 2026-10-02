import { X } from "lucide-react";

import {
  claveDeLoteDeSalida,
  formatearFechaCorta,
  useCargaDeBodegaDeJornada,
} from "@ecopac/shared";

import Modal from "../components/Modal";
import NumberField from "../components/NumberField";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import Selector from "../components/Selector";

/** "Lote L-1 · Bodega Principal · vence 31/01/2027 · 30 disponibles" */
function etiquetaDeLote(lote) {
  const vence = lote.fechaVencimiento
    ? `vence ${formatearFechaCorta(lote.fechaVencimiento)}`
    : "no vence";
  return `Lote ${lote.numeroLote} · ${lote.bodega} · ${vence} · ${lote.cantidadDisponible} disponibles`;
}

/**
 * "Cargar a la bodega" de la pestana Insumos de una jornada (00178): saca un lote de otra bodega y
 * lo pasa a la bodega movil de la jornada. El estado, lo que se puede guardar y la llamada viven en
 * useCargaDeBodegaDeJornada(); aqui solo se dibuja.
 */
export default function ModalCargaABodega({ visible, jornadaId, bodega, rol, onClose, onCargado }) {
  const {
    articulos,
    medicamentoId,
    setMedicamentoId,
    lotesDeOrigen,
    claveLote,
    seleccionarLotePorClave,
    cantidad,
    setCantidad,
    sinExistencia,
    avisoCantidad,
    puedeGuardar,
    cargando,
    guardando,
    error,
    guardar,
  } = useCargaDeBodegaDeJornada({
    jornadaId,
    bodegaId: bodega?.id ?? null,
    rol,
    activo: visible,
    onCargado,
  });

  const enviar = async (evento) => {
    evento?.preventDefault();
    const { ok } = await guardar();
    if (ok) onClose?.();
  };

  return (
    <Modal visible={visible} onClose={onClose} title={`Cargar a la bodega ${bodega?.nombre ?? ""}`}>
      <p className="text-muted small">
        Lo que se carga sale de otra bodega y pasa a la bodega móvil de la jornada. De ahí salen los
        medicamentos que se recetan en la jornada.
      </p>

      {error && (
        <div className="alert alert-danger" role="alert">
          No se pudo cargar: {error.mensaje}
        </div>
      )}

      <form onSubmit={enviar} noValidate>
        <Selector
          label="Producto / Insumo"
          requerido
          value={medicamentoId || null}
          options={articulos}
          onSelect={setMedicamentoId}
          placeholder={articulos.length === 0 ? "Cargando..." : "Seleccionar"}
          disabled={guardando || articulos.length === 0}
        />

        <Selector
          label="Lote y bodega de origen"
          requerido
          value={claveLote || null}
          options={lotesDeOrigen.map((lote) => ({
            value: claveDeLoteDeSalida(lote),
            label: etiquetaDeLote(lote),
          }))}
          onSelect={(valor) => seleccionarLotePorClave(valor ?? "")}
          placeholder={cargando ? "Cargando..." : "Seleccionar"}
          disabled={guardando || !medicamentoId || lotesDeOrigen.length === 0}
          error={
            sinExistencia
              ? "No hay existencia de este artículo en otra bodega: regístrala primero en Inventario."
              : undefined
          }
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
            title="Cargar"
            onClick={enviar}
            loading={guardando}
            disabled={!puedeGuardar}
          />
        </div>
      </form>
    </Modal>
  );
}
