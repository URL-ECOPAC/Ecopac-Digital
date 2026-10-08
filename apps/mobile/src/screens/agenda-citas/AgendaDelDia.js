import { Pressable, StyleSheet, Text, View } from "react-native";
import { etiquetaDeEstadoDeCita, horaEnGuatemala } from "@ecopac/shared";
import { colors, radii, spacing, statusColors, typography } from "@ecopac/ui-tokens";

import { EmptyState, StatusChip } from "../../components";

// La agenda del dia en el telefono (issue #927): una lista por horario, no el calendario del mes.
// Mismas props que AgendaDelDia de la web (apps/web/src/pages/CalendarioCitas.jsx); los horarios
// y las salas libres los arma useAgendaCitas en shared.
//
// Sin clinica filtrada solo se dibujan los horarios con citas: en el ancho del telefono, cuarenta
// filas vacias esconden lo que importa. Con clinica filtrada se dibujan todos, porque las salas
// libres de cada horario son justamente lo que se quiere ver.

function CitaDelHorario({ cita, onAbrir }) {
  const cancelada = cita.estado === "cancelada";
  return (
    <Pressable
      onPress={() => onAbrir(cita)}
      accessibilityRole="button"
      accessibilityLabel={[
        horaEnGuatemala(cita.iniciaEn),
        cita.paciente,
        cita.area,
        cita.clinica,
        etiquetaDeEstadoDeCita(cita.estado),
      ]
        .filter(Boolean)
        .join(", ")}
      style={({ pressed }) => [
        estilos.cita,
        { borderLeftColor: statusColors[cita.estado] ?? colors.secondary },
        pressed && estilos.citaPresionada,
      ]}
    >
      <View style={estilos.citaCabecera}>
        <Text style={[estilos.paciente, cancelada && estilos.tachado]} numberOfLines={1}>
          {cita.paciente}
        </Text>
        <StatusChip status={cita.estado} label={etiquetaDeEstadoDeCita(cita.estado)} />
      </View>
      <Text style={estilos.detalle} numberOfLines={2}>
        {[
          `${horaEnGuatemala(cita.iniciaEn)} - ${horaEnGuatemala(cita.terminaEn)}`,
          cita.area,
          cita.clinica,
          cita.profesional ?? "Sin profesional",
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
    </Pressable>
  );
}

export default function AgendaDelDia({ horarios, clinica, onAbrirCita }) {
  const visibles = clinica ? horarios : horarios.filter((horario) => horario.citas.length > 0);

  if (visibles.length === 0) {
    return <EmptyState message="No hay citas este día con estos filtros." />;
  }

  return (
    <View>
      {visibles.map((horario) => (
        <View key={horario.hora} style={estilos.horario}>
          <View style={estilos.hora}>
            <Text style={estilos.horaTexto}>{horario.hora}</Text>
            {horario.salasLibres !== null ? (
              <Text style={[estilos.salas, horario.salasLibres === 0 && estilos.salasLlena]}>
                {horario.salasLibres === 1 ? "1 sala libre" : `${horario.salasLibres} salas libres`}
              </Text>
            ) : null}
          </View>
          <View style={estilos.citas}>
            {horario.citas.map((cita) => (
              <CitaDelHorario key={cita.id} cita={cita} onAbrir={onAbrirCita} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  horario: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  hora: {
    width: 72,
  },
  horaTexto: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  salas: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  salasLlena: {
    color: colors.danger,
    fontWeight: typography.weights.semibold,
  },
  citas: {
    flex: 1,
    gap: spacing.xs,
  },
  cita: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: radii.sm,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  citaPresionada: {
    backgroundColor: colors.background,
  },
  citaCabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  paciente: {
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  tachado: {
    textDecorationLine: "line-through",
    color: colors.textMuted,
  },
  detalle: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
});
