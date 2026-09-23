import { StyleSheet, Text } from "react-native";
import { useFormularioDiagnostico } from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { CampoDeFormulario, Modal, PrimaryButton, SecondaryButton } from "../components";

export default function ModalDiagnostico({
  visible,
  diagnostico,
  onClose,
  onGuardado,
  onAlternarActivo,
}) {
  const { campos, valores, error, enviando, editando, setCampo, enviar } =
    useFormularioDiagnostico(diagnostico);

  const guardar = async () => {
    const resultado = await enviar();
    if (resultado.ok) {
      onGuardado?.(resultado.diagnostico);
      onClose?.();
    }
  };

  const alternarActivo = async () => {
    const resultado = await onAlternarActivo?.(diagnostico);
    if (resultado?.ok) onClose?.();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={editando ? "Editar diagnóstico" : "Nuevo diagnóstico"}
    >
      {error ? <Text style={estilos.error}>{error.mensaje}</Text> : null}

      {campos.map((campo) => (
        <CampoDeFormulario
          key={campo.id}
          campo={campo}
          valor={valores[campo.id]}
          onChange={(valor) => setCampo(campo.id, valor)}
          disabled={enviando}
        />
      ))}

      <PrimaryButton
        title="Guardar"
        onPress={guardar}
        loading={enviando}
        disabled={enviando}
        style={estilos.accion}
      />

      {editando ? (
        <SecondaryButton
          title={diagnostico?.activo ? "Retirar del catálogo" : "Reactivar"}
          onPress={alternarActivo}
          disabled={enviando}
          style={estilos.accion}
        />
      ) : null}

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
  accion: {
    marginTop: spacing.sm,
  },
});
