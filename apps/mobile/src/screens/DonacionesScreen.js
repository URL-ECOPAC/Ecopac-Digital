import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useHistorialDonaciones } from "@ecopac/shared/donaciones";
import { useUsuarioActivo } from "../contexto/UsuarioActivoContext";
import { ScreenContainer, PageHeader, Card, LoadingState, ErrorState } from "../components";

export function DonacionesScreen() {
  const { usuario } = useUsuarioActivo();
  const rol = usuario?.rol;

  const { tieneAccesoLectura, cargando, error, donaciones, totalesPorTipo, recargar } =
    useHistorialDonaciones({ usuarioRol: rol });

  if (!tieneAccesoLectura) {
    return (
      <ScreenContainer testID="donaciones-screen-no-acceso">
        <PageHeader titulo="Donaciones" subtitulo="Resumen y KPIs" />
        <ErrorState
          titulo="Acceso denegado"
          mensaje="No tienes permisos para consultar la información del módulo de donaciones."
        />
      </ScreenContainer>
    );
  }

  if (cargando) {
    return (
      <ScreenContainer testID="donaciones-screen-cargando">
        <PageHeader titulo="Donaciones" subtitulo="Resumen y KPIs" />
        <LoadingState mensaje="Cargando resumen de donaciones..." />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer testID="donaciones-screen-error">
        <PageHeader titulo="Donaciones" subtitulo="Resumen y KPIs" />
        <ErrorState
          titulo="Error al cargar datos"
          mensaje={error.message || "No se pudo obtener el resumen de donaciones."}
          onRetry={recargar}
        />
      </ScreenContainer>
    );
  }

  // Cálculos de KPIs basados en donaciones retornadas por el hook de shared
  const donacionesConfirmadas = donaciones.filter(
    (d) => d.estado === "confirmada" || !d.estado,
  ).length;

  const donantesUnicos = new Set(
    donaciones.map((d) => d.donanteId || d.donanteNombre).filter(Boolean),
  ).size;

  const formatearQuetzales = (monto) =>
    `Q. ${(monto || 0).toLocaleString("es-GT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <ScreenContainer testID="donaciones-screen">
      <ScrollView contentContainerStyle={styles.container}>
        <PageHeader titulo="Donaciones" subtitulo="Resumen y KPIs del Período" />

        {/* Sección de KPIs Principales */}
        <View style={styles.kpiGrid}>
          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Recibido</Text>
            <Text style={styles.kpiValue}>{formatearQuetzales(totalesPorTipo.dinero)}</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Donaciones Confirmadas</Text>
            <Text style={styles.kpiValue}>{donacionesConfirmadas}</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>No. Donantes</Text>
            <Text style={styles.kpiValue}>{donantesUnicos}</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Monto Pendiente</Text>
            <Text style={styles.kpiValue}>{formatearQuetzales(0)}</Text>
          </Card>
        </View>

        {/* Sección de Desglose por Tipo */}
        <Text style={styles.sectionTitle}>Desglose de Especies e Insumos</Text>
        <View style={styles.desgloseGrid}>
          <Card style={styles.desgloseCard}>
            <Text style={styles.kpiLabel}>Medicamentos</Text>
            <Text style={styles.desgloseValue}>{totalesPorTipo.medicamentos || 0} ítems</Text>
          </Card>

          <Card style={styles.desgloseCard}>
            <Text style={styles.kpiLabel}>Insumos</Text>
            <Text style={styles.desgloseValue}>{totalesPorTipo.insumos || 0} ítems</Text>
          </Card>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    minWidth: "45%",
    padding: 16,
  },
  kpiLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
    fontWeight: "500",
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginTop: 8,
  },
  desgloseGrid: {
    flexDirection: "row",
    gap: 12,
  },
  desgloseCard: {
    flex: 1,
    padding: 16,
  },
  desgloseValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#059669",
  },
});
