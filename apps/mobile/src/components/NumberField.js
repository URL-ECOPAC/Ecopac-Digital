import { forwardRef, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";
import TextField from "./TextField";

/**
 * Campo numerico. Espejo de apps/web/src/components/NumberField.jsx.
 *
 * `onChange` entrega un number ya convertido, o null si el campo quedo vacio, y se llama
 * igual en las dos plataformas: quien lo usa no deberia tener que acordarse de que el input
 * siempre devuelve texto.
 *
 * Se apoya en TextField con teclado numerico, que es el mismo componente base del contrato, asi
 * que hereda el area tactil de 48 dp y el tratamiento del error.
 *
 * LOS DECIMALES (issue #840). El campo pintaba `String(value)`: al teclear "36." el numero era 36,
 * se volvia a pintar "36" y el punto desaparecia. En movil no se podia escribir 36.5 grados ni
 * 12.5 kg. Ahora se conserva el texto tal como se escribe y solo se sincroniza cuando el valor
 * cambia desde fuera. `step` decide el teclado: con un paso fraccionario se abre el decimal, que
 * en iOS es el unico que trae el punto (el "numeric" de iOS no lo tiene).
 *
 * `min` y `max` se aplican al SALIR del campo, no al teclear: recortar mientras la persona
 * escribe impide llegar a "12" cuando el minimo es 5, porque el "1" se corregiria solo. Quien no
 * quiera que se recorte -un signo vital, donde recortar 35 a 40 guardaria un valor que nadie
 * midio- simplemente no los pasa.
 */
function aTexto(valor) {
  return valor === null || valor === undefined ? "" : String(valor);
}

function aNumero(texto) {
  const limpio = texto.replace(",", ".").trim();
  if (limpio === "") return null;
  const numero = Number(limpio);
  return Number.isNaN(numero) ? null : numero;
}

const NumberField = forwardRef(function NumberField(
  { label, value = null, onChange, min, max, step = 1, suffix, error, style, ...inputProps },
  ref,
) {
  const [texto, setTexto] = useState(() => aTexto(value));

  // El valor cambio desde fuera (se reinicio el formulario, se cargo una visita): se pinta ese.
  // Si es el mismo numero que ya representa el texto -"36." y 36-, se respeta lo escrito.
  useEffect(() => {
    if (aNumero(texto) !== (value ?? null)) setTexto(aTexto(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const alCambiar = (nuevo) => {
    setTexto(nuevo);
    onChange?.(aNumero(nuevo));
  };

  // El recorte va aqui y no en cada pulsacion, para no pelearse con quien todavia escribe.
  const alSalir = (evento) => {
    if (value !== null && value !== undefined) {
      if (typeof min === "number" && value < min) onChange?.(min);
      else if (typeof max === "number" && value > max) onChange?.(max);
    }
    inputProps.onBlur?.(evento);
  };

  const conDecimales = typeof step === "number" && !Number.isInteger(step);

  return (
    <View style={style}>
      <View style={styles.fila}>
        <TextField
          ref={ref}
          label={label}
          error={error}
          value={texto}
          onChangeText={alCambiar}
          keyboardType={conDecimales ? "decimal-pad" : "numeric"}
          style={styles.campo}
          {...inputProps}
          onBlur={alSalir}
        />
        {suffix ? <Text style={styles.sufijo}>{suffix}</Text> : null}
      </View>
    </View>
  );
});

export default NumberField;

const styles = StyleSheet.create({
  fila: {
    flexDirection: "row",
    alignItems: "center",
  },
  campo: {
    flex: 1,
  },
  sufijo: {
    marginLeft: spacing.sm,
    // Alinea el sufijo con el input y no con la etiqueta que va encima.
    marginTop: spacing.md,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    color: colors.textMuted,
  },
});
