import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { buscarOpcionPorEtiqueta } from "@ecopac/shared";
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
 *
 * `onCrear(texto)` da de alta lo escrito en su catalogo y elige lo que devuelva. Escribir el nombre
 * de una opcion que ya existe la elige en vez de duplicarla (buscarOpcionPorEtiqueta).
 */
export default function MultiSelector({
  label,
  value = [],
  options = [],
  onChange,
  placeholder = "Agregar...",
  placeholderLibre = "Escribe y pulsa Agregar",
  permiteLibre = false,
  onCrear,
  error,
  disabled = false,
  style,
}) {
  const seleccionados = Array.isArray(value) ? value : [];
  const [textoLibre, setTextoLibre] = useState("");
  // ISSUE #838: lo escrito a mano quedaba solo como chip y nunca entraba al desplegable, asi que
  // quitarlo lo hacia desaparecer y no habia forma de volver a elegirlo sin reescribirlo. Se
  // recuerda aqui, en la sesion del control, y se mezcla con el catalogo del servidor.
  const [agregadasEnSesion, setAgregadasEnSesion] = useState([]);

  const opciones = [
    ...options,
    ...agregadasEnSesion.filter((nueva) => !options.some((opcion) => opcion.value === nueva.value)),
  ];
  const disponibles = opciones.filter((opcion) => !seleccionados.includes(opcion.value));

  const etiquetaDe = (valor) =>
    opciones.find((opcion) => opcion.value === valor)?.label ?? String(valor);

  const recordar = (valor, etiqueta) => {
    setAgregadasEnSesion((anteriores) =>
      anteriores.some((opcion) => opcion.value === valor)
        ? anteriores
        : [...anteriores, { value: valor, label: etiqueta }],
    );
  };

  const agregar = (valor) => {
    if (valor === null || valor === "" || seleccionados.includes(valor)) return;
    onChange?.([...seleccionados, valor]);
  };

  const quitar = (valor) => onChange?.(seleccionados.filter((elegido) => elegido !== valor));

  const admiteTexto = permiteLibre || typeof onCrear === "function";

  const agregarLibre = async () => {
    const limpio = textoLibre.trim();
    if (!limpio) return;

    const existente = buscarOpcionPorEtiqueta(opciones, limpio);
    if (existente) {
      agregar(existente.value);
      setTextoLibre("");
      return;
    }

    if (typeof onCrear === "function") {
      const nuevo = await onCrear(limpio);
      if (nuevo === null || nuevo === undefined) return;
      recordar(nuevo, limpio);
      agregar(nuevo);
      setTextoLibre("");
      return;
    }

    // En modo libre el texto ES el valor, asi que la opcion nueva se llama igual que su valor.
    recordar(limpio, limpio);
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
        placeholder={
          opciones.length === 0
            ? "Todavía no hay ninguna"
            : disponibles.length === 0
              ? "Ya elegiste todas las opciones"
              : placeholder
        }
        disabled={disabled || disponibles.length === 0}
      />

      {admiteTexto ? (
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
            <Text style={styles.botonAgregarTexto}>
              {typeof onCrear === "function" ? "Crear" : "Agregar"}
            </Text>
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
