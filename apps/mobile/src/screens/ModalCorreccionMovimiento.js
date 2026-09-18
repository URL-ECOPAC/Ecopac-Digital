import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { Modal, NumberField, PrimaryButton, SecondaryButton, TextField } from "../components";

function valoresDe(movimiento) {
  return {
    cantidad: movimiento?.cantidad ?? null,
    motivo: movimiento?.motivo ?? "",
  };
}

/**
 * Detalle de un movimiento de "Mis movimientos" en movil (issue #756). Espejo de
 * apps/web/src/pages/ModalCorreccionMovimiento.jsx: con `movimiento.puedeEditar` es un
 * formulario de correccion (cantidad, motivo); sin ella es solo lectura -un movimiento ajeno
 * visto con "Ver: todos", o uno que ya no esta pendiente.
 */
export default function ModalCorreccionMovimiento({ visible, movimiento, onClose, onGuardar }) {
  const puedeEditar = Boolean(movimiento?.puedeEditar);
  const [valores, setValores] = useState(() => valoresDe(movimiento));
  const [error, setError] = useState(null);
  const [erroresForm, setErroresForm] = useState({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setValores(valoresDe(movimiento));
    setError(null);
    setErroresForm({});
  }, [movimiento]);

  const guardar = async () => {
    setEnviando(true);
    setError(null);

    const resultado = await onGuardar(movimiento.id, valores);

    setEnviando(false);
    if (!resultado.ok) {
      setErroresForm(resultado.errores ?? {});
      setError(resultado.error);
      return;
    }
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={puedeEditar ? "Editar movimiento" : "Detalle del movimiento"}
    >
      {error ? <Text style={styles.error}>{error.mensaje}</Text> : null}

      <Text style={styles.contexto}>
        {movimiento?.medicamentoNombre} · Lote {movimiento?.numeroLote} · {movimiento?.bodegaNombre}
        {"\n"}
        {movimiento?.estado} · Registrado por {movimiento?.registradoPorNombre ?? "—"}
      </Text>

      {!puedeEditar ? (
        <Text style={styles.aviso}>
          {movimiento?.estado === "pendiente"
            ? "Solo quien registro el movimiento puede corregirlo."
            : "Solo se pueden corregir movimientos pendientes."}
        </Text>
      ) : null}

      <NumberField
        label="Cantidad"
        value={valores.cantidad}
        onChange={(valor) => setValores((anteriores) => ({ ...anteriores, cantidad: valor }))}
        min={1}
        error={erroresForm.cantidad}
        editable={puedeEditar}
      />
      <TextField
        label="Motivo"
        value={valores.motivo}
        onChangeText={(texto) => setValores((anteriores) => ({ ...anteriores, motivo: texto }))}
        multiline
        numberOfLines={2}
        error={erroresForm.motivo}
        editable={puedeEditar}
      />

      {puedeEditar ? (
        <>
          <PrimaryButton
            title="Guardar cambios"
            onPress={guardar}
            loading={enviando}
            style={styles.boton}
          />
          <SecondaryButton
            title="Cancelar"
            onPress={onClose}
            disabled={enviando}
            style={styles.boton}
          />
        </>
      ) : (
        <SecondaryButton title="Cerrar" onPress={onClose} style={styles.boton} />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  error: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  contexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  aviso: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.warning,
    marginBottom: spacing.md,
  },
  boton: {
    marginTop: spacing.sm,
  },
});
