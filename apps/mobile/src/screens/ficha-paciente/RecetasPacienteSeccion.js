import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { useRecetasPaciente } from "@ecopac/shared";

export default function RecetasPacienteSeccion({ pacienteId }) {
  const { recetas, cargando, error, recargar } = useRecetasPaciente(pacienteId);

  if (cargando) {
    return (
      <View style={styles.centroContainer} testID="cargando-recetas">
        <ActivityIndicator size="small" color="#0284c7" />
        <Text style={styles.textoCargando}>Cargando recetas...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.textoError}>
          {typeof error === "string" ? error : error?.mensaje || "Error al obtener las recetas."}
        </Text>
        <TouchableOpacity style={styles.botonReintentar} onPress={recargar}>
          <Text style={styles.textoBotonReintentar}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!recetas || recetas.length === 0) {
    return (
      <View style={styles.vacioContainer}>
        <Text style={styles.textoVacio}>Sin recetas emitidas para este paciente.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.tituloSeccion}>Recetas Emitidas</Text>
      <FlatList
        data={recetas}
        keyExtractor={(item, index) => item.id?.toString() || index.toString()}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.tarjetaReceta}>
            <View style={styles.encabezadoReceta}>
              <Text style={styles.fechaTexto}>{item.fecha || item.creadoEn || "Fecha N/A"}</Text>
              <Text style={styles.medicoTexto}>{item.medicoNombre || item.medico || "Médico"}</Text>
            </View>

            {Array.isArray(item.medicamentos) && item.medicamentos.length > 0 ? (
              item.medicamentos.map((med, idx) => (
                <View key={med.id || idx} style={styles.filamedicamento}>
                  <Text style={styles.nombreMedicamento}>• {med.nombre || med.medicamento}</Text>
                  <Text style={styles.dosisTexto}>
                    {med.dosis ? `${med.dosis} - ` : ""}
                    {med.indicaciones || med.frecuencia || ""}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.indicacionesTexto}>
                {item.indicaciones || item.diagnostico || "Sin detalle de medicamentos"}
              </Text>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  tituloSeccion: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 12,
  },
  centroContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  textoCargando: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748b",
  },
  errorContainer: {
    padding: 16,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 8,
  },
  textoError: {
    color: "#dc2626",
    fontSize: 14,
    marginBottom: 8,
    textAlign: "center",
  },
  botonReintentar: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  textoBotonReintentar: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  vacioContainer: {
    padding: 16,
    alignItems: "center",
  },
  textoVacio: {
    fontSize: 14,
    color: "#64748b",
    fontStyle: "italic",
  },
  tarjetaReceta: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  encabezadoReceta: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 6,
    marginBottom: 8,
  },
  fechaTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  medicoTexto: {
    fontSize: 12,
    color: "#64748b",
  },
  filamedicamento: {
    marginBottom: 4,
  },
  nombreMedicamento: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  dosisTexto: {
    fontSize: 12,
    color: "#475569",
    marginLeft: 10,
  },
  indicacionesTexto: {
    fontSize: 12,
    color: "#334155",
    fontStyle: "italic",
  },
});
