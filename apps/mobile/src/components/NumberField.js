import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@ecopac/ui-tokens';
import TextField from './TextField';

/**
 * Campo numerico. Espejo de apps/web/src/components/NumberField.jsx.
 *
 * `onChange` entrega un number ya convertido, o null si el campo quedo vacio, y se llama
 * igual en las dos plataformas: quien lo usa no deberia tener que acordarse de que el input
 * siempre devuelve texto.
 *
 * Se apoya en TextField con keyboardType numerico, que es el mismo componente base del
 * contrato, asi que hereda el area tactil de 48 dp y el tratamiento del error.
 *
 * `min` y `max` se aplican al SALIR del campo, no al teclear: recortar mientras la persona
 * escribe impide llegar a "12" cuando el minimo es 5, porque el "1" se corregiria solo.
 *
 * `step` se acepta por paridad con la web, donde controla las flechas de
 * <input type="number">. Un TextInput no tiene flechas, asi que aqui no hace nada; se
 * desestructura para que no llegue al TextInput, que no sabe que hacer con ella.
 */
export default function NumberField({
  label,
  value = null,
  onChange,
  min,
  max,
  step: _step,
  suffix,
  error,
  style,
  ...inputProps
}) {
  const alCambiar = (texto) => {
    const limpio = texto.replace(',', '.');
    if (limpio.trim() === '') {
      onChange?.(null);
      return;
    }
    const numero = Number(limpio);
    onChange?.(Number.isNaN(numero) ? null : numero);
  };

  // El recorte va aqui y no en cada pulsacion, para no pelearse con quien todavia escribe.
  const alSalir = (evento) => {
    if (value !== null && value !== undefined) {
      if (typeof min === 'number' && value < min) onChange?.(min);
      else if (typeof max === 'number' && value > max) onChange?.(max);
    }
    inputProps.onBlur?.(evento);
  };

  return (
    <View style={style}>
      <View style={styles.fila}>
        <TextField
          label={label}
          error={error}
          value={value === null || value === undefined ? '' : String(value)}
          onChangeText={alCambiar}
          keyboardType="numeric"
          style={styles.campo}
          {...inputProps}
          onBlur={alSalir}
        />
        {suffix ? <Text style={styles.sufijo}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
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
