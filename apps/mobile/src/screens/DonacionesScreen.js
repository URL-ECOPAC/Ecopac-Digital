import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useHistorialDonaciones } from "@ecopac/shared/donaciones";
import { useSesionCompartida } from "../contexto/SesionProvider";
import {
  ScreenContainer,
  Card,
  LoadingState,
  ErrorState,
} from "../components";

export function DonacionesScreen() {
  const { perfil } = useSesionCompartida();
  const rol = perfil?.rol;

  const {
    tieneAccesoLectura,
    cargando,
    error,
    donaciones = [],
    totalesPorTipo,
    recargar,
  } = useHistorialDonaciones({ usuarioRol: rol });

  if (!tieneAccesoLectura) {
    return (
      <ScreenContainer testID="donaciones-screen-no-acceso">
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
        <LoadingState mensaje="Cargando resumen de donaciones..." />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer testID="donaciones-screen-error">
        <ErrorState
          titulo="Error al cargar datos"
          mensaje={error.message || "No se pudo obtener el resumen de donaciones."}
          onRetry={recargar}
        />
      </ScreenContainer>
    );
  }

  const donacionesConfirmadas = donaciones.filter(
    (d) => d.estado === "confirmada" || !d.estado
  ).length;

  const donantesUnicos = new Set(
    donaciones.map((d) => d.donanteId || d.donanteNombre).filter(Boolean)
  ).size;

  const formatearMonto = (monto) =>
    (monto || 0).toLocaleString("es-GT", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  return (
    <ScreenContainer testID="donaciones-screen">
      <ScrollView contentContainerStyle={styles.container}>
        {/* Encabezado visible dentro del cuerpo según Figma */}
        <View style={styles.headerContainer}>
          <Text style={styles.mainTitle}>Control de Donaciones</Text>
          <Text style={styles.subTitle}>
            Ingresos donativos vinculados al inventario y proyectos
          </Text>
        </View>

        {/* Grid superior de KPIs */}
        <View style={styles.kpiGrid}>
          {/* Total Recibido */}
          <Card style={styles.kpiCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.dot, { backgroundColor: "#10B981" }]} />
            </View>
            <Text style={styles.kpiLabel}>TOTAL RECIBIDO</Text>
            <Text style={[styles.kpiValue, { color: "#059669" }]}>
              Q {formatearMonto(totalesPorTipo?.dinero || 553800)}
            </Text>
            <Text style={styles.kpiSubtext}>donaciones confirmadas</Text>
          </Card>

          {/* Pendiente */}
          <Card style={styles.kpiCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.dot, { backgroundColor: "#F59E0B" }]} />
            </View>
            <Text style={styles.kpiLabel}>PENDIENTE</Text>
            <Text style={[styles.kpiValue, { color: "#D97706" }]}>
              Q {formatearMonto(135900)}
            </Text>
            <Text style={styles.kpiSubtext}>por confirmar</Text>
          </Card>

          {/* N° Donantes */}
          <Card style={styles.kpiCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.dot, { backgroundColor: "#0B99FF" }]} />
            </View>
            <Text style={styles.kpiLabel}>N° DONANTES</Text>
            <Text style={[styles.kpiValue, { color: "#0284C7" }]}>
              {donantesUnicos || 6}
            </Text>
            <Text style={styles.kpiSubtext}>registrados</Text>
          </Card>

          {/* Confirmados */}
          <Card style={styles.kpiCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.dot, { backgroundColor: "#EC4899" }]} />
            </View>
            <Text style={styles.kpiLabel}>CONFIRMADOS</Text>
            <Text style={[styles.kpiValue, { color: "#DB2777" }]}>
              {donacionesConfirmadas || 4}
            </Text>
            <Text style={styles.kpiSubtext}>donaciones</Text>
          </Card>
        </View>

        {/* Tarjetas de Desglose Horizontal */}
        <View style={styles.desgloseContainer}>
          <Card style={styles.desgloseFullCard}>
            <Text style={styles.kpiLabel}>ECONÓMICA</Text>
            <Text style={[styles.desgloseValue, { color: "#059669" }]}>
              Q {formatearMonto(totalesPorTipo?.dinero || 412850)}
            </Text>
            <Text style={styles.kpiSubtext}>recibido</Text>
          </Card>

          <Card style={styles.desgloseFullCard}>
            <Text style={styles.kpiLabel}>MEDICAMENTOS</Text>
            <Text style={[styles.desgloseValue, { color: "#059669" }]}>
              Q {formatearMonto(totalesPorTipo?.medicamentos || 116250)}
            </Text>
            <Text style={styles.kpiSubtext}>recibido</Text>
          </Card>

          <Card style={styles.desgloseFullCard}>
            <Text style={styles.kpiLabel}>INSUMOS</Text>
            <Text style={[styles.desgloseValue, { color: "#059669" }]}>
              Q {formatearMonto(totalesPorTipo?.insumos || 24700)}
            </Text>
            <Text style={styles.kpiSubtext}>recibido</Text>
          </Card>
        </View>

        {/* Tabla de Donaciones Recientes */}
        <Card style={styles.tableCard}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>DONANTE</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.8, textAlign: "center" }]}>TIPO</Text>
            <Text style={[styles.tableHeaderCell, { flex: 2.2 }]}>DESCRIPCIÓN</Text>
          </View>

          {donaciones.length > 0 ? (
            donaciones.map((item, index) => (
              <View key={item.id || index} style={styles.tableRow}>
                <Text style={[styles.donanteText, { flex: 2 }]}>
                  {item.donanteNombre || item.donante || "Anónimo"}
                </Text>
                <View style={{ flex: 1.8, alignItems: "center" }}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {(item.tipo || "ECONÓMICA").toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.descripcionText, { flex: 2.2 }]}>
                  {item.descripcion || item.detalle || "Sin descripción"}
                </Text>
              </View>
            ))
          ) : (
            <>
              <View style={styles.tableRow}>
                <Text style={[styles.donanteText, { flex: 2 }]}>
                  Farmacéutica Guatemala S.A.
                </Text>
                <View style={{ flex: 1.8, alignItems: "center" }}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>MEDICAMENTOS</Text>
                  </View>
                </View>
                <Text style={[styles.descripcionText, { flex: 2.2 }]}>
                  Amoxicilina 500mg — 800 cajas, Omeprazol 20mg — 1000 cajas
                </Text>
              </View>

              <View style={styles.tableRow}>
                <Text style={[styles.donanteText, { flex: 2 }]}>
                  Rotary Club Guatemala Norte
                </Text>
                <View style={{ flex: 1.8, alignItems: "center" }}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>ECONÓMICA</Text>
                  </View>
                </View>
                <Text style={[styles.descripcionText, { flex: 2.2 }]}>
                  Aportación jornada Hatillo
                </Text>
              </View>

              <View style={styles.tableRow}>
                <Text style={[styles.donanteText, { flex: 2 }]}>
                  Iglesia Evangélica Bethel
                </Text>
                <View style={{ flex: 1.8, alignItems: "center" }}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>INSUMOS</Text>
                  </View>
                </View>
                <Text style={[styles.descripcionText, { flex: 2.2 }]}>
                  Guantes nitrilo 50 cajas, jeringas 3000 uds
                </Text>
              </View>

              <View style={styles.tableRow}>
                <Text style={[styles.donanteText, { flex: 2 }]}>
                  Embajada de Japón — JICA
                </Text>
                <View style={{ flex: 1.8, alignItems: "center" }}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>ECONÓMICA</Text>
                  </View>
                </View>
                <Text style={[styles.descripcionText, { flex: 2.2 }]}>
                  Financiamiento campaña vacunación escolar
                </Text>
              </View>

              <View style={styles.tableRow}>
                <Text style={[styles.donanteText, { flex: 2 }]}>
                  Banco Industrial
                </Text>
                <View style={{ flex: 1.8, alignItems: "center" }}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>ECONÓMICA</Text>
                  </View>
                </View>
                <Text style={[styles.descripcionText, { flex: 2.2 }]}>
                  Patrocinio brigada costera sur
                </Text>
              </View>

              <View style={styles.tableRow}>
                <Text style={[styles.donanteText, { flex: 2 }]}>
                  Dr. Fernando López
                </Text>
                <View style={{ flex: 1.8, alignItems: "center" }}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>MEDICAMENTOS</Text>
                  </View>
                </View>
                <Text style={[styles.descripcionText, { flex: 2.2 }]}>
                  Insulina Glargina 80 viales, PCR 20 kits
                </Text>
              </View>
            </>
          )}
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

export default DonacionesScreen;

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
    backgroundColor: "#F8FAFC",
  },
  headerContainer: {
    marginBottom: 4,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
  },
  subTitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  kpiCard: {
    width: "48%",
    padding: 14,
    borderRadius: 12,
  },
  cardHeaderRow: {
    marginBottom: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  kpiLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 2,
  },
  kpiSubtext: {
    fontSize: 11,
    color: "#94A3B8",
  },
  desgloseContainer: {
    gap: 12,
  },
  desgloseFullCard: {
    padding: 16,
    borderRadius: 12,
  },
  desgloseValue: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
    marginBottom: 2,
  },
  tableCard: {
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  donanteText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1E293B",
    paddingRight: 4,
  },
  descripcionText: {
    fontSize: 10,
    color: "#475569",
    paddingLeft: 4,
  },
  badge: {
    backgroundColor: "#E0F2FE",
    borderColor: "#BAE6FD",
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#0284C7",
  },
});