import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import CondicionesPacienteSeccion from "./ficha-paciente/CondicionesPacienteSeccion";
import SignosVitalesSeccion from "./ficha-paciente/SignosVitalesSeccion";
import RecetasPacienteSeccion from "./ficha-paciente/RecetasPacienteSeccion";

export default function FichaPacienteScreen({ route, navigation }) {
  const { paciente, rol = "medico" } = route.params || {};
  const [pestanaActiva, setPestanaActiva] = useState("historial");

  if (!paciente) {
    return (
      <View style={styles.centroContainer}>
        <Text style={styles.textoError}>No se proporcionó información del paciente.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Encabezado del Paciente */}
      <View style={styles.encabezado}>
        <Text style={styles.nombrePaciente}>
          {paciente.nombre} {paciente.apellido}
        </Text>
        <Text style={styles.detallesPaciente}>
          CUI/DPI: {paciente.documento || paciente.cui || "N/A"} | Edad: {paciente.edad || "--"} años
        </Text>
      </View>

      {/* Navegación por pestañas */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, pestanaActiva === "historial" && styles.tabItemActivo]}
          onPress={() => setPestanaActiva("historial")}
        >
          <Text style={[styles.tabTexto, pestanaActiva === "historial" && styles.tabTextoActivo]}>
            Condiciones
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, pestanaActiva === "signos" && styles.tabItemActivo]}
          onPress={() => setPestanaActiva("signos")}
        >
          <Text style={[styles.tabTexto, pestanaActiva === "signos" && styles.tabTextoActivo]}>
            Signos Vitales
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, pestanaActiva === "recetas" && styles.tabItemActivo]}
          onPress={() => setPestanaActiva("recetas")}
        >
          <Text style={[styles.tabTexto, pestanaActiva === "recetas" && styles.tabTextoActivo]}>
            Recetas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contenido de la Pestaña Activa */}
      <ScrollView contentContainerStyle={styles.contenidoScroll}>
        {pestanaActiva === "historial" && (
          <CondicionesPacienteSeccion pacienteId={paciente.id} rol={rol} />
        )}

        {pestanaActiva === "signos" && (
          <SignosVitalesSeccion pacienteId={paciente.id} />
        )}

        {pestanaActiva === "recetas" && (
          <RecetasPacienteSeccion pacienteId={paciente.id} />
        )}
      </ScrollView>

      {/* Botones de Acción de Flujo Clinico */}
      <View style={styles.accionesBar}>
        <TouchableOpacity
          style={styles.botonAccion}
          onPress={() => navigation.navigate("Triaje", { paciente })}
        >
          <Text style={styles.textoBotonAccion}>Nuevo Triaje</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.botonAccion, styles.botonConsulta]}
          onPress={() => navigation.navigate("Consulta", { paciente })}
        >
          <Text style={styles.textoBotonAccion}>Nueva Consulta</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  centroContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  textoError: {
    color: "#dc2626",
    fontSize: 16,
  },
  encabezado: {
    padding: 16,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  nombrePaciente: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f172a",
  },
  detallesPaciente: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActivo: {
    borderBottomColor: "#0284c7",
  },
  tabTexto: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748b",
  },
  tabTextoActivo: {
    color: "#0284c7",
    fontWeight: "700",
  },
  contenidoScroll: {
    padding: 16,
  },
  accionesBar: {
    flexDirection: "row",
    padding: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  botonAccion: {
    flex: 1,
    backgroundColor: "#0284c7",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  botonConsulta: {
    backgroundColor: "#059669",
  },
  textoBotonAccion: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
});