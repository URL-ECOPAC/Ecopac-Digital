import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SUBTIPOS_DE_RANGO, TIPOS_DE_FILTRO, formatearFechaCorta } from "@ecopac/shared";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";
import BotonLimpiarFiltros from "./BotonLimpiarFiltros";
import DateField from "./DateField";
import NumberField from "./NumberField";
import PanelLateral from "./PanelLateral";
import PrimaryButton from "./PrimaryButton";
import Selector from "./Selector";
import TextField from "./TextField";

const MIN_TOUCH_HEIGHT = 48;

/** Un filtro tiene valor: texto no vacio, opcion elegida o un rango con algun extremo. */
function tieneValor(campo, valor) {
  if (campo.tipo === TIPOS_DE_FILTRO.RANGO) {
    return Boolean(valor) && (valor.min != null || valor.max != null);
  }
  return valor !== null && valor !== undefined && valor !== "";
}

/** Texto del chip de un filtro activo: "Bodega: Principal", "Fecha: 01/09/2026 - 30/09/2026". */
function textoDelChip(campo, valor, catalogos) {
  if (campo.tipo === TIPOS_DE_FILTRO.SELECT) {
    const opciones = campo.opciones ?? catalogos[campo.opcionesDesde] ?? [];
    const opcion = opciones.find((o) => o.value === valor);
    return `${campo.label}: ${opcion?.label ?? valor}`;
  }
  if (campo.tipo === TIPOS_DE_FILTRO.RANGO) {
    const esFecha = campo.subtipo === SUBTIPOS_DE_RANGO.FECHA;
    const ver = (v) => (v == null ? "" : esFecha ? formatearFechaCorta(v) : String(v));
    if (valor.min != null && valor.max != null) {
      return `${campo.label}: ${ver(valor.min)} - ${ver(valor.max)}`;
    }
    return valor.min != null
      ? `${campo.label}: desde ${ver(valor.min)}`
      : `${campo.label}: hasta ${ver(valor.max)}`;
  }
  return `${campo.label}: ${valor}`;
}

/**
 * Barra de filtros del movil. Mismas props que apps/web/src/components/FilterBar.jsx: no conoce
 * los filtros de ningun modulo, solo la forma generica del descriptor.
 *
 * COMO SE VE. El patron de filtros de las apps moviles (Material 3 "side sheet", y el de las
 * tiendas y bancas moviles): en la pantalla queda solo lo que se usa siempre -el buscador, si el
 * descriptor trae uno, y un boton "Filtros" con cuantos hay puestos-; el resto vive en un PANEL
 * LATERAL que entra desde la derecha, con su propio scroll y "Aplicar" fijo al pie. Los filtros
 * puestos se ven debajo como chips, y cada uno se quita con su "x" sin abrir el panel.
 *
 * Antes era un panel que se desplegaba dentro de la pantalla: con cuatro filtros abiertos se comia
 * la altura del telefono y, dentro de una lista, ya no se podia bajar hasta los resultados.
 *
 * El buscador se aplica al escribir, como en la web. Lo del panel se acumula en un borrador y sale
 * por onChange al pulsar "Aplicar", un onChange por filtro que cambio y con la misma firma que en
 * la web: en un telefono cada cambio suelto dispararia una consulta a mitad de la seleccion.
 *
 * Sobre las opciones de un select: un descriptor puede traerlas escritas (`opciones`) o decir de
 * que catalogo salen (`opcionesDesde`). De que es un rango lo dice `subtipo` (issue #386); un rango
 * sin subtipo cae en NumberField, a proposito (filtros.test.js de shared lo comprueba).
 *
 * `onLimpiar` y `hayFiltros` (issue #864) tienen el mismo contrato que en la web: el boton solo
 * existe si la pantalla pasa `onLimpiar`, y se deshabilita cuando no hay nada que limpiar.
 */
