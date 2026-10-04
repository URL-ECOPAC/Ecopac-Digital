import { Pressable, StyleSheet, Text, View } from "react-native";
import { textoDeCantidadDeCitas } from "@ecopac/shared";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";

// El anio de la agenda en el telefono (issue #927): doce meses chicos para moverse rapido. El dia
// con citas va marcado con el color de la marca y el mes dice cuantas tiene. En el ancho de un
// telefono un dia del mes chico mide menos que un dedo, asi que se toca el mes entero y se abre
// el mes; ahi cada dia ya es un boton de tamano normal. Mismas props que CalendarioAnio de la web
// (apps/web/src/pages/CalendarioCitas.jsx); `onAbrirDia` no se usa aqui por esa razon.

/** Lado del circulo de cada dia: dos veces la letra mas chica, para que quepan dos digitos. */
const TAMANO_DEL_DIA = typography.sizes.xxs * 2;

export default function CalendarioAnio({ meses, onAbrirMes }) {
  return (
    <View style={estilos.cuadricula} accessibilityLabel="Citas del año">
      {meses.map((mes) => (
        <Pressable
          key={mes.fecha}
          onPress={() => onAbrirMes(mes.fecha)}
          accessibilityRole="button"
          accessibilityLabel={`Ver ${mes.nombre}${
            mes.activas ? `, ${textoDeCantidadDeCitas(mes.activas)}` : ", sin citas"
          }`}
          style={({ pressed }) => [estilos.mes, pressed && estilos.mesPresionado]}
        >
          <View style={estilos.titulo}>
            <Text style={estilos.nombre}>{mes.nombre}</Text>
            {mes.activas > 0 ? (
              <View style={estilos.cantidad}>
                <Text style={estilos.cantidadTexto}>{mes.activas}</Text>
              </View>
            ) : null}
          </View>
          {mes.semanas.map((semana) => (
            <View key={semana[0].fecha} style={estilos.semana}>
              {semana.map((dia) => (
                <View key={dia.fecha} style={estilos.dia}>
                  <View
                    style={[
                      estilos.circulo,
                      dia.delMes && dia.activas > 0 && estilos.diaConCitas,
                      dia.delMes && dia.esHoy && estilos.diaHoy,
                    ]}
                  >
                    <Text
                      style={[
                        estilos.diaTexto,
                        dia.delMes && dia.activas > 0 && estilos.diaTextoConCitas,
                      ]}
                    >
                      {dia.delMes ? dia.dia : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </Pressable>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  cuadricula: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.sm,
  },
  mes: {
    width: "48.5%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  mesPresionado: {
    borderColor: colors.primary,
  },
  titulo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  nombre: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
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
  semana: {
    flexDirection: "row",
  },
  dia: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 1,
  },
  circulo: {
    width: TAMANO_DEL_DIA,
    height: TAMANO_DEL_DIA,
    borderRadius: TAMANO_DEL_DIA / 2,
    // Sin borde, Android dibujaba cuadrado el dia con fondo (solo el de hoy, que lleva borde,
    // salia redondo). Un borde transparente siempre, como los dias de CalendarioMes.
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  diaConCitas: {
    backgroundColor: colors.primary,
  },
  diaHoy: {
    borderColor: colors.primary,
  },
  diaTexto: {
    fontSize: typography.sizes.xxs,
    color: colors.textMuted,
  },
  diaTextoConCitas: {
    color: colors.surface,
    fontWeight: typography.weights.semibold,
  },
});
