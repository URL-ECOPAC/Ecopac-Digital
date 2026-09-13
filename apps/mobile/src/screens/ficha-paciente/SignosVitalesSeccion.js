import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { obtenerTriajes } from "@ecopac/shared";

export default function SignosVitalesSeccion({ pacienteId }) {
  const [triajes, setTriajes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargarSignosVitales = useCallback(async () => {
    if (!pacienteId) return;
    try {
      setCargando(true);
      setError(null);
      const respuesta = await obtenerTriajes(pacienteId);

      if (respuesta?.error) {
        setError(respuesta.error.mensaje || "Error al cargar los signos vitales.");
        setTriajes([]);
      } else {
        // La API puede retornar un arreglo directamente o dentro de un objeto de datos
        const lista = Array.isArray(respuesta) ? respuesta : respuesta?.datos || [];
        setTriajes(lista);
      }
    } catch (err) {
      setError("No se pudieron obtener los signos vitales.");
    } finally {
      setCargando(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    cargarSignosVitales();
  }, [cargarSignosVitales]);

  if (cargando) {
    return (
      <View style={styles.centroContainer} testID="cargando-signos">
        <ActivityIndicator size="small" color="#0284c7" />
        <Text style={styles.textoCargando}>Cargando signos vitales...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.textoError}>{error}</Text>
        <TouchableOpacity style={styles.botonReintentar} onPress={cargarSignosVitales}>
          <Text style={styles.textoBotonReintentar}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!triajes || triajes.length === 0) {
    return (
      <View style={styles.vacioContainer}>
        <Text style={styles.textoVacio}>Sin registros de signos vitales.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.tituloSeccion}>Historial de Signos Vitales</Text>
      <FlatList
        data={triajes}
        keyExtractor={(item, index) => item.id?.toString() || index.toString()}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.tarjetaTriaje}>
            <Text style={styles.fechaTexto}>
              {item.fecha || item.creadoEn || "Fecha no especificada"}
            </Text>
            <View style={styles.gridMediciones}>
              <MetricBox
                label="P.A."
                valor={
                  item.presionSistolica && item.presionDiastolica
                    ? `${item.presionSistolica}/${item.presionDiastolica}`
                    : item.presionArterial || "--"
                }
                unidad="mmHg"
              />
              <MetricBox
                label="F.C."
                valor={item.frecuenciaCardiaca || "--"}
                unidad="bpm"
              />
              <MetricBox
                label="F.R."
                valor={item.frecuenciaRespiratoria || "--"}
                unidad="rpm"
              />
              <MetricBox
                label="Temp."
                valor={item.temperatura || "--"}
                unidad="°C"
              />
              <MetricBox
                label="Sat O₂"
                valor={item.saturacionOxigeno || "--"}
                unidad="%"
              />
              <MetricBox
                label="Peso"
                valor={item.peso || "--"}
                unidad="kg"
              />
            </View>
          </View>
        )}
      />
    </View>
  );
}

function MetricBox({ label, valor, unidad }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValor}>
        {valor} <Text style={styles.metricUnidad}>{unidad}</Text>
      </Text>
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
  tarjetaTriaje: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  fechaTexto: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 8,
  },
  gridMediciones: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  metricBox: {
    width: "30%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    borderRadius: 6,
    padding: 6,
    marginBottom: 8,
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  metricValor: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 2,
  },
  metricUnidad: {
    fontSize: 10,
    fontWeight: "400",
    color: "#94a3b8",
  },
});