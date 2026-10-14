import { forwardRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";

// La misma altura tactil minima que TextField: se llena con una mano y a veces con guantes.
const MIN_TOUCH_HEIGHT = 48;

/**
 * Campo de contrasena con el icono de ojo (issue #864). Espejo de
 * apps/web/src/components/PasswordField.jsx: mismas props, mismo comportamiento.
 *
 * Es un componente y no una prop de TextField porque el estado de visibilidad es PROPIO DE CADA
 * CAMPO. Hasta esta issue el movil tenia el defecto en su version peor: AjustesScreen llevaba un
 * unico `verContrasena` para los tres campos de "Cambiar contrasena" y NuevaContrasenaScreen uno
 * para los dos suyos, asi que al mostrar uno se mostraban todos -- justo lo contrario de lo que
 * hace falta cuando el formulario dice que la contrasena y su confirmacion no coinciden y hay que
 * ver DONDE esta la diferencia.
 *
 * Diferencias con la web, que son de plataforma y no de criterio:
 *
 *   - El boton va DENTRO del recuadro del campo, superpuesto a la derecha, en vez de pegado como
 *     un InputGroup. Es lo que cabe en un ancho de telefono sin encoger el campo.
 *   - El area tactil del ojo es de 48dp aunque el icono mida 20, porque un icono de 20dp no se
 *     acierta con el pulgar.
 *   - No hay `tabIndex`: en React Native el boton no entra en el orden de tabulacion.
 *     `accessibilityRole` y `accessibilityLabel` hacen lo que en web hacen `aria-*`.
 *
 * El resto de las props pasa al TextInput (`value`, `onChangeText`, `autoComplete`,
 * `placeholder`, `editable`...), igual que en TextField. Tambien reenvia el ref, que es lo que
 * usa LoginScreen para saltar del correo a la contrasena con la tecla "siguiente".
 */
const PasswordField = forwardRef(function PasswordField(
  { label, error, style, ...inputProps },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const [enfocado, setEnfocado] = useState(false);
  const deshabilitado = inputProps.editable === false;

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.campo}>
        <TextInput
          ref={ref}
          style={[styles.input, enfocado && styles.inputEnfocado, error && styles.inputConError]}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          {...inputProps}
          secureTextEntry={!visible}
          onFocus={(evento) => {
            setEnfocado(true);
            inputProps.onFocus?.(evento);
          }}
          onBlur={(evento) => {
            setEnfocado(false);
            inputProps.onBlur?.(evento);
          }}
        />

        <Pressable
          style={({ pressed }) => [styles.ojo, pressed && styles.ojoPresionado]}
          accessibilityRole="button"
          accessibilityLabel={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          accessibilityState={{ selected: visible, disabled: deshabilitado }}
          disabled={deshabilitado}
          onPress={() => setVisible((actual) => !actual)}
        >
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={deshabilitado ? colors.textMuted : colors.primary}
          />
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
});

export default PasswordField;

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
  campo: {
    justifyContent: "center",
  },
  input: {
    minHeight: MIN_TOUCH_HEIGHT,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: radii.md,
    // El hueco de la derecha es el del boton: sin el, el texto pasa por debajo del icono.
    paddingLeft: spacing.md,
    paddingRight: MIN_TOUCH_HEIGHT,
    paddingVertical: spacing.sm,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    color: colors.text,
    backgroundColor: colors.background,
  },
  inputEnfocado: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  inputConError: {
    borderColor: colors.danger,
  },
  ojo: {
    position: "absolute",
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    height: MIN_TOUCH_HEIGHT,
    width: MIN_TOUCH_HEIGHT,
  },
  ojoPresionado: {
    opacity: 0.6,
  },
  errorText: {
    marginTop: spacing.xs,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.danger,
  },
});
