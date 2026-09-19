import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ESTADOS_PROYECTO,
  ETIQUETAS_ESTADO_PROYECTO,
  formatearMoneda,
  transicionesDeProyectoDesde,
} from "@ecopac/shared";
import { useProyectosSociales } from "@ecopac/shared/proyectos";
import { obtenerPresupuestoProyecto } from "@ecopac/shared/presupuestos";
import Card from "../components/Card";
import KanbanBoard from "../components/KanbanBoard";
import EmptyState from "../components/EmptyState";
import AccesoDenegadoScreen from "./AccesoDenegadoScreen";
import ModalProyecto from "./ModalProyecto";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

// issue #688: esta pantalla nunca mostraba un proyecto real, para ningun rol. Tres defectos
// encadenados, el primero tapaba a los otros dos:
//
// 1. useProyectosSociales() se llamaba sin { usuarioRol }, asi que puedeVerProyectos(undefined)
// era false y el hook devolvia [] sin llegar a consultar.
// 2. Con la lista vacia, la pantalla caia a PROYECTOS_DEMO (tres proyectos inventados) en vez de
// pintar el estado vacio real.
// 3. ETAPAS_KANBAN usaba "en_ejecucion"/"completado", que no existen en el enum estado_proyecto
// (00007): con datos reales la metrica "activos" salia siempre 0 y las columnas del kanban
// quedaban vacias aunque hubiera proyectos.
//
// Los tres se corrigen juntos: se pasa el rol real, se retira el dato demo (EmptyState/
// AccesoDenegadoScreen en su lugar), y las etapas salen de ESTADOS_PROYECTO/
// ETIQUETAS_ESTADO_PROYECTO. proyectos.presupuesto y .beneficiarios tampoco eran columnas reales
// -la tabla tiene porcentaje_avance, no beneficiarios, y el presupuesto se calcula aparte con
// obtenerPresupuestoProyecto()-: el presupuesto se completa por proyecto (mismo patron N+1 que
// useEjecucionPresupuestal.js ya usa para esto mismo) y la metrica de beneficiarios se retira, sin
// dato real que mostrar.
const ETAPAS_KANBAN = Object.values(ESTADOS_PROYECTO).map((estado) => ({
  id: estado,
  titulo: ETIQUETAS_ESTADO_PROYECTO[estado],
}));

const FILTROS_ESTADO = [
  { id: "todos", label: "Todos" },
  ...Object.values(ESTADOS_PROYECTO).map((estado) => ({
    id: estado,
    label: ETIQUETAS_ESTADO_PROYECTO[estado],
  })),
];

