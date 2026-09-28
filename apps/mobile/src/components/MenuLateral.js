import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";
import PanelLateral from "./PanelLateral";

const MIN_TOUCH_HEIGHT = 48;

/**
 * Menu de una seccion con muchas opciones: un boton "Opciones" que abre un panel lateral desde la
 * derecha con las opciones agrupadas. Es la respuesta movil a una fila de seis u ocho botones
 * (Inventario tenia principios activos, existencias, alertas, mis movimientos, registrar salida,
 * por aprobar y registrar ingreso a la vista a la vez): en un telefono esa fila se parte en tres
 * lineas y empuja la lista hacia abajo (docs/DISENO-MOVIL.md, reglas 2 y 3).
 *
 * Cada opcion es `{ id, etiqueta, descripcion?, icono?, visible? }`; `icono` es un nombre de
 * Ionicons. Las que traen `visible: false` no se dibujan, y un grupo sin opciones visibles
 * tampoco. Al elegir una, el panel se cierra y se avisa con `onElegir(opcion)`.
 *
 * @param {{ grupos: { titulo: string, opciones: object[] }[], onElegir: (opcion: object) => void, titulo?: string, etiqueta?: string }} props
 */
export default function MenuLateral({
  grupos = [],
  onElegir,
  titulo = "Opciones",
  etiqueta = "Opciones",
}) {
  const [abierto, setAbierto] = useState(false);

  const visibles = grupos
    .map((grupo) => ({
      ...grupo,
      opciones: (grupo.opciones ?? []).filter((opcion) => opcion.visible !== false),
    }))
    .filter((grupo) => grupo.opciones.length > 0);

  if (visibles.length === 0) return null;

  const elegir = (opcion) => {
    setAbierto(false);
    onElegir?.(opcion);
  };

  return (
    <>
      <Pressable
        onPress={() => setAbierto(true)}
        style={({ pressed }) => [styles.boton, pressed && styles.presionado]}
        accessibilityRole="button"
        accessibilityLabel={etiqueta}
        accessibilityState={{ expanded: abierto }}
      >
        <Ionicons name="menu" size={22} color={colors.text} />
        <Text style={styles.botonTexto}>{etiqueta}</Text>
      </Pressable>

      <PanelLateral visible={abierto} onClose={() => setAbierto(false)} title={titulo}>
        {visibles.map((grupo) => (
          <View key={grupo.titulo} style={styles.grupo}>
            <Text style={styles.grupoTitulo}>{grupo.titulo}</Text>
            {grupo.opciones.map((opcion) => (
              <Pressable
                key={opcion.id}
                onPress={() => elegir(opcion)}
                style={({ pressed }) => [styles.opcion, pressed && styles.presionado]}
                accessibilityRole="button"
              >
                {opcion.icono ? (
                  <Ionicons name={opcion.icono} size={22} color={colors.primary} />
                ) : null}
                <View style={styles.opcionTextos}>
                  <Text style={styles.opcionEtiqueta}>{opcion.etiqueta}</Text>
                  {opcion.descripcion ? (
                    <Text style={styles.opcionDescripcion}>{opcion.descripcion}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        ))}
      </PanelLateral>
    </>
  );
}

const styles = StyleSheet.create({
  boton: {
    minHeight: MIN_TOUCH_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  botonTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  presionado: { opacity: 0.7 },
  grupo: { marginBottom: spacing.lg },
  grupoTitulo: {
    marginBottom: spacing.xs,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
  },
  opcion: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  opcionTextos: { flex: 1, paddingVertical: spacing.sm },
  opcionEtiqueta: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  opcionDescripcion: {
    marginTop: spacing.xs,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
});
