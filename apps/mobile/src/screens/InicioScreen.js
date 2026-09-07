import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView } from "react-native";
import { modulosVisibles } from "@ecopac/shared";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";

// Hasta la issue #687, esta pantalla -la primera que ve cualquier persona al entrar a la app-
// mostraba un panel de "METRICAS CLAVE" (235 pacientes, Q 553,800 en donaciones...) y un panel de
// "ALERTAS DE CADUCIDAD" (Amoxicilina, Metformina...) que eran constantes locales, no datos de la
// base: cualquier cuenta, en cualquier momento, veia los mismos numeros.
//
// Los dos paneles se retiran en vez de conectarse a una API real:
// - Las metricas que mostraban (pacientes atendidos, donaciones, voluntarios, jornadas) son las
//   de useDashboardMetricas() (reportes/), pero esa API solo la puede consultar administrador y
//   los roles consultivos (puedeVerIndicadoresDeImpacto) -- y esta es la pantalla de inicio de
//   los cinco roles. Mostrarla siempre resucitaria el mismo defecto para medico/voluntario
//   (verian 0 en todo, sin que sea un dato real), y ocultarla solo para ellos es el alcance de
//   una pantalla nueva, no de este bug.
// - Las alertas de vencimiento para movil no tienen API todavia: la issue #268 es quien la
//   construye.
const MODULOS_FIGMA = [
  {
    id: "pacientes",
    titulo: "Pacientes",
    subtitulo: "Expedientes clínicos",
    valor: "9",
    color: "#10B981",
    tabMovil: "Pacientes",
  },
  {
    id: "donaciones",
    titulo: "Donaciones",
    subtitulo: "Ingresos registrados",
    valor: "Q 553,800",
    color: "#0284C7",
    ruta: ROUTES.DONACIONES,
  },
  {
    id: "inventario",
    titulo: "Inventario",
    subtitulo: "Alertas activas",
    valor: "2",
    color: "#F59E0B",
    tabMovil: "Inventario",
  },
  {
    id: "presupuestos",
    titulo: "Presupuestos",
    subtitulo: "Ejecución global",
    valor: "47%",
    color: "#EC4899",
    ruta: ROUTES.PRESUPUESTOS,
  },
  {
    id: "proyectos",
    titulo: "Proyectos",
    subtitulo: "Iniciativas macro",
    valor: "3",
    color: "#8B5CF6",
    ruta: ROUTES.PROYECTOS,
  },
  {
    id: "reportes",
    titulo: "Reportes",
    subtitulo: "Métricas de impacto",
    valor: "—",
    color: "#6B7280",
  },
  {
    id: "jornadas",
    titulo: "Jornadas",
    subtitulo: "Kanban en tiempo real",
    valor: "1",
    color: "#10B981",
    tabMovil: "Jornadas",
  },
  {
    id: "colaboradores",
    titulo: "Colaboradores",
    subtitulo: "Personal registrado",
    valor: "10",
    color: "#0284C7",
    ruta: ROUTES.COLABORADORES,
  },
];

export default function InicioScreen({ navigation }) {
  const { perfil } = useSesionCompartida();
  const rol = perfil?.rol;

  const modulosCalculados =
    modulosVisibles(rol, { plataforma: "mobile" })?.filter((m) => m.id !== "inicio") || [];

  const modulosDisponibles = modulosCalculados.map((m) => {
    const base = MODULOS_FIGMA.find((f) => f.id === m.id) || {};
    return {
      id: m.id,
      titulo: m.etiqueta || base.titulo || m.id,
      subtitulo: base.subtitulo || "Módulo activo",
      valor: base.valor || "—",
      color: base.color || "#10B981",
      tabMovil: m.tabMovil || base.tabMovil,
      ruta: base.ruta,
    };
  });

  const tieneInventario = modulosCalculados.some((m) => m.id === "inventario");
  const tienePresupuestos = modulosCalculados.some((m) => m.id === "presupuestos");

  const navegarAModulo = (modulo) => {
    if (modulo.tabMovil) {
      navigation.navigate(modulo.tabMovil);
    } else if (modulo.ruta) {
      navigation.navigate(modulo.ruta);
    } else {
      const mapaRutas = {
        donaciones: ROUTES.DONACIONES,
        presupuestos: ROUTES.PRESUPUESTOS,
        proyectos: ROUTES.PROYECTOS,
        colaboradores: ROUTES.COLABORADORES,
      };
      if (mapaRutas[modulo.id]) {
        navigation.navigate(mapaRutas[modulo.id]);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* HERO BANNER */}
        <View style={styles.heroBanner}>
          <View style={styles.heroBadge}>
            <View style={styles.dot} />
            <Text style={styles.heroBadgeText}>SISTEMA ACTIVO • 2026</Text>
          </View>
          <Text style={styles.heroTitle}>Salud que llega a cada comunidad.</Text>
          <Text style={styles.heroDescription}>
            Plataforma integral de gestión para jornadas médicas. Pacientes, inventario, jornadas,
            colaboradores, proyectos y presupuestos en un solo lugar.
          </Text>
          <View style={styles.heroButtonsContainer}>
            {tieneInventario && (
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => navigation.navigate(ROUTES.TAB_INVENTARIO)}
              >
                <Text style={styles.btnPrimaryText}>Ver inventario</Text>
              </TouchableOpacity>
            )}
            {tienePresupuestos && (
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => navigation.navigate(ROUTES.PRESUPUESTOS)}
              >
                <Text style={styles.btnSecondaryText}>Ver presupuestos</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* MÓDULOS DEL SISTEMA */}
        <Text style={styles.sectionTitle}>MÓDULOS DEL SISTEMA</Text>
        <View style={styles.gridTwoColumns}>
          {modulosDisponibles.map((modulo) => (
            <TouchableOpacity
              key={modulo.id}
              style={styles.moduleCard}
              onPress={() => navegarAModulo(modulo)}
            >
              <View style={[styles.cardDot, { backgroundColor: modulo.color }]} />
              <Text style={styles.moduleTitle}>{modulo.titulo}</Text>
              <Text style={styles.cardSubtext}>{modulo.subtitulo}</Text>
              <Text style={[styles.moduleValue, { color: modulo.color }]}>{modulo.valor}</Text>
            </TouchableOpacity>
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
  gridTwoColumns: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
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
  moduleValue: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 8,
  },
});
