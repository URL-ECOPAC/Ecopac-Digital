import React from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { modulosVisibles } from "@ecopac/shared";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";

export default function InicioScreen({ navigation }) {
  const { perfil } = useSesionCompartida();
  const rol = perfil?.rol;

  // Filtrar módulos para la cuadrícula (excluyendo "inicio")
  const modulosDisponibles = modulosVisibles(rol, { plataforma: "mobile" }).filter(
    (m) => m.id !== "inicio",
  );

  const navegarAModulo = (modulo) => {
    const mapaRutas = {
      pacientes: ROUTES.BUSQUEDA_PACIENTE,
      inventario: ROUTES.STOCK,
      jornadas: ROUTES.SELECCION_JORNADA,
      donaciones: ROUTES.DONACIONES,
      presupuestos: ROUTES.PRESUPUESTOS,
      proyectos: ROUTES.PROYECTOS,
      voluntarios: ROUTES.VOLUNTARIOS,
      ajustes: ROUTES.TAB_AJUSTES,
    };

    const rutaDestino = mapaRutas[modulo.id];
    if (rutaDestino) {
      navigation.navigate(rutaDestino);
    }
  };

  // Métricas de prueba según prototipo Figma
  const metricas = [
    {
      id: "1",
      titulo: "PACIENTES ATENDIDOS",
      valor: "235",
      subtexto: "histórico total",
      color: "#10B981",
    },
    {
      id: "2",
      titulo: "DONACIONES RECIBIDAS",
      valor: "Q 553,800",
      subtexto: "este año",
      color: "#0EA5E9",
    },
    {
      id: "3",
      titulo: "VOLUNTARIOS ACTIVOS",
      valor: "9",
      subtexto: "personal registrado",
      color: "#F97316",
    },
    { id: "4", titulo: "JORNADAS 2026", valor: "4", subtexto: "1 finalizadas", color: "#EC4899" },
  ];

  // Panel de alertas activas de caducidad (RF-19)
  const alertasCaducidad = [
    {
      id: "1",
      nombre: "Amoxicilina 500mg Cápsulas",
      codigo: "FAR-0041",
      lote: "L-2024-0091",
      dias: "30d",
    },
    {
      id: "2",
      nombre: "Metformina 850mg Comprimidos",
      codigo: "FAR-0099",
      lote: "L-2024-0567",
      dias: "12d",
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 1. HERO BANNER */}
        <View style={styles.heroBanner}>
          <View style={styles.heroBadge}>
            <View style={styles.dot} />
            <Text style={styles.heroBadgeText}>SISTEMA ACTIVO • 2026</Text>
          </View>
          <Text style={styles.heroTitle}>Salud que llega a cada comunidad.</Text>
          <Text style={styles.heroDescription}>
            Plataforma integral de gestión para jornadas médicas. Pacientes, inventario, jornadas,
            voluntarios, proyectos y presupuestos en un solo lugar.
          </Text>
          <View style={styles.heroButtonsContainer}>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => navigation.navigate(ROUTES.STOCK)}
            >
              <Text style={styles.btnPrimaryText}>Ver inventario</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() => navigation.navigate(ROUTES.PRESUPUESTOS)}
            >
              <Text style={styles.btnSecondaryText}>Ver presupuestos</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. MÉTRICAS CLAVE */}
        <View style={styles.gridTwoColumns}>
          {metricas.map((item) => (
            <View key={item.id} style={styles.metricCard}>
              <View style={[styles.cardDot, { backgroundColor: item.color }]} />
              <Text style={styles.cardHeaderTitle}>{item.titulo}</Text>
              <Text style={[styles.metricValue, { color: item.color }]}>{item.valor}</Text>
              <Text style={styles.cardSubtext}>{item.subtexto}</Text>
            </View>
          ))}
        </View>

        {/* 3. MÓDULOS DEL SISTEMA */}
        <Text style={styles.sectionTitle}>MÓDULOS DEL SISTEMA</Text>
        <View style={styles.gridTwoColumns}>
          {modulosDisponibles.map((modulo) => (
            <TouchableOpacity
              key={modulo.id}
              style={styles.moduleCard}
              onPress={() => navegarAModulo(modulo)}
            >
              <View style={[styles.cardDot, { backgroundColor: "#10B981" }]} />
              <Text style={styles.moduleTitle}>{modulo.etiqueta}</Text>
              <Text style={styles.cardSubtext}>Acceso directo</Text>
              <Text style={styles.moduleArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 4. PANEL DE ALERTAS DE CADUCIDAD (RF-19) */}
        <View style={styles.alertsPanel}>
          <View style={styles.alertsHeader}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={[styles.cardDot, { backgroundColor: "#F97316" }]} />
              <Text style={styles.alertsTitle}>{alertasCaducidad.length} ALERTAS DE CADUCIDAD</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate(ROUTES.STOCK)}>
              <Text style={styles.seeAllText}>Ver todas →</Text>
            </TouchableOpacity>
          </View>

          {alertasCaducidad.map((item) => (
            <View key={item.id} style={styles.alertCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertName}>{item.nombre}</Text>
                <Text style={styles.alertDetails}>
                  {item.codigo} • Lote {item.lote}
                </Text>
              </View>
              <Text style={styles.alertDays}>{item.dias}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  // Hero Banner
  heroBanner: {
    backgroundColor: "#16A34A",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
    marginRight: 6,
  },
  heroBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    lineHeight: 30,
  },
  heroDescription: {
    color: "#E2E8F0",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  heroButtonsContainer: {
    gap: 10,
  },
  btnPrimary: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnPrimaryText: {
    color: "#16A34A",
    fontWeight: "bold",
    fontSize: 14,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnSecondaryText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  // Grid System
  gridTwoColumns: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  moduleCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  cardHeaderTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 2,
  },
  cardSubtext: {
    fontSize: 11,
    color: "#94A3B8",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  moduleTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 2,
  },
  moduleArrow: {
    fontSize: 16,
    color: "#94A3B8",
    marginTop: 6,
  },
  // Panel de Alertas
  alertsPanel: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FFEDD5",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  alertsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  alertsTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#EA580C",
    marginLeft: 6,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#EA580C",
  },
  alertCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  alertName: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1E293B",
  },
  alertDetails: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  alertDays: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#DC2626",
    marginLeft: 8,
  },
});