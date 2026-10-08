import { StyleSheet, Text } from "react-native";
import { formatearFechaCorta, useDevolucionDeBodegaDeJornada } from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { Modal, NumberField, PrimaryButton, SecondaryButton, Selector } from "../components";

/** "Amoxicilina (500 mg) · Lote L-1 · vence 31/01/2027 · 30 de esta jornada". */
function etiquetaDeLote(fila) {
  const vence = fila.fechaVencimiento
    ? `vence ${formatearFechaCorta(fila.fechaVencimiento)}`
    : "no vence";
  return `${fila.articulo} · Lote ${fila.numeroLote ?? "—"} · ${vence} · ${fila.cantidadDisponible} de esta jornada`;
}

/**
 * "Devolver a otra bodega" de la pestaña Insumos de una jornada, en movil: lo que sobra en la
 * bodega movil vuelve a una bodega fija. Estado y llamada en useDevolucionDeBodegaDeJornada();
 * aqui solo se dibuja. Espejo de apps/web/src/pages/ModalDevolucionDeBodega.jsx.
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

  const enviar = async () => {
    const { ok } = await guardar();
    if (ok) onClose?.();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={`Devolver de la bodega ${bodega?.nombre ?? ""}`}
    >
      <Text style={estilos.textoMuted}>
        Lo que sobra en la bodega móvil vuelve a una bodega fija. Queda en el consumo de la jornada
        como devuelto. Lo vencido no se devuelve: se da de baja desde su alerta de vencimiento.
      </Text>

      {error && <Text style={estilos.aviso}>No se pudo devolver: {error.mensaje}</Text>}

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
        onChange={(valor) => setCantidad(valor === null ? "" : String(valor))}
        error={avisoCantidad ?? undefined}
        editable={!guardando && Boolean(claveLote)}
      />

      <PrimaryButton
        title="Devolver"
        onPress={enviar}
        loading={guardando}
        disabled={!puedeGuardar}
        style={estilos.boton}
      />
      <SecondaryButton
        title="Cancelar"
        onPress={onClose}
        disabled={guardando}
        style={estilos.boton}
      />
    </Modal>
  );
}

const estilos = StyleSheet.create({
  textoMuted: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  aviso: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  boton: {
    marginTop: spacing.sm,
  },
});
