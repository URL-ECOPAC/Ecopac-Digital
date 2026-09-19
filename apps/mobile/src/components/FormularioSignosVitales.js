import { StyleSheet, Text, View } from "react-native";
import { NIVELES_DE_AVISO } from "@ecopac/shared";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";

import NumberField from "./NumberField";

/**
 * Los signos vitales de una consulta (issue #840, bloques B1, F y G2). Espejo de
 * apps/web/src/components/FormularioSignosVitales.jsx, con las mismas props.
 *
 * Un solo formulario para tomarlos y para corregirlos. Una sola capa visible por campo: el error
 * al guardar o, si no lo hay, el aviso de useConsulta() -imposible en rojo, alarma en ambar-.
 * Nunca las dos: una sistolica de 35 decia primero "alarmante" y despues "mayor que 40".
 *
 * A proposito NO se le pasa min/max al NumberField: recorta al salir del campo, y con una
 * sistolica de 35 guardaba un 40 que nadie midio.
 */
export default function FormularioSignosVitales({
  campos,
  valores,
  onChange,
  errores = {},
  avisos = {},
  imc = null,
  disabled = false,
}) {
  return (
    <View>
      {campos.map((campo) => {
        const aviso = avisos[campo.id];
        const error =
          errores[campo.id] ??
          (aviso?.nivel === NIVELES_DE_AVISO.IMPOSIBLE ? aviso.mensaje : undefined);
        return (
          <View key={campo.id}>
            <NumberField
              label={campo.label}
              suffix={campo.sufijo}
              step={campo.paso ?? 1}
              value={valores[campo.id] === "" ? null : Number(valores[campo.id])}
              onChange={(valor) => onChange(campo.id, valor === null ? "" : valor)}
              error={error}
              editable={!disabled}
            />
            {!error && aviso?.nivel === NIVELES_DE_AVISO.ALARMA ? (
              <Text style={styles.alarma} accessibilityRole="alert">
                {aviso.mensaje}
              </Text>
            ) : null}
          </View>
        );
      })}

      {errores.signos ? <Text style={styles.errorGeneral}>{errores.signos}</Text> : null}

      {/* El IMC lo calcula la columna generada de la 00013: se adelanta, no se captura. */}
      {imc !== null ? (
        <View style={styles.imc}>
          <Text style={styles.imcEtiqueta}>IMC calculado</Text>
          <Text style={styles.imcValor}>{imc}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  alarma: {
    color: colors.warning,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  errorGeneral: {
    color: colors.danger,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  imc: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  imcEtiqueta: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
  },
  imcValor: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
});
