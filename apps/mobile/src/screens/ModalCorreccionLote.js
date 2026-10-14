import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { actualizarLote, CAMPOS_CORRECCION_LOTE } from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { CampoDeFormulario, Modal, PrimaryButton, SecondaryButton } from "../components";

export function valoresDeCorreccionDeLote(lote) {
  return {
    medicamento: lote?.medicamento ?? "",
    numeroLote: lote?.numeroLote ?? "",
    proveedor: lote?.proveedor ?? "",
    origen: lote?.origen ?? "",
    cantidadIngresada: lote?.cantidadIngresada ?? "",
    fechaIngreso: lote?.fechaIngreso ?? "",
    fechaVencimiento: lote?.fechaVencimiento ?? "",
    costoUnitario: lote?.costoUnitario === null ? "" : String(lote?.costoUnitario ?? ""),
  };
}

export default function ModalCorreccionLote({ visible, lote, onClose, onGuardado }) {
  const [valores, setValores] = useState(() => valoresDeCorreccionDeLote(lote));
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setValores(valoresDeCorreccionDeLote(lote));
    setError(null);
  }, [lote]);

  const guardar = async () => {
    setEnviando(true);
    setError(null);

    const costo = valores.costoUnitario;
    const { lote: actualizado, error: fallo } = await actualizarLote(lote.id, {
      costoUnitario: costo === "" || costo === null ? null : Number(costo),
    });

    setEnviando(false);

    if (fallo) {
      setError(fallo);
      return;
    }

    onGuardado?.(actualizado);
    onClose?.();
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Corregir el lote">
      {error ? <Text style={estilos.error}>{error.mensaje}</Text> : null}

      <Text style={estilos.nota}>
        De un lote ya registrado solo se corrige el costo unitario. El medicamento, el número, el
        origen y las fechas son el lote tal como entró.
      </Text>

      {CAMPOS_CORRECCION_LOTE.map((campo) => (
        <CampoDeFormulario
          key={campo.id}
          campo={campo}
          valor={valores[campo.id]}
          onChange={(valor) => setValores((anteriores) => ({ ...anteriores, [campo.id]: valor }))}
          disabled={enviando}
        />
      ))}

      <PrimaryButton
        title="Guardar cambios"
        onPress={guardar}
        loading={enviando}
        disabled={enviando}
        style={estilos.accion}
      />
      <SecondaryButton
        title="Cancelar"
        onPress={onClose}
        disabled={enviando}
        style={estilos.accion}
      />
    </Modal>
  );
}

const estilos = StyleSheet.create({
  error: {
    color: colors.danger,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  nota: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.md,
  },
  accion: {
    marginTop: spacing.sm,
  },
});