export default function ProyectosScreen() {
  const { rol } = useSesionCompartida();
  const {
    proyectos: proyectosBD,
    catalogos,
    cargando,
    tieneAccesoLectura,
    puedeEditar,
    cambiarEtapaProyecto,
    guardarProyecto,
  } = useProyectosSociales({ usuarioRol: rol });

  const [modoVista, setModoVista] = useState("kanban"); // "lista" | "kanban"
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [presupuestosPorProyecto, setPresupuestosPorProyecto] = useState({});
  const [formularioAbierto, setFormularioAbierto] = useState(false);

  // presupuesto_de_proyecto (00040) toma un solo id: no hay version que liste todos de una vez,
  // asi que se completa uno por uno en paralelo. A la escala de proyectos de esta ONG el costo es
  // aceptable (mismo criterio que useEjecucionPresupuestal.js).
  useEffect(() => {
    let vigente = true;

    if (!Array.isArray(proyectosBD) || proyectosBD.length === 0) {
      setPresupuestosPorProyecto({});
      return () => {
        vigente = false;
      };
    }

    Promise.all(
      proyectosBD.map((p) =>
        obtenerPresupuestoProyecto(p.id).then(({ presupuesto }) => [
          p.id,
          presupuesto?.asignado ?? 0,
        ]),
      ),
    ).then((entradas) => {
      if (vigente) setPresupuestosPorProyecto(Object.fromEntries(entradas));
    });

    return () => {
      vigente = false;
    };
  }, [proyectosBD]);

  const proyectos = useMemo(
    () =>
      (proyectosBD ?? []).map((p) => ({
        ...p,
        presupuesto: presupuestosPorProyecto[p.id] ?? 0,
      })),
    [proyectosBD, presupuestosPorProyecto],
  );

  // Cálculos para métricas
  const metricas = useMemo(() => {
    const total = proyectos.length;
    const activos = proyectos.filter((p) => p.estado === ESTADOS_PROYECTO.EN_CURSO).length;
    const presupuestoTotal = proyectos.reduce((acc, p) => acc + (Number(p.presupuesto) || 0), 0);

    return { total, activos, presupuestoTotal };
  }, [proyectos]);

  // Filtrado para la vista en lista
  const proyectosFiltrados = useMemo(() => {
    if (filtroEstado === "todos") return proyectos;
    return proyectos.filter((p) => p.estado === filtroEstado);
  }, [proyectos, filtroEstado]);

  const handleCambiarEtapa = async (proyectoId, nuevoEstado) => {
    if (cambiarEtapaProyecto) {
      await cambiarEtapaProyecto(proyectoId, nuevoEstado);
    }
  };

  if (!tieneAccesoLectura) {
    return <AccesoDenegadoScreen />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Encabezado */}
        <View style={styles.header}>
          <View>
            <Text style={styles.titulo}>Gestión de Proyectos</Text>
            <Text style={styles.subtitulo}>Módulo administrador macro</Text>
          </View>
          <View style={styles.headerAcciones}>
            {puedeEditar && (
              <TouchableOpacity style={styles.toggleBtn} onPress={() => setFormularioAbierto(true)}>
                <Text style={styles.toggleBtnText}>+ Nuevo</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.toggleBtn}
              onPress={() => setModoVista(modoVista === "lista" ? "kanban" : "lista")}
            >
              <Text style={styles.toggleBtnText}>{modoVista === "lista" ? "Kanban" : "Lista"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tarjetas de Métricas */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>PROYECTOS</Text>
            <Text style={[styles.metricValue, { color: colors.primary }]}>{metricas.total}</Text>
            <Text style={styles.metricSub}>registrados</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>EN CURSO</Text>
            <Text style={[styles.metricValue, { color: colors.info }]}>{metricas.activos}</Text>
            <Text style={styles.metricSub}>activos</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>PRESUPUESTO TOTAL</Text>
            <Text style={[styles.metricValue, { color: colors.warning }]}>
              Q {metricas.presupuestoTotal.toLocaleString()}
            </Text>
            <Text style={styles.metricSub}>todos los proyectos</Text>
          </View>
        </View>

        {cargando ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
        ) : proyectos.length === 0 ? (
          <EmptyState message="Todavía no hay proyectos registrados." />
        ) : modoVista === "kanban" ? (
          // El tablero tiene el contrato del de web desde la #840 (columnas, renderTarjeta,
          // onMover): la tarjeta la dibuja esta pantalla, y el tablero solo ofrece mover a las
          // etapas que TRANSICIONES_PROYECTO permite.
          <KanbanBoard
            columnas={ETAPAS_KANBAN.map((etapa) => ({
              ...etapa,
              tarjetas: proyectos.filter((p) => p.estado === etapa.id),
            }))}
            destinosDe={(proyecto) => transicionesDeProyectoDesde(proyecto.estado)}
            onMover={puedeEditar ? (id, _origen, destino) => handleCambiarEtapa(id, destino) : null}
            mensajeVacio="Sin proyectos"
            renderTarjeta={(p) => (
              <Card>
                <Text style={styles.kanbanNombre}>{p.nombre}</Text>
                {p.descripcion ? (
                  <Text style={styles.kanbanDetalle} numberOfLines={2}>
                    {p.descripcion}
                  </Text>
                ) : null}
                <Text style={styles.kanbanDetalle}>{formatearMoneda(p.presupuesto) ?? "—"}</Text>
              </Card>
            )}
          />
        ) : (
          <View>
            {/* Filtros de la Lista */}
            <View style={styles.filterRow}>
              {FILTROS_ESTADO.map((f) => (
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

            {proyectosFiltrados.length === 0 ? (
              <Text style={styles.emptyText}>No hay proyectos registrados en este estado.</Text>
            ) : (
              proyectosFiltrados.map((item) => (
                <View key={item.id} style={styles.projectCard}>
                  <Text style={styles.projectTitle}>{item.nombre}</Text>
                  {item.descripcion && <Text style={styles.projectDesc}>{item.descripcion}</Text>}
                  <View style={styles.projectFooter}>
                    <Text style={styles.badgeText}>
                      Etapa: {ETIQUETAS_ESTADO_PROYECTO[item.estado] || item.estado}
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

      <ModalProyecto
        visible={formularioAbierto}
        proyecto={null}
        catalogos={catalogos}
        onClose={() => setFormularioAbierto(false)}
        onGuardar={guardarProyecto}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  kanbanNombre: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  kanbanDetalle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.text,
  },
  subtitulo: {
    fontSize: 13,
    color: colors.textMuted,
  },
  headerAcciones: {
    flexDirection: "row",
    gap: 8,
  },
  toggleBtn: {
    backgroundColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  metricCard: {
    width: "48%",
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  metricSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  filterChipTextActive: {
    color: colors.surface,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: 12,
  },
  projectCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  projectTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  projectDesc: {
    fontSize: 13,
    color: colors.textMuted,
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
    color: colors.info,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  budgetBadge: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  emptyText: {
    textAlign: "center",
    color: colors.textMuted,
    marginTop: 20,
  },
});
