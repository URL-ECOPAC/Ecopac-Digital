import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

const MIN_TOUCH_HEIGHT = 48;

/**
 * Selector tipo dropdown, implementado sin dependencias externas para no
 * atar el proyecto a una libreria de picker especifica.
 *
 * options: [{ label: string, value: string | number }], que es la forma que publica shared
 * desde la issue #399. Antes convivian dos formas y este componente normalizaba por dentro;
 * hoy no hay nada que normalizar y un catalogo ausente se resuelve con una lista vacia.
 */
export default function Selector({
  label,
  value,
  options,
  onSelect,
  placeholder = "Seleccionar",
  error,
  style,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const opciones = Array.isArray(options) ? options : [];
  const selectedOption = opciones.find((option) => option.value === value);

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        style={({ pressed }) => [
          styles.trigger,
          error && styles.triggerError,
          pressed && styles.triggerPressed,
        ]}
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
      >
        <Text style={selectedOption ? styles.valueText : styles.placeholderText}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalRoot}>
          {/* Capa de fondo separada del contenido: asi el opacity solo afecta
              el fondo y no oscurece la hoja de opciones ni su texto. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsOpen(false)}>
            <View style={styles.backdrop} />
          </Pressable>

          <View style={styles.sheet}>
            <FlatList
              data={opciones}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                  onPress={() => {
                    onSelect(item.value);
                    setIsOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>{item.label}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  trigger: {
    minHeight: MIN_TOUCH_HEIGHT,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  triggerPressed: {
    borderColor: colors.primary,
  },
  triggerError: {
    borderColor: colors.danger,
  },
  valueText: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  placeholderText: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    color: colors.textMuted,
  },
  errorText: {
    marginTop: spacing.xs,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.danger,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.text,
    opacity: 0.5,
  },
  sheet: {
    maxHeight: "60%",
    backgroundColor: colors.background,
    borderTopLeftRadius: spacing.md,
    borderTopRightRadius: spacing.md,
    paddingVertical: spacing.sm,
  },
  option: {
    minHeight: MIN_TOUCH_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  optionPressed: {
    backgroundColor: colors.background,
    opacity: 0.6,
  },
  optionText: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
});
