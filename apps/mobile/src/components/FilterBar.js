import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SUBTIPOS_DE_RANGO, TIPOS_DE_FILTRO } from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";
import DateField from "./DateField";
import NumberField from "./NumberField";
import PrimaryButton from "./PrimaryButton";
import Selector from "./Selector";
import TextField from "./TextField";

const MIN_TOUCH_HEIGHT = 48;

/**
 * Barra de filtros. Espejo de apps/web/src/components/FilterBar.jsx: no conoce los filtros
 * de ningun modulo, solo la forma generica del descriptor.
 *
 * Diferencia deliberada con la web, que fija el contrato: aqui es un PANEL COLAPSABLE con
 * boton "Aplicar", no una fila de controles siempre visible. Cuatro filtros desplegados se
 * comen la pantalla de un telefono antes de que se vea un solo resultado.
 *
 * Consecuencia de colapsar: los cambios se acumulan en un borrador local y solo salen por
 * onChange al pulsar "Aplicar". Es lo que espera quien filtra en un telefono, donde cada
 * cambio suelto dispararia una consulta a mitad de la seleccion.
 *
 * Sobre las opciones de un select: un descriptor puede traerlas ya escritas (`opciones`, las
 * de un enum cerrado como estado o presentacion) o decir de que catalogo salen
 * (`opcionesDesde: 'comunidades'`, las que vienen de la base de datos). Un catalogo que
 * todavia no cargo deja el select vacio y deshabilitado.
 *
 * De que es un rango lo dice el descriptor en `subtipo` (issue #386), y aqui no se adivina:
 * antes, si no lo declaraba, se miraba si traia limites numericos, y un rango numerico sin
 * limites -legitimo- habria dibujado selectores de fecha sin que nadie lo notara hasta usarlo.
 *
 * Un rango sin `subtipo` cae en NumberField. Es a proposito y no al reves: siete de los ocho
 * rangos son de fecha, asi que el defecto contrario taparia el olvido. Que no llegue a pasar lo
 * comprueba packages/shared/filtros.test.js.
 */
export default function FilterBar({ campos = [], valores = {}, onChange, catalogos = {} }) {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(valores);

  const abrir = () => {
    setBorrador(valores);
    setAbierto(true);
  };

  const editar = (id, valor) => setBorrador((actual) => ({ ...actual, [id]: valor }));

  const aplicar = () => {
    // Se emite un onChange por filtro que cambio, con la misma firma que en web, para que el
    // handler de una pantalla portada no tenga que distinguir la plataforma.
    for (const campo of campos) {
      if (borrador[campo.id] !== valores[campo.id]) onChange?.(campo.id, borrador[campo.id]);
    }
    setAbierto(false);
  };

  const activos = campos.filter((campo) => {
    const valor = valores[campo.id];
    return valor !== null && valor !== undefined && valor !== "";
  }).length;

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [styles.cabecera, pressed && styles.cabeceraPressed]}
        onPress={() => (abierto ? setAbierto(false) : abrir())}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
      >
        <Text style={styles.cabeceraTexto}>Filtros{activos > 0 ? ` (${activos})` : ""}</Text>
        <Text style={styles.cabeceraTexto}>{abierto ? "-" : "+"}</Text>
      </Pressable>

      {abierto ? (
        <View style={styles.panel}>
          {campos.map((campo) => {
            const valor = borrador[campo.id];

            if (campo.tipo === TIPOS_DE_FILTRO.BUSQUEDA) {
              return (
                <TextField
                  key={campo.id}
                  label={campo.label}
                  placeholder={campo.placeholder}
                  value={valor ?? ""}
                  onChangeText={(texto) => editar(campo.id, texto)}
                />
              );
            }

            if (campo.tipo === TIPOS_DE_FILTRO.SELECT) {
              const opciones = campo.opciones ?? catalogos[campo.opcionesDesde] ?? [];
              return (
                <Selector
                  key={campo.id}
                  label={campo.label}
                  value={valor ?? null}
                  options={opciones}
                  onSelect={(elegido) => editar(campo.id, elegido)}
                  placeholder={opciones.length === 0 ? "Sin opciones" : "Todos"}
                  style={opciones.length === 0 ? styles.deshabilitado : undefined}
                />
              );
            }

            if (campo.tipo === TIPOS_DE_FILTRO.RANGO) {
              const rango = valor ?? {};
              const esFecha = campo.subtipo === SUBTIPOS_DE_RANGO.FECHA;
              const Campo = esFecha ? DateField : NumberField;
              const limites = esFecha
                ? [{ maxDate: rango.max ?? undefined }, { minDate: rango.min ?? undefined }]
                : [
                    { min: campo.min, max: rango.max ?? campo.max },
                    { min: rango.min ?? campo.min, max: campo.max },
                  ];

              return (
                <View key={campo.id} style={styles.rango}>
                  <Text style={styles.rangoLabel}>{campo.label}</Text>
                  <View style={styles.rangoFila}>
                    <Campo
                      label="Desde"
                      value={rango.min ?? null}
                      onChange={(nuevo) => editar(campo.id, { ...rango, min: nuevo })}
                      style={styles.rangoCampo}
                      {...limites[0]}
                    />
                    <Campo
                      label="Hasta"
                      value={rango.max ?? null}
                      onChange={(nuevo) => editar(campo.id, { ...rango, max: nuevo })}
                      style={styles.rangoCampo}
                      {...limites[1]}
                    />
                  </View>
                </View>
              );
            }

            // Un tipo que este componente todavia no sabe dibujar se omite en silencio: el
            // resto de los filtros sigue siendo util.
            return null;
          })}

          <PrimaryButton title="Aplicar" onPress={aplicar} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  cabecera: {
    minHeight: MIN_TOUCH_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.xs,
    backgroundColor: colors.surface,
  },
  cabeceraPressed: { opacity: 0.7 },
  cabeceraTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  panel: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.xs,
    backgroundColor: colors.surface,
  },
  deshabilitado: { opacity: 0.5 },
  rango: { marginBottom: spacing.md },
  rangoLabel: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  rangoFila: { flexDirection: "row", gap: spacing.sm },
  rangoCampo: { flex: 1 },
});
