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
import { colors } from "@ecopac/ui-tokens";

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
        <ActivityIndicator size="small" color={colors.info} />
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
              <MetricBox label="F.C." valor={item.frecuenciaCardiaca || "--"} unidad="bpm" />
              <MetricBox label="F.R." valor={item.frecuenciaRespiratoria || "--"} unidad="rpm" />
              <MetricBox label="Temp." valor={item.temperatura || "--"} unidad="°C" />
              <MetricBox label="Sat O₂" valor={item.saturacionOxigeno || "--"} unidad="%" />
              <MetricBox label="Peso" valor={item.peso || "--"} unidad="kg" />
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
    color: colors.text,
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
    color: colors.textMuted,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 8,
  },
  textoError: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: 8,
    textAlign: "center",
  },
  botonReintentar: {
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  textoBotonReintentar: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: "600",
  },
  vacioContainer: {
    padding: 16,
    alignItems: "center",
  },
  textoVacio: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  tarjetaTriaje: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  fechaTexto: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  gridMediciones: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  metricBox: {
    width: "30%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.background,
    borderRadius: 6,
    padding: 6,
    marginBottom: 8,
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "500",
  },
  metricValor: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginTop: 2,
  },
  metricUnidad: {
    fontSize: 10,
    fontWeight: "400",
    color: colors.textMuted,
  },
});
