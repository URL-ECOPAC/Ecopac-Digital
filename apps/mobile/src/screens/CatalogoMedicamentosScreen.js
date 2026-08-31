import React from "react";
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

export default function CatalogoMedicamentosScreen({
  inventarioInicial = [],
  bodegas = [],
  route,
  navigation,
}) {
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
    if (!esModoSeleccion) return;
    const stock = item?.stock ?? item?.cantidad_disponible ?? 0;
    const estaVencido = item?.estaVencido || item?.esta_vencido || false;

    if (estaVencido || stock <= 0) return;

    if (onSeleccionarMedicamento) {
      onSeleccionarMedicamento(item);
      navigation?.goBack();
    }
  };

  const getBadgesAndStyles = (item) => {
    const stock = item?.stock ?? item?.cantidad_disponible ?? 0;
    const estaVencido = item?.estaVencido || item?.esta_vencido || false;

    if (stock <= 0) {
      return { label: "AGOTADO", style: styles.badgeAgotado, textStyle: styles.textAgotado };
    }
    if (estaVencido) {
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

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <View style={[styles.dotIndicator, { backgroundColor: "#10b981" }]} />
          <Text style={styles.kpiValue}>{listaInventario.length}</Text>
          <Text style={styles.kpiLabel}>Referencias</Text>
        </View>
        <View style={styles.kpiCard}>
          <View style={[styles.dotIndicator, { backgroundColor: "#f59e0b" }]} />
          <Text style={styles.kpiValue}>2</Text>
          <Text style={styles.kpiLabel}>Por Vencer</Text>
        </View>
        <View style={styles.kpiCard}>
          <View style={[styles.dotIndicator, { backgroundColor: "#ec4899" }]} />
          <Text style={styles.kpiValue}>1</Text>
          <Text style={styles.kpiLabel}>Sin Stock</Text>
        </View>
      </ScrollView>

      <TextInput
        style={styles.searchInput}
        placeholder="🔍 Código, descripción o lote..."
        value={busqueda}
        onChangeText={setBusqueda}
        placeholderTextColor="#94a3b8"
      />

      <View style={styles.bodegasContainer}>
        {["Todas", "Central", "Norte", "Sur"].map((b) => {
          const seleccionada = bodegaSeleccionada === b;
          return (
            <TouchableOpacity
              key={b}
              onPress={() => setBodegaSeleccionada(b)}
              style={[styles.bodegaBtn, seleccionada && styles.bodegaBtnActiva]}
            >
              <Text style={[styles.bodegaBtnText, seleccionada && styles.bodegaBtnTextActiva]}>
                {b}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

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
  bodegasContainer: { flexDirection: "row", gap: 6, marginBottom: 10 },
  bodegaBtn: {
    flex: 1,
    paddingVertical: 6,
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