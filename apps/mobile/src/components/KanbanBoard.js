// apps/mobile/src/components/KanbanBoard.js
import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet } from "react-native";

export default function KanbanBoard({ proyectos, etapas, onCambiarEtapa }) {
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);

  return (
    <View style={styles.kanbanContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {etapas.map((etapa) => {
          const proyectosEtapa = proyectos.filter((p) => (p.etapa || p.estado) === etapa.id);

          return (
            <View key={etapa.id} style={styles.column}>
              <View style={styles.columnHeader}>
                <Text style={styles.columnTitle}>{etapa.titulo}</Text>
                <View style={styles.badgeCount}>
                  <Text style={styles.badgeCountText}>{proyectosEtapa.length}</Text>
                </View>
              </View>

              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {proyectosEtapa.map((p) => (
                  <View key={p.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{p.nombre}</Text>
                    {p.descripcion && (
                      <Text style={styles.cardDesc} numberOfLines={2}>
                        {p.descripcion}
                      </Text>
                    )}
                    <View style={styles.cardFooter}>
                      <Text style={styles.cardBudget}>
                        Q {Number(p.presupuesto || 0).toLocaleString()}
                      </Text>
                      <TouchableOpacity
                        style={styles.moveBtn}
                        onPress={() => setProyectoSeleccionado(p)}
                      >
                        <Text style={styles.moveBtnText}>Mover</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      {/* Modal para cambiar etapa */}
      <Modal
        visible={!!proyectoSeleccionado}
        transparent
        animationType="fade"
        onRequestClose={() => setProyectoSeleccionado(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Mover Proyecto</Text>
            <Text style={styles.modalSubtitle}>{proyectoSeleccionado?.nombre}</Text>

            {etapas.map((e) => (
              <TouchableOpacity
                key={e.id}
                style={[
                  styles.optionBtn,
                  (proyectoSeleccionado?.etapa || proyectoSeleccionado?.estado) === e.id &&
                    styles.optionBtnSelected,
                ]}
                onPress={() => {
                  onCambiarEtapa(proyectoSeleccionado.id, e.id);
                  setProyectoSeleccionado(null);
                }}
              >
                <Text
                  style={[
                    styles.optionBtnText,
                    (proyectoSeleccionado?.etapa || proyectoSeleccionado?.estado) === e.id &&
                      styles.optionBtnTextSelected,
                  ]}
                >
                  {e.titulo}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.closeBtn} onPress={() => setProyectoSeleccionado(null)}>
              <Text style={styles.closeBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  kanbanContainer: {
    minHeight: 450, // <-- CRUCIAL: evita que el tablero colapse verticalmente
    paddingVertical: 8,
  },
  column: {
    width: 260,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    maxHeight: 500,
  },
  columnHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
  },
  columnTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  badgeCount: {
    backgroundColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  cardBudget: {
    fontSize: 12,
    fontWeight: "700",
    color: "#16A34A",
  },
  moveBtn: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  moveBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0284C7",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 16,
  },
  optionBtn: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  optionBtnSelected: {
    backgroundColor: "#DCFCE7",
    borderColor: "#16A34A",
  },
  optionBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  optionBtnTextSelected: {
    color: "#15803D",
  },
  closeBtn: {
    marginTop: 8,
    padding: 12,
    alignItems: "center",
  },
  closeBtnText: {
    color: "#64748B",
    fontWeight: "600",
  },
});