export default function FilterBar({
  campos = [],
  valores = {},
  onChange,
  catalogos = {},
  onLimpiar,
  hayFiltros = true,
}) {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(valores);

  const busquedas = campos.filter((campo) => campo.tipo === TIPOS_DE_FILTRO.BUSQUEDA);
  const delPanel = campos.filter((campo) => campo.tipo !== TIPOS_DE_FILTRO.BUSQUEDA);
  const activos = delPanel.filter((campo) => tieneValor(campo, valores[campo.id]));

  const abrir = () => {
    setBorrador(valores);
    setAbierto(true);
  };

  const cerrar = () => setAbierto(false);

  const editar = (id, valor) => setBorrador((actual) => ({ ...actual, [id]: valor }));

  const limpiar = () => {
    onLimpiar?.();
    setAbierto(false);
  };

  const aplicar = () => {
    for (const campo of delPanel) {
      if (borrador[campo.id] !== valores[campo.id]) onChange?.(campo.id, borrador[campo.id]);
    }
    setAbierto(false);
  };

  const quitar = (campo) =>
    onChange?.(campo.id, campo.tipo === TIPOS_DE_FILTRO.RANGO ? { min: null, max: null } : null);

  return (
    <View style={styles.container}>
      <View style={styles.fila}>
        {busquedas.map((campo) => (
          <TextField
            key={campo.id}
            placeholder={campo.placeholder ?? campo.label}
            accessibilityLabel={campo.label}
            value={valores[campo.id] ?? ""}
            onChangeText={(texto) => onChange?.(campo.id, texto)}
            style={styles.busqueda}
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        ))}

        {delPanel.length > 0 ? (
          <Pressable
            style={({ pressed }) => [
              styles.botonFiltros,
              busquedas.length === 0 && styles.botonFiltrosSolo,
              activos.length > 0 && styles.botonFiltrosActivo,
              pressed && styles.presionado,
            ]}
            onPress={abrir}
            accessibilityRole="button"
            accessibilityLabel={
              activos.length > 0 ? `Filtros, ${activos.length} activos` : "Filtros"
            }
            accessibilityState={{ expanded: abierto }}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={activos.length > 0 ? colors.primary : colors.text}
            />
            <Text style={[styles.botonFiltrosTexto, activos.length > 0 && styles.textoActivo]}>
              Filtros
            </Text>
            {activos.length > 0 ? (
              <View style={styles.insignia}>
                <Text style={styles.insigniaTexto}>{activos.length}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>

      {activos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {activos.map((campo) => (
            <Pressable
              key={campo.id}
              onPress={() => quitar(campo)}
              style={({ pressed }) => [styles.chip, pressed && styles.presionado]}
              accessibilityRole="button"
              accessibilityLabel={`Quitar filtro ${campo.label}`}
            >
              <Text style={styles.chipTexto} numberOfLines={1}>
                {textoDelChip(campo, valores[campo.id], catalogos)}
              </Text>
              <Ionicons name="close" size={16} color={colors.primaryDark} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <PanelLateral
        visible={abierto}
        onClose={cerrar}
        title="Filtros"
        pie={
          // Pie fijo: "Aplicar" siempre a la vista, por largo que sea el panel. En columna: dos
          // botones lado a lado en un panel estrecho parten "Limpiar filtros" en dos lineas.
          <>
            <PrimaryButton title="Aplicar" onPress={aplicar} icon={null} />
            {onLimpiar ? <BotonLimpiarFiltros onPress={limpiar} hayFiltros={hayFiltros} /> : null}
          </>
        }
      >
        {delPanel.map((campo) => {
          const valor = borrador[campo.id];

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
                disabled={opciones.length === 0}
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
      </PanelLateral>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md, gap: spacing.sm },
  fila: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  busqueda: { flex: 1, marginBottom: 0 },
  botonFiltros: {
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
  // Sin buscador al lado, el boton se alinea a la derecha, donde se abre el panel.
  botonFiltrosSolo: { marginLeft: "auto" },
  botonFiltrosActivo: { borderColor: colors.primary },
  botonFiltrosTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  textoActivo: { color: colors.primary },
  insignia: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  insigniaTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.surface,
  },
  presionado: { opacity: 0.7 },
  chips: { gap: spacing.sm, paddingRight: spacing.sm },
  chip: {
    maxWidth: 260,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  chipTexto: {
    flexShrink: 1,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primaryDark,
  },
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
