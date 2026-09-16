import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";

import Selector from "./Selector";

/**
 * Seleccion multiple sobre un catalogo.
 *
 * Espejo de apps/web/src/components/MultiSelector.jsx: mismas props y mismo contrato
 * (`onChange` entrega el arreglo COMPLETO de valores, no el que cambio). La unica diferencia de
 * API es la del catalogo: el texto libre se escribe en un TextInput con `onChangeText`.
 *
 * TIPOS_DE_CAMPO.MULTI_SELECT existia en los descriptores desde el principio -lo declara
 * CAMPOS_CONSULTA para los diagnosticos- y ninguna de las dos apps tenia con que dibujarlo.
 */
export default function MultiSelector({
  label,
  value = [],
  options = [],
  onChange,
  placeholder = "Agregar...",
  placeholderLibre = "Escribe y pulsa Agregar",
  permiteLibre = false,
  error,
  disabled = false,
  style,
}) {
  const seleccionados = Array.isArray(value) ? value : [];
  const [textoLibre, setTextoLibre] = useState("");

  const disponibles = options.filter((opcion) => !seleccionados.includes(opcion.value));

  const etiquetaDe = (valor) =>
    options.find((opcion) => opcion.value === valor)?.label ?? String(valor);

  const agregar = (valor) => {
    if (valor === null || valor === "" || seleccionados.includes(valor)) return;
    onChange?.([...seleccionados, valor]);
  };

  const quitar = (valor) => onChange?.(seleccionados.filter((elegido) => elegido !== valor));

  const agregarLibre = () => {
    const limpio = textoLibre.trim();
    if (!limpio) return;
    agregar(limpio);
    setTextoLibre("");
  };

  return (
    <View style={[styles.grupo, style]}>
      {label ? <Text style={styles.etiqueta}>{label}</Text> : null}

      {seleccionados.length > 0 ? (
        <View style={styles.chips}>
          {seleccionados.map((valor) => (
            <Pressable
              key={String(valor)}
              style={styles.chip}
              onPress={() => (disabled ? null : quitar(valor))}
              accessibilityRole="button"
              accessibilityLabel={`Quitar ${etiquetaDe(valor)}`}
            >
              <Text style={styles.chipTexto}>{etiquetaDe(valor)}</Text>
              {!disabled ? <Text style={styles.chipQuitar}>×</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      <Selector
        value={null}
        options={disponibles}
        onSelect={agregar}
        placeholder={disponibles.length === 0 ? "No quedan opciones por elegir" : placeholder}
        disabled={disabled || disponibles.length === 0}
      />

      {permiteLibre ? (
        <View style={styles.filaLibre}>
          <TextInput
            style={styles.entrada}
            value={textoLibre}
            placeholder={placeholderLibre}
            placeholderTextColor={colors.textMuted}
            editable={!disabled}
            onChangeText={setTextoLibre}
            onSubmitEditing={agregarLibre}
          />
          <Pressable
            style={styles.botonAgregar}
            onPress={agregarLibre}
            disabled={disabled || textoLibre.trim() === ""}
            accessibilityRole="button"
          >
            <Text style={styles.botonAgregarTexto}>Agregar</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: {
    marginBottom: spacing.md,
  },
  etiqueta: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.xs,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  chip: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipTexto: {
    color: colors.primary,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  chipQuitar: {
    color: colors.primary,
    fontSize: typography.sizes.md,
  },
  filaLibre: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  entrada: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  botonAgregar: {
    alignItems: "center",
    borderColor: colors.primary,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  botonAgregarTexto: {
    color: colors.primary,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  error: {
    color: colors.danger,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
  },
});
