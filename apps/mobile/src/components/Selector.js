import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { OPCIONES_PARA_OFRECER_BUSQUEDA, filtrarOpcionesPorTexto } from "@ecopac/shared";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";

const MIN_TOUCH_HEIGHT = 48;

/**
 * Selector tipo dropdown, implementado sin dependencias externas para no
 * atar el proyecto a una libreria de picker especifica.
 *
 * options: [{ label: string, value: string | number }], que es la forma que publica shared
 * desde la issue #399. Antes convivian dos formas y este componente normalizaba por dentro;
 * hoy no hay nada que normalizar y un catalogo ausente se resuelve con una lista vacia.
 *
 * Con una lista larga -el catalogo de diagnosticos, el de comunidades- la hoja abre con un campo
 * de busqueda arriba (issue #840, G4): recorrer cientos de opciones a ojo en un telefono no es
 * practico. La regla de cuando ofrecerlo y como comparar vive en shared
 * (OPCIONES_PARA_OFRECER_BUSQUEDA, filtrarOpcionesPorTexto).
 */
export default function Selector({
  label,
  value,
  options,
  onSelect,
  placeholder = "Seleccionar",
  error,
  disabled = false,
  style,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const opciones = Array.isArray(options) ? options : [];
  const selectedOption = opciones.find((option) => option.value === value);
  const buscable = opciones.length > OPCIONES_PARA_OFRECER_BUSQUEDA;
  const visibles = buscable ? filtrarOpcionesPorTexto(opciones, busqueda) : opciones;

  const cerrar = () => {
    setIsOpen(false);
    setBusqueda("");
  };

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        disabled={disabled}
        style={({ pressed }) => [
          styles.trigger,
          error && styles.triggerError,
          pressed && styles.triggerPressed,
          disabled && styles.triggerDisabled,
        ]}
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen, disabled }}
      >
        <Text style={selectedOption ? styles.valueText : styles.placeholderText}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={cerrar}>
        <View style={styles.modalRoot}>
          {/* Capa de fondo separada del contenido: asi el opacity solo afecta
              el fondo y no oscurece la hoja de opciones ni su texto. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={cerrar}>
            <View style={styles.backdrop} />
          </Pressable>

          <View style={styles.sheet}>
            {buscable ? (
              <TextInput
                style={styles.busqueda}
                value={busqueda}
                onChangeText={setBusqueda}
                placeholder="Buscar..."
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                accessibilityLabel={label ? `Buscar ${label}` : "Buscar"}
              />
            ) : null}
            <FlatList
              data={visibles}
              keyExtractor={(item) => String(item.value)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.sinResultados}>Ninguna opción coincide con la búsqueda.</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                  onPress={() => {
                    onSelect(item.value);
                    cerrar();
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
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  triggerPressed: {
    borderColor: colors.primary,
  },
  triggerError: {
    borderColor: colors.danger,
  },
  triggerDisabled: {
    opacity: 0.5,
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
  busqueda: {
    minHeight: MIN_TOUCH_HEIGHT,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  sinResultados: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
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
