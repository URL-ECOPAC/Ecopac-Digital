import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { Modal, NumberField, PrimaryButton, SecondaryButton } from "../components";

/**
 * Corrige la cantidad realmente entregada de un renglon de receta (issue #764): la receta
 * descuenta el inventario de forma atomica al emitirse (fn_generar_receta, migracion 00112), asi
 * que este modal no repite esa cantidad -solo la diferencia contra lo ya confirmado, que
 * ajustarEntrega() (useEntregaMedicamentos.js) calcula en el servidor
 * (fn_ajustar_entrega_receta, 00128)-.
 *
 * `onGuardar` es ajustarEntrega(detalle.id, cantidadReal): relanza el error (no lo devuelve como
 * dato) para que el mensaje quede junto al campo que se esta editando, mismo motivo por el que
 * este modal usa try/catch y no el patron `resultado.ok` de ModalCorreccionMovimiento.js.
 */
export default function ModalAjusteEntrega({ visible, detalle, onClose, onGuardar }) {
  const [cantidad, setCantidad] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setCantidad(detalle?.cantidadRealEntregada ?? null);
    setError(null);
  }, [detalle]);

  const contexto = [detalle?.dosis, detalle?.frecuencia, detalle?.duracion]
    .filter(Boolean)
    .join(" · ");

  const guardar = async () => {
    if (!cantidad || cantidad <= 0) {
      setError("La cantidad debe ser mayor que cero.");
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      await onGuardar(detalle.id, cantidad);
      onClose?.();
    } catch (excepcion) {
      setError(excepcion.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Ajustar cantidad entregada">
      <Text style={styles.medicamento}>{detalle?.medicamento}</Text>
      {contexto ? <Text style={styles.contexto}>{contexto}</Text> : null}
      <Text style={styles.contexto}>
        Recetado: {detalle?.cantidadEntregada} · Disponible: {detalle?.cantidadDisponible ?? "—"}
      </Text>

      {detalle?.vencido ? (
        <Text style={styles.aviso}>El lote de este renglon esta vencido.</Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <NumberField
        label="Cantidad realmente entregada"
        value={cantidad}
        onChange={setCantidad}
        min={1}
      />

      <PrimaryButton
        title="Guardar ajuste"
        onPress={guardar}
        loading={guardando}
        style={styles.boton}
      />
      <SecondaryButton
        title="Cancelar"
        onPress={onClose}
        disabled={guardando}
        style={styles.boton}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  medicamento: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: "600",
    color: colors.text,
  },
  contexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  aviso: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.danger,
    marginTop: spacing.sm,
    fontWeight: "600",
  },
  error: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  boton: {
    marginTop: spacing.sm,
  },
});
