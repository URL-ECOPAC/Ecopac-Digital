import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
} from "react-native";
// Agrega un "../" extra (4 niveles hacia arriba)
import { useCatalogoMedicamentos } from "../../../../packages/shared/inventario/useCatalogoMedicamentos";
import { ROUTES } from "../navigation/rutas";

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

  /**
   * Tocar un medicamento del inventario (issue #165, criterio 1: "seleccionar un medicamento
   * existente"). `esModoSeleccion` es el modo viejo (nadie navega hoy a esta pantalla con ese
   * parametro, pero se conserva por si alguna otra pantalla lo usa en el futuro): si esta
   * activo, sigue devolviendo el item al que llamo. Fuera de ese modo -que es como se llega
   * aqui desde el tab Inventario- tocar un medicamento abre "Registrar ingreso" con ese
   * medicamento ya elegido, en vez de no hacer nada.
   */
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
          <Text style={styles.detalleLabel}>
            Lote: <Text style={styles.detalleVal}>{lote}</Text>
          </Text>
          <Text style={styles.detalleLabel}>
            Bodega: <Text style={styles.bodegaHighlight}>{String(bodega).toUpperCase()}</Text>
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.caducidadLabel}>Caducidad</Text>
            <Text style={styles.caducidadValue}>{caducidad}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
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

  // "Por Vencer" se cuenta sobre lo que ya esta filtrado en pantalla: cada item trae
  // proximoAVencer calculado en StockScreen.js (diasHastaVencimiento <= 30, mismo umbral que
  // useVistaExistencias.js). "Sin Stock" no se puede derivar de este arreglo -
  // inventarioInicial/inventarioFiltrado solo trae lo que SI tiene existencia disponible
  // (vista_lotes_disponibles, 00047)-, asi que StockScreen.js lo calcula aparte contra el
  // catalogo completo y lo pasa en `medicamentosSinStock`.
  const totalPorVencer = listaInventario.filter((item) => item?.proximoAVencer).length;

  // Bodegas reales para el filtro (issue #165): antes esta lista era un arreglo fijo
  // ["Todas","Central","Norte","Sur"] que no correspondia a ninguna bodega real de la base, asi
  // que elegir cualquiera que no fuera "Todas" no encontraba nada. `bodegas` ya llega como prop
  // desde StockScreen.js (listarBodegas()), la misma fuente que usa el alta de un medicamento.
  // { label, value } y no solo el nombre: el estado inicial de bodegaSeleccionada es "todas" en
  // minuscula (useCatalogoMedicamentos.js), y comparar contra un "Todas" con mayuscula dejaba el
  // pill "Todas" sin marcar como activo al abrir la pantalla aunque el filtro si funcionara.
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
          <View style={[styles.dotIndicator, { backgroundColor: "#10b981" }]} />
          <Text style={styles.kpiValue}>{listaInventario.length}</Text>
          <Text style={styles.kpiLabel}>Referencias</Text>
        </View>
        <View style={styles.kpiCard}>
          <View style={[styles.dotIndicator, { backgroundColor: "#f59e0b" }]} />
          <Text style={styles.kpiValue}>{totalPorVencer}</Text>
          <Text style={styles.kpiLabel}>Por Vencer</Text>
        </View>
        <View style={styles.kpiCard}>
          <View style={[styles.dotIndicator, { backgroundColor: "#ec4899" }]} />
          <Text style={styles.kpiValue}>{medicamentosSinStock}</Text>
          <Text style={styles.kpiLabel}>Sin Stock</Text>
        </View>
      </ScrollView>

      {/* 2. Input de Búsqueda */}
      <TextInput
        style={styles.searchInput}
        placeholder="🔍 Código, descripción o lote..."
        value={busqueda}
        onChangeText={setBusqueda}
        placeholderTextColor="#94a3b8"
      />

      {/* 3. Selector de Bodegas */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bodegasContainer}
        contentContainerStyle={styles.bodegasContenido}
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
      <View style={{ maxHeight: 38, marginBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {listaCategorias.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.pill, categoriaSeleccionada === cat && styles.pillActive]}
              onPress={() => setCategoriaSeleccionada(cat)}
            >
              <Text
                style={[styles.pillText, categoriaSeleccionada === cat && styles.pillTextActive]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 5. Lista en Móvil */}
      <FlatList
        data={listaInventario}
        keyExtractor={(item, index) => item?.id?.toString() || index.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={{ padding: 24, alignItems: "center" }}>
            <Text style={{ color: "#94a3b8" }}>No se encontraron elementos.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 14, backgroundColor: "#f8fafc" },
  kpiContainer: { maxHeight: 65, marginBottom: 10 },
  kpiCard: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    minWidth: 110,
  },
  dotIndicator: { width: 6, height: 6, borderRadius: 3, marginBottom: 2 },
  kpiValue: { fontSize: 16, fontWeight: "bold", color: "#0f172a" },
  kpiLabel: { fontSize: 10, color: "#64748b" },
  searchInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    fontSize: 13,
  },
  // Antes flexDirection:"row" con bodegaBtn a flex:1: repartia el ancho fijo del telefono entre
  // los 4 nombres cortos y fijos de antes. Los nombres reales de bodega (p. ej. "Bodega Movil
  // Demo") no caben asi con una lista que ademas puede crecer, asi que ahora es scroll
  // horizontal con botones de ancho propio.
  bodegasContainer: { marginBottom: 10 },
  bodegasContenido: { flexDirection: "row", gap: 6, paddingRight: 4 },
  bodegaBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  bodegaBtnActiva: { backgroundColor: "#dcfce7", borderColor: "#86efac" },
  bodegaBtnText: { fontSize: 11, color: "#64748b" },
  bodegaBtnTextActiva: { color: "#166534", fontWeight: "bold" },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  pillActive: { backgroundColor: "#dcfce7", borderColor: "#86efac" },
  pillText: { color: "#64748b", fontSize: 11 },
  pillTextActive: { color: "#166534", fontWeight: "bold" },
  itemCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardNoDisponible: { opacity: 0.6 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  codigoText: { color: "#059669", fontWeight: "bold", fontSize: 12 },
  badgeBase: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeDisponible: { backgroundColor: "#dcfce7" },
  badgeCritico: { backgroundColor: "#fce7f3" },
  badgeAgotado: { backgroundColor: "#f1f5f9" },
  badgeText: { fontSize: 9, fontWeight: "bold" },
  textDisponible: { color: "#166534" },
  textCritico: { color: "#be185d" },
  textAgotado: { color: "#64748b" },
  descripcionText: { fontSize: 14, fontWeight: "bold", color: "#0f172a", marginBottom: 6 },
  detallesGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  detalleLabel: { fontSize: 11, color: "#64748b" },
  detalleVal: { color: "#0f172a" },
  bodegaHighlight: { color: "#059669", fontWeight: "bold" },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8,
  },
  caducidadLabel: { fontSize: 10, color: "#94a3b8" },
  caducidadValue: { fontSize: 11, color: "#334155", fontWeight: "500" },
  stockText: { fontSize: 14, fontWeight: "bold", color: "#0f172a" },
  unitText: { fontSize: 10, fontWeight: "normal", color: "#64748b" },
  precioText: { fontSize: 11, color: "#64748b" },
});
