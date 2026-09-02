import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { useProyectosSociales } from "@ecopac/shared/proyectos";

export default function ProyectosScreen({ usuarioRol }) {
  const {
    cargando,
    error,
    proyectos,
    proyectoDetalle,
    jornadasProyecto,
    filtros,
    filtrosState,
    setFiltrosState,
    proyectoSeleccionadoId,
    setProyectoSeleccionadoId,
    tabActivo,
    setTabActivo,
    puedeEditar, // Permiso para crear/editar
  } = useProyectosSociales({ usuarioRol });

  const metricas = useMemo(() => {
    const registrados = proyectos.length;
    const activos = proyectos.filter(
      (p) => p.estado === "activo" || p.estado === "en_ejecucion",
    ).length;
    const beneficiariosTotal = proyectos.reduce((acc, p) => acc + (p.beneficiarios || 0), 0);
    const presupuestoTotal = proyectos.reduce((acc, p) => acc + (p.presupuesto || 0), 0);

    return { registrados, activos, beneficiariosTotal, presupuestoTotal };
  }, [proyectos]);

  if (cargando) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.cargandoTexto}>Cargando proyectos...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTexto}>Error al cargar proyectos: {String(error)}</Text>
      </View>
    );
  }

  // VISTA 2: Detalle del Proyecto Seleccionado
  if (proyectoDetalle) {
    const porcentaje = proyectoDetalle.porcentajeAvance ?? proyectoDetalle.avance ?? 0;

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity
            style={styles.botonVolver}
            onPress={() => setProyectoSeleccionadoId(null)}
          >
            <Text style={styles.botonVolverTexto}>← Volver a proyectos</Text>
          </TouchableOpacity>

          <View style={styles.cardDetalleHeader}>
            <View style={styles.badgesRow}>
              <View style={styles.badgeSector}>
                <Text style={styles.badgeSectorText}>
                  {proyectoDetalle.sector?.toUpperCase() || "SALUD"}
                </Text>
              </View>
              <View style={[styles.badgeEstado, styles.badgeActivo]}>
                <Text style={styles.badgeEstadoText}>
                  {proyectoDetalle.estado?.toUpperCase() || "ACTIVO"}
                </Text>
              </View>
            </View>

            <View style={styles.metricasDetalleHeader}>
              <View style={styles.metricaSubItem}>
                <Text style={styles.metricaNumeroVerde}>{proyectoDetalle.beneficiarios || 0}</Text>
                <Text style={styles.metricaLabelSub}>beneficiarios</Text>
              </View>
              <View style={styles.metricaSubItem}>
                <Text style={styles.metricaNumeroAzul}>{jornadasProyecto.length}</Text>
                <Text style={styles.metricaLabelSub}>jornadas</Text>
              </View>
            </View>

            <Text style={styles.tituloProyectoDetalle}>{proyectoDetalle.nombre}</Text>
            <Text style={styles.descripcionProyecto}>
              {proyectoDetalle.descripcion || "Sin descripción disponible."}
            </Text>

            <View style={styles.gridInfo}>
              <View style={styles.colInfo}>
                <Text style={styles.labelInfo}>RESPONSABLE</Text>
                <Text style={styles.valorInfo}>
                  {proyectoDetalle.responsableNombre || "No asignado"}
                </Text>
              </View>
              <View style={styles.colInfo}>
                <Text style={styles.labelInfo}>LUGAR</Text>
                <Text style={styles.valorInfo}>{proyectoDetalle.ubicacion || "Guatemala"}</Text>
              </View>
            </View>

            <View style={styles.gridInfo}>
              <View style={styles.colInfo}>
                <Text style={styles.labelInfo}>INICIO</Text>
                <Text style={styles.valorInfo}>{proyectoDetalle.fechaInicio || "—"}</Text>
              </View>
              <View style={styles.colInfo}>
                <Text style={styles.labelInfo}>CIERRE</Text>
                <Text style={styles.valorInfo}>{proyectoDetalle.fechaFin || "—"}</Text>
              </View>
            </View>

            <View style={styles.progresoSection}>
              <View style={styles.progresoHeaderRow}>
                <Text style={styles.ejecutadoTexto}>
                  Q {proyectoDetalle.ejecutado?.toLocaleString() || "0"} ejecutados
                </Text>
                <Text style={styles.porcentajeTexto}>{porcentaje}%</Text>
              </View>
              <View style={styles.barBackground}>
                <View
                  style={[styles.barFill, { width: `${Math.min(100, Math.max(0, porcentaje))}%` }]}
                />
              </View>
            </View>
          </View>

          <View style={styles.tabsContainer}>
            {["resumen", "equipo", "jornadas", "insumos", "gastos"].map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabButton, tabActivo === tab && styles.tabButtonActivo]}
                onPress={() => setTabActivo(tab)}
              >
                <Text style={[styles.tabTexto, tabActivo === tab && styles.tabTextoActivo]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {tabActivo === "resumen" && (
            <View>
              <View style={styles.cardSeccion}>
                <Text style={styles.subtituloSeccion}>🎯 Objetivos del proyecto</Text>
                {proyectoDetalle.objetivos?.length ? (
                  proyectoDetalle.objetivos.map((obj, i) => (
                    <Text key={i} style={styles.bulletItem}>
                      • {obj}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.bulletItem}>• Sin objetivos registrados</Text>
                )}
              </View>

              <View style={styles.cardSeccion}>
                <Text style={styles.subtituloSeccion}>✅ Logros al corte</Text>
                <Text style={styles.bulletItem}>
                  • {proyectoDetalle.beneficiarios || 0} pacientes atendidos al corte
                </Text>
                <Text style={styles.bulletItem}>
                  • {jornadasProyecto.length} jornadas completadas exitosamente
                </Text>
              </View>
            </View>
          )}

          {tabActivo === "jornadas" && (
            <View style={styles.cardSeccion}>
              <Text style={styles.subtituloSeccion}>📋 Jornadas asociadas</Text>
              {jornadasProyecto.length === 0 ? (
                <Text style={styles.bulletItem}>No hay jornadas registradas.</Text>
              ) : (
                jornadasProyecto.map((j) => (
                  <View key={j.id} style={styles.jornadaItem}>
                    <Text style={styles.jornadaTitulo}>{j.nombre || j.titulo}</Text>
                    <Text style={styles.jornadaSub}>
                      {j.fecha} — {j.lugar || "Sin lugar"}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // VISTA 1: Listado Principal de Proyectos
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header con título y Botón "+ Nuevo proyecto" condicional */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.tituloHeader}>Gestión de Proyectos</Text>
            <Text style={styles.subtituloHeader}>Módulo administrador macro</Text>
          </View>

          {puedeEditar && (
            <TouchableOpacity
              style={styles.botonNuevo}
              onPress={() => {
                // Aquí se puede abrir el modal o navegar a la pantalla de creación
                console.log("Abrir formulario de nuevo proyecto");
              }}
            >
              <Text style={styles.botonNuevoTexto}>+ Nuevo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tarjetas de Métricas Resumen */}
        <View style={styles.gridMetricas}>
          <View style={styles.cardMetrica}>
            <Text style={styles.metricaHeaderLabel}>PROYECTOS</Text>
            <Text style={[styles.metricaNumero, { color: "#22c55e" }]}>{metricas.registrados}</Text>
            <Text style={styles.metricaSub}>registrados</Text>
          </View>

          <View style={styles.cardMetrica}>
            <Text style={styles.metricaHeaderLabel}>EN EJECUCIÓN</Text>
            <Text style={[styles.metricaNumero, { color: "#0284c7" }]}>{metricas.activos}</Text>
            <Text style={styles.metricaSub}>activos</Text>
          </View>

          <View style={styles.cardMetrica}>
            <Text style={styles.metricaHeaderLabel}>PRESUPUESTO TOTAL</Text>
            <Text style={[styles.metricaNumero, { color: "#ea580c", fontSize: 18 }]}>
              Q {metricas.presupuestoTotal.toLocaleString()}
            </Text>
            <Text style={styles.metricaSub}>todos los proyectos</Text>
          </View>

          <View style={styles.cardMetrica}>
            <Text style={styles.metricaHeaderLabel}>BENEFICIARIOS</Text>
            <Text style={[styles.metricaNumero, { color: "#db2777" }]}>
              {metricas.beneficiariosTotal}
            </Text>
            <Text style={styles.metricaSub}>personas impactadas</Text>
          </View>
        </View>

        {/* Chips de Filtro */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          <TouchableOpacity
            style={[styles.chip, !filtrosState.estado && styles.chipActivo]}
            onPress={() => setFiltrosState((prev) => ({ ...prev, estado: "" }))}
          >
            <Text style={[styles.chipTexto, !filtrosState.estado && styles.chipTextoActivo]}>
              Todos
            </Text>
          </TouchableOpacity>

          {filtros
            ?.find((f) => f.id === "estado")
            ?.opciones?.map((opcion) => {
              const seleccionado = filtrosState.estado === opcion.value;
              return (
                <TouchableOpacity
                  key={opcion.value}
                  style={[styles.chip, seleccionado && styles.chipActivo]}
                  onPress={() =>
                    setFiltrosState((prev) => ({
                      ...prev,
                      estado: seleccionado ? "" : opcion.value,
                    }))
                  }
                >
                  <Text style={[styles.chipTexto, seleccionado && styles.chipTextoActivo]}>
                    {opcion.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </ScrollView>

        <Text style={styles.seccionTitulo}>{proyectos.length} PROYECTOS</Text>

        {/* Listado de Tarjetas */}
        {proyectos.map((proyecto) => {
          const avance = proyecto.porcentajeAvance ?? proyecto.avance ?? 0;

          return (
            <TouchableOpacity
              key={proyecto.id}
              style={styles.cardProyecto}
              onPress={() => setProyectoSeleccionadoId(proyecto.id)}
            >
              <Text style={styles.cardTitulo}>{proyecto.nombre}</Text>
              <Text style={styles.cardSubtitulo}>
                {proyecto.sector || "General"} — {proyecto.ubicacion || "Guatemala"}
              </Text>

              <View style={styles.cardFooter}>
                <View style={styles.badgeEstado}>
                  <Text style={styles.badgeTexto}>{proyecto.estado || "activo"}</Text>
                </View>
                <Text style={styles.porcentajeVal}>{avance}%</Text>
              </View>

              <View style={styles.barBackground}>
                <View
                  style={[styles.barFill, { width: `${Math.min(100, Math.max(0, avance))}%` }]}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  cargandoTexto: { marginTop: 12, color: "#64748b" },
  errorTexto: { color: "#ef4444", padding: 16, textAlign: "center" },
  scrollContent: { padding: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitleContainer: { flex: 1 },
  tituloHeader: { fontSize: 22, fontWeight: "bold", color: "#0f172a" },
  subtituloHeader: { fontSize: 13, color: "#64748b" },
  botonNuevo: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  botonNuevoTexto: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  gridMetricas: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cardMetrica: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  metricaHeaderLabel: { fontSize: 10, fontWeight: "600", color: "#64748b" },
  metricaNumero: { fontSize: 24, fontWeight: "bold", marginVertical: 4 },
  metricaSub: { fontSize: 10, color: "#94a3b8" },
  chipsScroll: { marginBottom: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#e2e8f0",
    marginRight: 8,
  },
  chipActivo: { backgroundColor: "#22c55e" },
  chipTexto: { fontSize: 12, color: "#475569" },
  chipTextoActivo: { color: "#fff", fontWeight: "bold" },
  seccionTitulo: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#64748b",
    marginBottom: 8,
  },
  cardProyecto: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitulo: { fontSize: 16, fontWeight: "bold", color: "#0f172a" },
  cardSubtitulo: { fontSize: 12, color: "#64748b", marginBottom: 12 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badgeEstado: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeTexto: { fontSize: 10, color: "#166534", fontWeight: "bold" },
  porcentajeVal: { fontSize: 12, fontWeight: "bold", color: "#22c55e" },
  barBackground: {
    height: 6,
    backgroundColor: "#f1f5f9",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: "#22c55e" },
  botonVolver: { marginBottom: 12 },
  botonVolverTexto: { color: "#22c55e", fontWeight: "bold", fontSize: 14 },
  cardDetalleHeader: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  badgesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  badgeSector: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeSectorText: { fontSize: 10, fontWeight: "bold", color: "#475569" },
  badgeActivo: { backgroundColor: "#dcfce7" },
  badgeEstadoText: { fontSize: 10, fontWeight: "bold", color: "#166534" },
  metricasDetalleHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
    marginBottom: 8,
  },
  metricaSubItem: { alignItems: "center" },
  metricaNumeroVerde: { fontSize: 18, fontWeight: "bold", color: "#22c55e" },
  metricaNumeroAzul: { fontSize: 18, fontWeight: "bold", color: "#0284c7" },
  metricaLabelSub: { fontSize: 9, color: "#64748b" },
  tituloProyectoDetalle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 4,
  },
  descripcionProyecto: { fontSize: 12, color: "#64748b", marginBottom: 16 },
  gridInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  colInfo: { width: "48%" },
  labelInfo: { fontSize: 9, color: "#94a3b8", fontWeight: "bold" },
  valorInfo: { fontSize: 13, color: "#0f172a", fontWeight: "500" },
  progresoSection: { marginTop: 8 },
  progresoHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  ejecutadoTexto: { fontSize: 11, color: "#64748b" },
  porcentajeTexto: { fontSize: 11, fontWeight: "bold", color: "#22c55e" },
  tabsContainer: {
    flexDirection: "row",
    marginBottom: 16,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    padding: 2,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  tabButtonActivo: { backgroundColor: "#22c55e" },
  tabTexto: { fontSize: 11, color: "#64748b" },
  tabTextoActivo: { color: "#fff", fontWeight: "bold" },
  cardSeccion: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  subtituloSeccion: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 8,
  },
  bulletItem: { fontSize: 12, color: "#475569", marginBottom: 4 },
  jornadaItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  jornadaTitulo: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  jornadaSub: { fontSize: 11, color: "#64748b" },
});
