import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useProyectosSociales } from "@ecopac/shared/proyectos";
import KanbanBoard from "../components/KanbanBoard";

const ETAPAS_KANBAN = [
  { id: "planificacion", titulo: "Planificación" },
  { id: "en_ejecucion", titulo: "En Ejecución" },
  { id: "completado", titulo: "Completado" },
  { id: "cancelado", titulo: "Cancelado" },
];

// Datos de prueba en caso de no haber conexión o registros en Supabase
const PROYECTOS_DEMO = [
  {
    id: "demo-1",
    nombre: "Jornada Odontológica Escolar",
    descripcion: "Atención preventiva a niños de escuelas primarias rurales.",
    estado: "en_ejecucion",
    etapa: "en_ejecucion",
    presupuesto: 15000,
    beneficiarios: 450,
  },
  {
    id: "demo-2",
    nombre: "Entrega de Kits Odontológicos",
    descripcion: "Distribución de cepillos y crema dental en la comunidad.",
    estado: "planificacion",
    etapa: "planificacion",
    presupuesto: 8000,
    beneficiarios: 200,
  },
  {
    id: "demo-3",
    nombre: "Capacitación de Higiene Oral",
    descripcion: "Talleres educativos para padres y docentes.",
    estado: "completado",
    etapa: "completado",
    presupuesto: 5000,
    beneficiarios: 120,
  },
];

export default function ProyectosScreen() {
  const { proyectos: proyectosBD, cargando, cambiarEtapaProyecto } = useProyectosSociales();

  const [modoVista, setModoVista] = useState("kanban"); // "lista" | "kanban"
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [proyectosDemoState, setProyectosDemoState] = useState(PROYECTOS_DEMO);

  // Garantiza que siempre sea un arreglo válido (evita undefined)
  const proyectos = useMemo(() => {
    if (Array.isArray(proyectosBD) && proyectosBD.length > 0) {
      return proyectosBD;
    }
    return proyectosDemoState || [];
  }, [proyectosBD, proyectosDemoState]);

  // Cálculos para métricas
  const metricas = useMemo(() => {
    const lista = proyectos || [];
    const total = lista.length;
    const activos = lista.filter((p) => (p.estado || p.etapa) === "en_ejecucion").length;
    const presupuestoTotal = lista.reduce((acc, p) => acc + (Number(p.presupuesto) || 0), 0);
    const beneficiariosTotal = lista.reduce((acc, p) => acc + (Number(p.beneficiarios) || 0), 0);

    return { total, activos, presupuestoTotal, beneficiariosTotal };
  }, [proyectos]);

  // Filtrado para la vista en lista
  const proyectosFiltrados = useMemo(() => {
    const lista = proyectos || [];
    if (filtroEstado === "todos") return lista;
    return lista.filter((p) => (p.estado || p.etapa) === filtroEstado);
  }, [proyectos, filtroEstado]);

  // Manejador para mover etapas
  const handleCambiarEtapa = async (proyectoId, nuevaEtapa) => {
    if (proyectoId.startsWith("demo-")) {
      // Si es un proyecto local de prueba, actualizamos el estado
      setProyectosDemoState((prev) =>
        prev.map((p) =>
          p.id === proyectoId ? { ...p, etapa: nuevaEtapa, estado: nuevaEtapa } : p,
        ),
      );
      return;
    }

    if (cambiarEtapaProyecto) {
      await cambiarEtapaProyecto(proyectoId, nuevaEtapa);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Encabezado */}
        <View style={styles.header}>
          <View>
            <Text style={styles.titulo}>Gestión de Proyectos</Text>
            <Text style={styles.subtitulo}>Módulo administrador macro</Text>
          </View>
          <TouchableOpacity
            style={styles.toggleBtn}
            onPress={() => setModoVista(modoVista === "lista" ? "kanban" : "lista")}
          >
            <Text style={styles.toggleBtnText}>
              {modoVista === "lista" ? "📊 Kanban" : "📋 Lista"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tarjetas de Métricas */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>PROYECTOS</Text>
            <Text style={[styles.metricValue, { color: "#10B981" }]}>{metricas.total}</Text>
            <Text style={styles.metricSub}>registrados</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>EN EJECUCIÓN</Text>
            <Text style={[styles.metricValue, { color: "#0284C7" }]}>{metricas.activos}</Text>
            <Text style={styles.metricSub}>activos</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>PRESUPUESTO TOTAL</Text>
            <Text style={[styles.metricValue, { color: "#EA580C" }]}>
              Q {metricas.presupuestoTotal.toLocaleString()}
            </Text>
            <Text style={styles.metricSub}>todos los proyectos</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>BENEFICIARIOS</Text>
            <Text style={[styles.metricValue, { color: "#DB2777" }]}>
              {metricas.beneficiariosTotal.toLocaleString()}
            </Text>
            <Text style={styles.metricSub}>personas impactadas</Text>
          </View>
        </View>

        {/* Vista Kanban vs Vista Lista */}
        {modoVista === "kanban" ? (
          <KanbanBoard
            proyectos={proyectos}
            etapas={ETAPAS_KANBAN}
            onCambiarEtapa={handleCambiarEtapa}
          />
        ) : (
          <View>
            {/* Filtros de la Lista */}
            <View style={styles.filterRow}>
              {[
                { id: "todos", label: "Todos" },
                { id: "planificacion", label: "Planificado" },
                { id: "en_ejecucion", label: "En curso" },
                { id: "completado", label: "Finalizado" },
              ].map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.filterChip, filtroEstado === f.id && styles.filterChipActive]}
                  onPress={() => setFiltroEstado(f.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filtroEstado === f.id && styles.filterChipTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>{proyectosFiltrados.length} PROYECTOS</Text>

            {cargando ? (
              <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 24 }} />
            ) : proyectosFiltrados.length === 0 ? (
              <Text style={styles.emptyText}>No hay proyectos registrados en este estado.</Text>
            ) : (
              proyectosFiltrados.map((item) => (
                <View key={item.id} style={styles.projectCard}>
                  <Text style={styles.projectTitle}>{item.nombre}</Text>
                  {item.descripcion && <Text style={styles.projectDesc}>{item.descripcion}</Text>}
                  <View style={styles.projectFooter}>
                    <Text style={styles.badgeText}>
                      Etapa: {item.etapa || item.estado || "planificacion"}
                    </Text>
                    <Text style={styles.budgetBadge}>
                      Q {Number(item.presupuesto || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
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
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  titulo: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitulo: {
    fontSize: 13,
    color: "#64748B",
  },
  toggleBtn: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  metricCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  metricSub: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#E2E8F0",
  },
  filterChipActive: {
    backgroundColor: "#10B981",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 12,
  },
  projectCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  projectTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  projectDesc: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 12,
  },
  projectFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0284C7",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  budgetBadge: {
    fontSize: 13,
    fontWeight: "700",
    color: "#15803D",
  },
  emptyText: {
    textAlign: "center",
    color: "#94A3B8",
    marginTop: 20,
  },
});
