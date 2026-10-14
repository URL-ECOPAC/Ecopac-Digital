import {
  claveDeLoteDeSalida,
  etiquetaDeArticulo,
  etiquetaDeLoteDeSalida,
  MOTIVO_TRASLADO,
  useRegistroSalida,
} from "@ecopac/shared";

import Modal from "../components/Modal";
import NumberField from "../components/NumberField";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import Selector from "../components/Selector";

// "Registrar salida" de Inventario. El estado, lo que se puede guardar y la llamada viven en
// useRegistroSalida(); aqui solo se dibuja.
//
// Issue #925: era un dialogo armado a mano, con estilos escritos en pixeles, etiquetas sin asociar a
// su control y el `*` pegado al texto. Ahora usa Modal, Selector y NumberField del catalogo, como el
// resto de formularios: la marca de obligatorio, el error bajo el campo y el cierre al tocar fuera
// salen de ahi.
export function ModalSalidaMedicamento({
  abierto,
  onClose,
  onExito,
  medicamentos = [],
  usuarioId,
  rol,
}) {
  const {
    motivos,
    motivo,
    setMotivo,
    bodegasDestino,
    bodegaDestinoId,
    setBodegaDestinoId,
    medicamentoId,
    setMedicamentoId,
    claveLoteSeleccionado,
    seleccionarLotePorClave,
    cantidad,
    setCantidad,
    lotesDisponibles,
    sinExistencia,
    avisoCantidad,
    puedeGuardar,
    error,
    cargando,
    guardarSalida,
  } = useRegistroSalida({
    usuarioId,
    rol,
    // onExito (issue #859): primero se avisa al padre para que recargue, despues se cierra.
    onExito: (datos) => {
      if (onExito) onExito(datos);
      onClose();
    },
  });

  if (!abierto) return null;

  return (
    <Modal visible={abierto} onClose={onClose} title="Registro de Salida de Medicamentos">
      <p className="text-muted small">Control de entrega, traslados y bajas con sugerencia FEFO.</p>

      {/* noValidate: lo que falta lo dice la pantalla y el boton no se habilita (issue #911). */}
      <form onSubmit={guardarSalida} noValidate>
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        <Selector
          label="Motivo de salida"
          requerido
          value={motivo || null}
          options={motivos}
          onSelect={(valor) => setMotivo(valor ?? "")}
          placeholder="Seleccione motivo..."
          disabled={cargando}
        />

        {/* 00179: un traslado entra a otra bodega; antes solo salia del origen. */}
        {motivo === MOTIVO_TRASLADO && (
          <Selector
            label="Bodega destino"
            requerido
            value={bodegaDestinoId || null}
            options={bodegasDestino}
            onSelect={setBodegaDestinoId}
            placeholder="Seleccione bodega..."
            disabled={cargando}
          />
        )}

        <Selector
          label="Medicamento o insumo"
          requerido
          value={medicamentoId || null}
          options={medicamentos.map((articulo) => ({
            value: articulo.id,
            label: etiquetaDeArticulo(articulo),
          }))}
          onSelect={(valor) => setMedicamentoId(valor ?? "")}
          placeholder="Seleccione medicamento..."
          disabled={cargando}
        />

        {/* Las opciones se identifican por lote Y bodega (claveDeLoteDeSalida): un lote en dos
            bodegas daba dos opciones con el mismo value. Las causas de "sin existencia" son las que
            excluye vista_lotes_disponibles: ingreso pendiente de aprobacion, lotes vencidos, nada
            que quede, o todo comprometido en salidas pendientes (00186). */}
        <Selector
          label="Lote sugerido (FEFO)"
          requerido
          value={claveLoteSeleccionado || null}
          options={lotesDisponibles.map((lote) => ({
            value: claveDeLoteDeSalida(lote),
            label: etiquetaDeLoteDeSalida(lote),
          }))}
          onSelect={(valor) => seleccionarLotePorClave(valor ?? "")}
          placeholder={
            sinExistencia ? "Sin existencia" : "Lote sugerido por orden de vencimiento..."
          }
          disabled={cargando || sinExistencia}
          error={
            sinExistencia && !error
              ? "No hay existencia de este medicamento. Puede que su ingreso esté pendiente de aprobación, que sus lotes ya vencieron, que ya no quede o que lo que queda espere una salida por aprobar."
              : undefined
          }
        />

        <NumberField
          label="Cantidad a retirar"
          requerido
          value={cantidad === "" ? null : Number(cantidad)}
          min={1}
          step={1}
          onChange={(valor) => setCantidad(valor === null ? "" : String(valor))}
          error={avisoCantidad ?? undefined}
          disabled={cargando || sinExistencia}
        />

        <div className="d-flex justify-content-end gap-2 mt-3">
          <SecondaryButton title="Cancelar" onClick={onClose} disabled={cargando} />
          {/* Sin motivo, lote o una cantidad que alcance, no se habilita (issue #911). */}
          <PrimaryButton
            type="submit"
            title="Registrar salida"
            loading={cargando}
            disabled={!puedeGuardar}
          />
        </div>
      </form>
    </Modal>
  );
}
