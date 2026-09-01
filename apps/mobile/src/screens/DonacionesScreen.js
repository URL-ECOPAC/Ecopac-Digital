import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Imports desde la capa shared del monorepo
import {
  useHistorialDonaciones,
  COLUMNAS_DONACION,
  CAMPOS_FICHA_DONACION,
  OPCIONES_TIPO_DONACION,
} from "@ecopac/shared/donaciones";

export default function DonacionesScreen({ usuarioRol = "administrador" }) {
  const {
    tieneAccesoLectura,
    cargando,
    error,
    donaciones,
    totalesPorTipo,
    recargar,
    filtros: {
      filtroDonante,
      setFiltroDonante,
      filtroTipo,
      setFiltroTipo,
      fechaInicio,
      setFechaInicio,
      fechaFin,
      setFechaFin,
      limpiarFiltros,
    },
    modalDetalle: {
      donacionSeleccionada,
      modalDetalleAbierto,
      abrirDetalle,
      cerrarDetalle,
    },
  } = useHistorialDonaciones({ usuarioRol });

  // Si el rol no tiene permisos de lectura según permisos.js / es_consultivo()
  if (!tieneAccesoLectura) {
    return (
      <SafeAreaView style={styles.containerCenter}>
        <Text style={styles.errorTitle}>Acceso denegado</Text>
        <Text style={styles.errorSubtext}>
          No tienes permisos suficientes para consultar el historial de donaciones.
        </Text>
      </SafeAreaView>
    );
  }

  if (cargando) {
    return (
      <SafeAreaView style={styles.containerCenter}>
        <ActivityIndicator size="large" color="#16A34A" />
      </SafeAreaView>
    );
  }

  // Mapeo / formateo helper para montos o textos de los tipos
  const formatearMonto = (val) => {
    if (!val && val !== 0) return "—";
    if (typeof val === "number") {
      return `Q ${val.toLocaleString("es-GT", { minimumFractionDigits: 2 })}`;
    }
    return val.startsWith("Q") ? val : `Q ${val}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ENCABEZADO */}
        <Text style={styles.pageTitle}>Control de Donaciones</Text>
        <Text style={styles.pageSubtitle}>
          Ingresos donativos vinculados al inventario y proyectos
        </Text>

        {/* BARRA DE BÚSQUEDA LIBRE */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre del donante..."
            placeholderTextColor="#94A3B8"
            value={filtroDonante}
            onChangeText={setFiltroDonante}
          />
          {filtroDonante.length > 0 && (
            <TouchableOpacity onPress={() => setFiltroDonante("")} style={styles.clearSearchBtn}>
              <Text style={styles.clearSearchText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* FILTROS DE TIPO */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
          <TouchableOpacity
            style={[styles.chipFilter, filtroTipo === "" && styles.chipFilterActive]}
            onPress={() => setFiltroTipo("")}
          >
            <Text style={[styles.chipText, filtroTipo === "" && styles.chipTextActive]}>Todos</Text>
          </TouchableOpacity>
          {(OPCIONES_TIPO_DONACION || [
            { value: "dinero", label: "Dinero" },
            { value: "medicamentos", label: "Medicamentos" },
            { value: "insumos", label: "Insumos" },
            { value: "servicios", label: "Servicios" },
          ]).map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chipFilter, filtroTipo === opt.value && styles.chipFilterActive]}
              onPress={() => setFiltroTipo(filtroTipo === opt.value ? "" : opt.value)}
            >
              <Text style={[styles.chipText, filtroTipo === opt.value && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* MÉTRICAS PRINCIPALES (TOTALES POR TIPO DESDE SHARED) */}
        <View style={styles.gridTwoColumns}>
          <View style={styles.cardHalf}>
            <View style={[styles.cardDot, { backgroundColor: "#16A34A" }]} />
            <Text style={styles.cardLabel}>DINERO</Text>
            <Text style={[styles.cardValue, { color: "#16A34A" }]}>
              {formatearMonto(totalesPorTipo?.dinero || 0)}
            </Text>
            <Text style={styles.cardSubtext}>total del periodo</Text>
          </View>

          <View style={styles.cardHalf}>
            <View style={[styles.cardDot, { backgroundColor: "#0284C7" }]} />
            <Text style={styles.cardLabel}>MEDICAMENTOS</Text>
            <Text style={[styles.cardValue, { color: "#0284C7" }]}>
              {totalesPorTipo?.medicamentos || 0}
            </Text>
            <Text style={styles.cardSubtext}>unidades/lotes</Text>
          </View>

          <View style={styles.cardHalf}>
            <View style={[styles.cardDot, { backgroundColor: "#DB2777" }]} />
            <Text style={styles.cardLabel}>INSUMOS</Text>
            <Text style={[styles.cardValue, { color: "#DB2777" }]}>
              {totalesPorTipo?.insumos || 0}
            </Text>
            <Text style={styles.cardSubtext}>unidades/lotes</Text>
          </View>

          <View style={styles.cardHalf}>
            <View style={[styles.cardDot, { backgroundColor: "#EA580C" }]} />
            <Text style={styles.cardLabel}>SERVICIOS</Text>
            <Text style={[styles.cardValue, { color: "#EA580C" }]}>
              {totalesPorTipo?.servicios || 0}
            </Text>
            <Text style={styles.cardSubtext}>registrados</Text>
          </View>
        </View>

        {/* MUESTRA DE MENSAJE DE ERROR O TABLA */}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Ocurrió un error al cargar</Text>
            <Text style={styles.errorSubtext}>{String(error.message || error)}</Text>
            <TouchableOpacity style={styles.btnRetry} onPress={recargar}>
              <Text style={styles.btnRetryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* TABLA UNIFICADA DE 7 COLUMNAS EN HORIZONTAL */
          <View style={styles.tableCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                {/* CABECERA */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.thCell, { width: 140 }]}>DONANTE</Text>
                  <Text style={[styles.thCell, { width: 110 }]}>TIPO</Text>
                  <Text style={[styles.thCell, { width: 160 }]}>DESCRIPCIÓN</Text>
                  <Text style={[styles.thCell, { width: 140 }]}>VINCULADO A</Text>
                  <Text style={[styles.thCell, { width: 95 }]}>FECHA</Text>
                  <Text style={[styles.thCell, { width: 90 }]}>MONTO</Text>
                  <Text style={[styles.thCell, { width: 90 }]}>ESTADO</Text>
                </View>

                {/* FILAS */}
                {donaciones.length === 0 ? (
                  <View style={{ paddingVertical: 20, alignItems: "center" }}>
                    <Text style={{ color: "#94A3B8", fontSize: 13 }}>
                      No se encontraron donaciones con los filtros aplicados.
                    </Text>
                  </View>
                ) : (
                  donaciones.map((item) => {
                    const isRegistrada =
                      item.estado === "registrada" || item.estado === "RECIBIDO";
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.tableBodyRow}
                        onPress={() => abrirDetalle(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.tdTextBold, { width: 140 }]}>
                          {item.donanteNombre || item.donante || "Donante no especificado"}
                        </Text>

                        <View style={{ width: 110, justifyContent: "center" }}>
                          <View style={styles.badgePill}>
                            <Text style={styles.badgeText}>
                              {(item.tipo || "GENERAL").toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        <Text style={[styles.tdTextSub, { width: 160 }]} numberOfLines={2}>
                          {item.descripcion || item.observaciones || "—"}
                        </Text>

                        <Text style={[styles.tdLinkText, { width: 140 }]} numberOfLines={1}>
                          {item.proyectoNombre || item.vinculadoA || "General"}
                        </Text>

                        <Text style={[styles.tdTextSub, { width: 95 }]}>
                          {item.fecha || "—"}
                        </Text>

                        <Text style={[styles.tdTextBold, { width: 90 }]}>
                          {formatearMonto(item.monto || item.montoTotal || item.monto_total || "—")}
                        </Text>

                        <View style={{ width: 90, justifyContent: "center" }}>
                          <View
                            style={[
                              styles.statusPill,
                              {
                                backgroundColor: isRegistrada ? "#DCFCE7" : "#FFEDD5",
                                borderColor: isRegistrada ? "#86EFAC" : "#FDBA74",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusText,
                                { color: isRegistrada ? "#16A34A" : "#EA580C" },
                              ]}
                            >
                              {(item.estado || "REGISTRADA").toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* MODAL DE DETALLE (AL TOCAR UNA DONACIÓN) */}
      <Modal
        visible={modalDetalleAbierto}
        transparent={true}
        animationType="slide"
        onRequestClose={cerrarDetalle}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Detalle de Donación</Text>
            {donacionSeleccionada && (
              <View style={styles.modalBody}>
                <Text style={styles.modalLabel}>Donante:</Text>
                <Text style={styles.modalValue}>
                  {donacionSeleccionada.donanteNombre || donacionSeleccionada.donante || "—"}
                </Text>

                <Text style={styles.modalLabel}>Tipo:</Text>
                <Text style={styles.modalValue}>{donacionSeleccionada.tipo || "—"}</Text>

                <Text style={styles.modalLabel}>Fecha:</Text>
                <Text style={styles.modalValue}>{donacionSeleccionada.fecha || "—"}</Text>

                <Text style={styles.modalLabel}>Estado:</Text>
                <Text style={styles.modalValue}>{donacionSeleccionada.estado || "—"}</Text>

                {donacionSeleccionada.observaciones && (
                  <>
                    <Text style={styles.modalLabel}>Observaciones:</Text>
                    <Text style={styles.modalValue}>{donacionSeleccionada.observaciones}</Text>
                  </>
                )}
              </View>
            )}
            <TouchableOpacity style={styles.btnCloseModal} onPress={cerrarDetalle}>
              <Text style={styles.btnCloseModalText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  containerCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 20,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 14,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
    color: "#0F172A",
  },
  clearSearchBtn: {
    padding: 6,
  },
  clearSearchText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "bold",
  },
  filterBar: {
    flexDirection: "row",
    marginBottom: 14,
  },
  chipFilter: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#E2E8F0",
    marginRight: 8,
  },
  chipFilterActive: {
    backgroundColor: "#16A34A",
  },
  chipText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  gridTwoColumns: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardHalf: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  cardDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: "bold",
    marginVertical: 2,
  },
  cardSubtext: {
    fontSize: 11,
    color: "#94A3B8",
  },
  tableCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  tableHeaderRow: {
    flexDirection: "row",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  thCell: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    paddingRight: 8,
  },
  tableBodyRow: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
    alignItems: "center",
  },
  tdTextBold: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B",
    paddingRight: 8,
  },
  tdTextSub: {
    fontSize: 11,
    color: "#64748B",
    paddingRight: 8,
  },
  tdLinkText: {
    fontSize: 11,
    color: "#16A34A",
    fontWeight: "600",
    paddingRight: 8,
  },
  badgePill: {
    backgroundColor: "#E0F2FE",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#0284C7",
  },
  statusPill: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  statusText: {
    fontSize: 9,
    fontWeight: "700",
  },
  errorCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#991B1B",
    marginBottom: 4,
  },
  errorSubtext: {
    fontSize: 12,
    color: "#7F1D1D",
    textAlign: "center",
    marginBottom: 10,
  },
  btnRetry: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnRetryText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 14,
  },
  modalBody: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#64748B",
    marginTop: 6,
  },
  modalValue: {
    fontSize: 13,
    color: "#1E293B",
  },
  btnCloseModal: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  btnCloseModalText: {
    fontWeight: "bold",
    color: "#334155",
  },
});