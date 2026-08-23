import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MESES } from '@ecopac/shared';
import { colors, spacing, typography } from '@ecopac/ui-tokens';
import PrimaryButton from './PrimaryButton';
import Selector from './Selector';

const MIN_TOUCH_HEIGHT = 48;

/**
 * Campo de fecha. Espejo de apps/web/src/components/DateField.jsx, que usa
 * <input type="date">.
 *
 * Se arma con hoja inferior y tres Selector -dia, mes y anio- y NO con una libreria de
 * picker: es la misma decision que ya documenta Selector.js, no atar el proyecto a una
 * dependencia de picker especifica. Ademas elegir el anio de una lista es mas rapido que
 * retroceder decadas en un carrusel, y aqui se capturan fechas de nacimiento.
 *
 * El valor viaja como cadena ISO 'YYYY-MM-DD' en las dos plataformas: es lo que espera una
 * columna DATE de Postgres y lo que packages/shared/formato/fechas.js lee como dia de
 * calendario sin correrse de dia por zona horaria. Un campo vacio se reporta como null.
 *
 * `onChange` entrega el valor ya resuelto y se llama igual en web y en movil: no es un input
 * de texto libre, asi que no aplica la excepcion onChange/onChangeText.
 */

const ANIO_ACTUAL = new Date().getFullYear();

/** Parte una cadena ISO en sus tres numeros, o devuelve null si no tiene esa forma. */
function partirIso(valor) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor ?? ''));
  if (!partes) return null;
  return { anio: Number(partes[1]), mes: Number(partes[2]), dia: Number(partes[3]) };
}

function aIso({ anio, mes, dia }) {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Dias que tiene un mes concreto, contando los anios bisiestos. */
function diasDelMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

function opcionesDeAnio(minDate, maxDate) {
  const desde = partirIso(minDate)?.anio ?? ANIO_ACTUAL - 120;
  const hasta = partirIso(maxDate)?.anio ?? ANIO_ACTUAL + 5;
  const anios = [];
  // Del mas reciente al mas antiguo: casi siempre se busca una fecha cercana.
  for (let anio = hasta; anio >= desde; anio -= 1) anios.push({ label: String(anio), value: anio });
  return anios;
}

export default function DateField({
  label,
  value = null,
  onChange,
  minDate,
  maxDate,
  error,
  style,
}) {
  const [abierto, setAbierto] = useState(false);
  const hoy = new Date();
  const inicial = partirIso(value) ?? {
    anio: hoy.getFullYear(),
    mes: hoy.getMonth() + 1,
    dia: hoy.getDate(),
  };
  const [borrador, setBorrador] = useState(inicial);

  const abrir = () => {
    setBorrador(partirIso(value) ?? inicial);
    setAbierto(true);
  };

  const cambiar = (campo, nuevo) => {
    setBorrador((actual) => {
      const siguiente = { ...actual, [campo]: nuevo };
      // Al pasar de un mes de 31 dias a uno de 30, el dia 31 dejaria de existir.
      const tope = diasDelMes(siguiente.anio, siguiente.mes);
      if (siguiente.dia > tope) siguiente.dia = tope;
      return siguiente;
    });
  };

  const confirmar = () => {
    onChange?.(aIso(borrador));
    setAbierto(false);
  };

  const limpiar = () => {
    onChange?.(null);
    setAbierto(false);
  };

  const iso = partirIso(value);
  const textoVisible = iso ? `${String(iso.dia).padStart(2, '0')} de ${MESES[iso.mes - 1]} de ${iso.anio}` : null;

  const dias = Array.from({ length: diasDelMes(borrador.anio, borrador.mes) }, (_, i) => ({
    label: String(i + 1),
    value: i + 1,
  }));
  const meses = MESES.map((nombre, indice) => ({ label: nombre, value: indice + 1 }));

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        style={({ pressed }) => [
          styles.trigger,
          error && styles.triggerError,
          pressed && styles.triggerPressed,
        ]}
        onPress={abrir}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
      >
        <Text style={textoVisible ? styles.valueText : styles.placeholderText}>
          {textoVisible ?? 'Seleccionar fecha'}
        </Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAbierto(false)}>
            <View style={styles.backdrop} />
          </Pressable>

          <View style={styles.sheet}>
            <Selector label="Dia" value={borrador.dia} options={dias} onSelect={(d) => cambiar('dia', d)} />
            <Selector label="Mes" value={borrador.mes} options={meses} onSelect={(m) => cambiar('mes', m)} />
            <Selector
              label="Anio"
              value={borrador.anio}
              options={opcionesDeAnio(minDate, maxDate)}
              onSelect={(a) => cambiar('anio', a)}
            />
            <PrimaryButton title="Aplicar" onPress={confirmar} />
            <Pressable style={styles.limpiar} onPress={limpiar} accessibilityRole="button">
              <Text style={styles.limpiarTexto}>Quitar fecha</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  trigger: {
    minHeight: MIN_TOUCH_HEIGHT,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  triggerPressed: { borderColor: colors.primary },
  triggerError: { borderColor: colors.danger },
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
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: colors.text, opacity: 0.5 },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.background,
    borderTopLeftRadius: spacing.md,
    borderTopRightRadius: spacing.md,
    padding: spacing.md,
  },
  limpiar: {
    minHeight: MIN_TOUCH_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limpiarTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
});
