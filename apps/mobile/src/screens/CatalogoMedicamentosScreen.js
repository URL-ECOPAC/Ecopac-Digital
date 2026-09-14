import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useCatalogoMedicamentos } from "@ecopac/shared";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";
import { ROUTES } from "../navigation/rutas";

const ALTURA_CONTROL_FILTRO = spacing.xl + spacing.md;

export function CatalogoMedicamentosScreen({
  inventarioInicial = [],
  bodegas = [],
  medicamentosSinStock = 0,
  route,
  navigation,
}) {
  // Manejo seguro del Hook para evitar colapsos por undefined
  const hookState =
    useCatalogoMedicamentos({
      inventarioInicial: inventarioInicial || [],
      bodegas: bodegas || [],
    }) || {};

  const {
    busqueda = "",
    setBusqueda = () => {},
    categoriaSeleccionada = "Todas",
    setCategoriaSeleccionada = () => {},
    bodegaSeleccionada = "Todas",
    setBodegaSeleccionada = () => {},
    categoriasPills = [],
    inventarioFiltrado = [],
  } = hookState;

  const esModoSeleccion = route?.params?.esModoSeleccion || false;
  const onSeleccionarMedicamento = route?.params?.onSeleccionarMedicamento;


  const handleSeleccionar = (item) => {
    if (esModoSeleccion) {
      const stock = item?.stock ?? item?.cantidad_disponible ?? 0;
      const estaVencido = item?.estaVencido || item?.esta_vencido || false;
      if (estaVencido || stock <= 0) return;

      if (onSeleccionarMedicamento) {
        onSeleccionarMedicamento(item);
        navigation?.goBack();
      }
      return;
    }

    if (!item?.medicamentoId) return;
    navigation?.navigate(ROUTES.REGISTRO_INGRESO, {
      medicamentoId: item.medicamentoId,
      medicamentoNombre: item.nombre,
    });
  };

  const getBadgesAndStyles = (item) => {
    const stock = item?.stock ?? item?.cantidad_disponible ?? 0;
    const estaVencido = item?.estaVencido || item?.esta_vencido || false;
    const proximoAVencer = item?.proximoAVencer || false;

    if (stock <= 0) {
      return { label: "AGOTADO", style: styles.badgeAgotado, textStyle: styles.textAgotado };
    }
    if (estaVencido || proximoAVencer) {
      return { label: "CRÍTICO", style: styles.badgeCritico, textStyle: styles.textCritico };
    }
    return { label: "DISPONIBLE", style: styles.badgeDisponible, textStyle: styles.textDisponible };
  };

  const renderItem = ({ item }) => {
    if (!item) return null;

    const codigo = item.codigo || item.id || "REF-000";
    const descripcion =
      item.descripcion || item.nombre || item.nombre_comercial || "Sin descripción";
    const lote = item.lote || item.serie || "S/L";
    const bodega = item.bodega || "Central";
    const caducidad = item.caducidad || item.fechaVencimiento || "N/A";
    const stock = item.stock ?? item.cantidad_disponible ?? 0;
    const presentacion = item.presentacion || "Unidades";
    const precioUnitario = item.precioUnitario || item.precio_unitario || 0;

    const badgeInfo = getBadgesAndStyles(item);
    const noDisponible = stock <= 0 || item.estaVencido;

    return (
      <TouchableOpacity
        activeOpacity={noDisponible ? 1 : 0.7}
        onPress={() => handleSeleccionar(item)}
        style={[styles.itemCard, noDisponible && styles.cardNoDisponible]}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.codigoText}>{codigo}</Text>
          <View style={[styles.badgeBase, badgeInfo.style]}>
            <Text style={[styles.badgeText, badgeInfo.textStyle]}>{badgeInfo.label}</Text>
          </View>
        </View>

        <Text style={styles.descripcionText}>{descripcion}</Text>

        <View style={styles.detallesGrid}>
          <Text style={styles.detalleLabel} numberOfLines={1}>
            Lote: <Text style={styles.detalleVal}>{lote}</Text>
          </Text>
          <Text style={styles.detalleLabel} numberOfLines={1}>
            Bodega: <Text style={styles.bodegaHighlight}>{String(bodega).toUpperCase()}</Text>
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerColumna}>
            <Text style={styles.caducidadLabel}>Caducidad</Text>
            <Text style={styles.caducidadValue}>{caducidad}</Text>
          </View>
          <View style={[styles.footerColumna, { alignItems: "flex-end" }]}>
            <Text style={styles.stockText}>
              {stock} <Text style={styles.unitText}>{presentacion}</Text>
            </Text>
            <Text style={styles.precioText}>Q {precioUnitario}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const listaCategorias = Array.isArray(categoriasPills) ? categoriasPills : [];
  const listaInventario = Array.isArray(inventarioFiltrado) ? inventarioFiltrado : [];

  const totalPorVencer = listaInventario.filter((item) => item?.proximoAVencer).length;

  const listaBodegas = Array.isArray(bodegas) ? bodegas : [];
  const opcionesDeBodega = [
    { label: "Todas", value: "todas" },
    ...listaBodegas
      .map((b) => ({ label: b?.nombre, value: b?.nombre }))
      .filter((opcion) => opcion.label),
  ];

  return (
    <View style={styles.container}>
      {/* 1. Header con métricas reducidas */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <View style={[styles.dotIndicator, { backgroundColor: colors.primary }]} />
          <Text style={styles.kpiValue}>{listaInventario.length}</Text>
          <Text style={styles.kpiLabel}>Referencias</Text>
        </View>
        <View style={styles.kpiCard}>
          <View style={[styles.dotIndicator, { backgroundColor: colors.warning }]} />
          <Text style={styles.kpiValue}>{totalPorVencer}</Text>
          <Text style={styles.kpiLabel}>Por Vencer</Text>
        </View>
        <View style={styles.kpiCard}>
          <View style={[styles.dotIndicator, { backgroundColor: colors.danger }]} />
          <Text style={styles.kpiValue}>{medicamentosSinStock}</Text>
          <Text style={styles.kpiLabel}>Sin Stock</Text>
        </View>
      </ScrollView>

      {/* 2. Input de Búsqueda */}
      <TextInput
        style={styles.searchInput}
        placeholder="Código, descripción o lote..."
        value={busqueda}
        onChangeText={setBusqueda}
        placeholderTextColor={colors.textMuted}
        textAlignVertical="center"
        includeFontPadding={false}
      />

      {/* 3. Selector de Bodegas */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bodegasContainer}
        contentContainerStyle={styles.filaChipsContenido}
      >
        {opcionesDeBodega.map((opcion) => {
          const seleccionada = bodegaSeleccionada === opcion.value;
          return (
            <TouchableOpacity
              key={opcion.value}
              onPress={() => setBodegaSeleccionada(opcion.value)}
              style={[styles.bodegaBtn, seleccionada && styles.bodegaBtnActiva]}
            >
              <Text
                style={[styles.bodegaBtnText, seleccionada && styles.bodegaBtnTextActiva]}
                numberOfLines={1}
              >
                {opcion.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 4. Categorías Horizontal */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriasContainer}
        contentContainerStyle={styles.filaChipsContenido}
      >
        {listaCategorias.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.pill, categoriaSeleccionada === cat && styles.pillActive]}
            onPress={() => setCategoriaSeleccionada(cat)}
          >
            <Text
              style={[styles.pillText, categoriaSeleccionada === cat && styles.pillTextActive]}
              numberOfLines={1}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 5. Lista en Móvil */}
      <FlatList
        data={listaInventario}
        keyExtractor={(item, index) => item?.id?.toString() || index.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listaContenido}
        ListEmptyComponent={
          <View style={styles.vacioContenedor}>
            <Text style={styles.vacioTexto}>No se encontraron elementos.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },

  kpiContainer: { maxHeight: 68, marginBottom: spacing.lg },
  kpiCard: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 112,
    justifyContent: "center",
  },
  dotIndicator: { width: 6, height: 6, borderRadius: 3, marginBottom: spacing.xs / 2 },
  kpiValue: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  kpiLabel: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  searchInput: {
    height: ALTURA_CONTROL_FILTRO,

    paddingVertical: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },

  bodegasContainer: { marginBottom: spacing.lg },
  categoriasContainer: { marginBottom: spacing.lg },
  filaChipsContenido: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },

  bodegaBtn: {

    minHeight: ALTURA_CONTROL_FILTRO,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.secondary,
    flexShrink: 0,
  },
  bodegaBtnActiva: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  bodegaBtnText: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  bodegaBtnTextActiva: {
    color: colors.surface,
    fontWeight: typography.weights.bold,
  },
  pill: {
    minHeight: ALTURA_CONTROL_FILTRO,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.secondary,
    flexShrink: 0,
  },
  pillActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  pillText: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  pillTextActive: { color: colors.surface, fontWeight: typography.weights.bold },
  listaContenido: { paddingBottom: spacing.lg },
  vacioContenedor: { padding: spacing.lg, alignItems: "center" },
  vacioTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardNoDisponible: { opacity: 0.6 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  codigoText: {
    fontFamily: typography.fontFamilyBase,
    color: colors.primary,
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.sm,
  },
  badgeBase: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  badgeDisponible: { borderColor: colors.success },
  badgeCritico: { borderColor: colors.danger },
  badgeAgotado: { borderColor: colors.border },
  badgeText: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  textDisponible: { color: colors.success },
  textCritico: { color: colors.danger },
  textAgotado: { color: colors.textMuted },
  descripcionText: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  detallesGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  detalleLabel: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    flexShrink: 1,
    maxWidth: "48%",
  },
  detalleVal: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  bodegaHighlight: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  footerColumna: {
    flexShrink: 1,
  },
  caducidadLabel: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  caducidadValue: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  stockText: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  unitText: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.textMuted,
  },
  precioText: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
});
