import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { detalleDeCita, etiquetaDeEstadoDeCita } from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { Modal, PrimaryButton, SecondaryButton, StatusChip, TextField } from "../../components";

// El detalle de una cita en el telefono (issue #927). Mismas props que ModalDetalleCita de la web
// (apps/web/src/pages/ModalDetalleCita.jsx), con onPress en vez de onClick. En el telefono no se
// agenda ni se reagenda (la issue pide la agenda del dia con cambio de estado y Atender), asi que
// no hay Editar aunque `acciones.editar` venga en true.

export default function ModalDetalleCita({
  cita,
  acciones,
  enviando = false,
  error,
  errores = {},
  onClose,
  onAtender,
  onRegresar,
  onCancelar,
  onVerPaciente,
}) {
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");

  return (
    <Modal visible onClose={onClose} title="Cita">
      <View style={estilos.estado}>
        <StatusChip status={cita.estado} label={etiquetaDeEstadoDeCita(cita.estado)} />
      </View>

      {error ? <Text style={estilos.error}>{error.mensaje}</Text> : null}

      {detalleDeCita(cita).map((campo) => (
        <View key={campo.id} style={estilos.dato}>
          <Text style={estilos.rotulo}>{campo.label}</Text>
          <Text style={estilos.valor}>{campo.valor}</Text>
        </View>
      ))}

      {cancelando ? (
        <View style={estilos.acciones}>
          <TextField
            label="Motivo de la cancelación (opcional)"
            placeholder="Ej. El paciente pidió otra fecha"
            value={motivo}
            onChangeText={setMotivo}
            multiline
            error={errores.motivo}
            editable={!enviando}
          />
          <PrimaryButton
            title="Cancelar la cita"
            onPress={() => onCancelar(motivo)}
            loading={enviando}
          />
          <SecondaryButton
            title="Volver"
            variant="neutra"
            onPress={() => setCancelando(false)}
            disabled={enviando}
          />
        </View>
      ) : (
        <View style={estilos.acciones}>
          {acciones.atender ? (
            <PrimaryButton title="Atender" onPress={onAtender} loading={enviando} />
          ) : null}
          {acciones.regresar ? (
            <SecondaryButton title="Regresar a creada" onPress={onRegresar} disabled={enviando} />
          ) : null}
          {acciones.cancelar ? (
            <SecondaryButton
              title="Cancelar cita"
              variant="peligro"
              onPress={() => setCancelando(true)}
              disabled={enviando}
            />
          ) : null}
          {onVerPaciente ? (
            <SecondaryButton title="Ver ficha" variant="neutra" onPress={onVerPaciente} />
          ) : null}
        </View>
      )}
    </Modal>
  );
}

const estilos = StyleSheet.create({
  estado: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  dato: {
    marginBottom: spacing.sm,
  },
  rotulo: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  valor: {
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  acciones: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
