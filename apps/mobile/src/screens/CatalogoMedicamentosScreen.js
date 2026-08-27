import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { useCatalogoMedicamentos } from "@ecopac/shared/inventario";

export function CatalogoMedicamentosScreen({ inventarioInicial, bodegas }) {
  const {
    busqueda,
    setBusqueda,
    categoriaSeleccionada,
    setCategoriaSeleccionada,
    categoriasPills,
    inventarioFiltrado,
    hayFiltrosActivos,
    limpiarFiltros,
  } = useCatalogoMedicamentos({ inventarioInicial, bodegas });

  return (
    <View style={styles.container}>
      {/* Buscador por Nombre / Principio Activo */}
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar por nombre o principio activo..."
        value={busqueda}
        onChangeText={setBusqueda}
      />

      {/* Pills de Categorías */}
      <View style={styles.pillsContainer}>
        {categoriasPills.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.pill,
              categoriaSeleccionada === cat && styles.pillActive,
            ]}
            onPress={() => setCategoriaSeleccionada(cat)}
          >
            <Text
              style={[
                styles.pillText,
                categoriaSeleccionada === cat && styles.pillTextActive,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Botón para limpiar filtros */}
      {hayFiltrosActivos && (
        <TouchableOpacity style={styles.clearButton} onPress={limpiarFiltros}>
          <Text style={styles.clearButtonText}>Limpiar filtros</Text>
        </TouchableOpacity>
      )}

      {/* Lista del Catálogo */}
      <FlatList
        data={inventarioFiltrado}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <Text style={styles.itemTitle}>{item.nombre}</Text>
            <Text style={styles.itemSubtitle}>
              Principio activo: {item.principio_activo || "N/A"}
            </Text>
            <Text style={styles.itemBadge}>{item.categoria}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  searchInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  pillsContainer: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#e0e0e0",
    marginRight: 8,
    marginBottom: 8,
  },
  pillActive: { backgroundColor: "#007bff" },
  pillText: { color: "#333" },
  pillTextActive: { color: "#fff", fontWeight: "bold" },
  clearButton: { marginBottom: 12 },
  clearButtonText: { color: "#d9534f", fontWeight: "bold" },
  itemCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    marginBottom: 8,
  },
  itemTitle: { fontSize: 16, fontWeight: "bold" },
  itemSubtitle: { color: "#666" },
  itemBadge: { marginTop: 4, color: "#007bff", fontSize: 12 },
});