import { Pressable, StyleSheet, Text, View } from "react-native";
import { DIAS_DE_LA_SEMANA_AGENDA, textoDeCantidadDeCitas } from "@ecopac/shared";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";

// El mes de la agenda en el telefono (issue #927): sirve para moverse. No caben las citas en la
// celda, asi que cada dia dice cuantas citas activas tiene (las no canceladas) y al tocarlo se abre
// su lista. Mismas props que CalendarioMes de la web (apps/web/src/pages/CalendarioCitas.jsx);
// `onAbrirCita` no se usa aqui porque el telefono no dibuja las citas en el mes.

export default function CalendarioMes({ semanas, onAbrirDia }) {
  return (
    <View accessibilityLabel="Citas del mes">
      <View style={estilos.fila}>
        {DIAS_DE_LA_SEMANA_AGENDA.map((dia) => (
          <Text key={dia} style={estilos.cabecera}>
            {dia}
          </Text>
        ))}
      </View>
      {semanas.map((semana) => (
        <View key={semana[0].fecha} style={estilos.fila}>
          {semana.map((dia) => (
            <Pressable
              key={dia.fecha}
              onPress={() => onAbrirDia(dia.fecha)}
              accessibilityRole="button"
              accessibilityLabel={`Ver el ${dia.dia}${
                dia.activas ? `, ${textoDeCantidadDeCitas(dia.activas)}` : ", sin citas"
              }`}
              style={({ pressed }) => [
                estilos.dia,
                !dia.delMes && estilos.diaFuera,
                dia.esHoy && estilos.diaHoy,
                pressed && estilos.diaPresionado,
              ]}
            >
              <Text style={[estilos.numero, !dia.delMes && estilos.numeroFuera]}>{dia.dia}</Text>
              {dia.activas > 0 ? (
                <View style={estilos.cantidad}>
                  <Text style={estilos.cantidadTexto}>{dia.activas}</Text>
                </View>
              ) : (
                <View style={estilos.cantidadVacia} />
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: "row",
  },
  cabecera: {
    flex: 1,
    textAlign: "center",
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    paddingVertical: spacing.xs,
  },
  dia: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  diaFuera: {
    opacity: 0.4,
  },
  diaHoy: {
    borderColor: colors.primary,
  },
  diaPresionado: {
    backgroundColor: colors.background,
  },
  numero: {
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  numeroFuera: {
    color: colors.textMuted,
  },
  cantidad: {
    minWidth: 20,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  cantidadTexto: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.surface,
  },
  cantidadVacia: {
    height: typography.sizes.xs + 4,
  },
});
