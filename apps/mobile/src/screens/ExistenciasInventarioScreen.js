import { View, Text, StyleSheet, RefreshControl, ScrollView, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useVistaExistencias } from "../../../../packages/shared/inventario/useVistaExistencias";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { LoadingState, ErrorState } from "../components";

// Indicadores de estado visibles (NO solo color)
const ETIQUETAS_ESTADO = {
  vigente: { texto: " Vigente", color: "#059669" },
  proximo: { texto: " Próximo a vencer", color: "#d97706" },
  critico: { texto: " Por vencer pronto", color: "#dc2626" },
  vencido: { texto: " Vencido", color: "#4b5563" },
  agotado: { texto: " Agotado", color: "#94a3b8" },
};

export default function ExistenciasInventarioScreen() {
  const navigation = useNavigation();
  const { rol } = useSesionCompartida();
  const { cargando, error, existencias, recargar } = useVistaExistencias({ rol });

  const irADetalleLote = (lote) => {
    navigation.navigate("DetalleLote", { loteId: lote.lote_id, titulo: lote.medicamento });
  };

  return (
    <ScrollView
      style={estilos.contenedor}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={recargar} />}
    >
      <View style={estilos.cabecera}>
        <Text style={estilos.titulo}>📋 Existencias de Inventario</Text>
        <Text style={estilos.subtitulo}>{existencias?.length ?? 0} lotes con stock disponible</Text>
      </View>

      {cargando && <LoadingState mensaje="Cargando existencias..." />}
      {error && <ErrorState mensaje={error.mensaje} alReintentar={recargar} />}

      {/* 📦 Tarjetas de existencias */}
      {existencias?.length > 0 ? (
        existencias.map((item) => {
          const estado =
            item.cantidad_disponible <= 0
              ? ETIQUETAS_ESTADO.agotado
              : ETIQUETAS_ESTADO[item.estado_caducidad] || ETIQUETAS_ESTADO.vigente;

          return (
            <Pressable
              key={item.lote_id}
              style={({ pressed }) => [
                estilos.tarjeta,
                item.cantidad_disponible <= 0 && estilos.tarjetaAgotada,
                pressed && estilos.tarjetaPresionada,
              ]}
              onPress={() => irADetalleLote(item)}
              disabled={item.cantidad_disponible <= 0}
            >
              {/* Medicamento y código */}
              <View style={estilos.filaSuperior}>
                <Text style={estilos.nombreMedicamento} numberOfLines={1}>
                  {item.medicamento}
                </Text>
                <Text style={estilos.codigo}>{item.codigo || "S/C"}</Text>
              </View>

              {/* Lote y fecha de caducidad */}
              <View style={estilos.filaDatos}>
                <View>
                  <Text style={estilos.etiquetaDato}>Lote</Text>
                  <Text style={estilos.valorDato}>{item.numero_lote}</Text>
                </View>
                <View>
                  <Text style={estilos.etiquetaDato}>Caducidad</Text>
                  <Text style={estilos.valorDato}>{item.fecha_vencimiento}</Text>
                </View>
                <View style={estilos.stock}>
                  <Text style={estilos.etiquetaDato}>Stock</Text>
                  <Text
                    style={[estilos.valorStock, item.cantidad_disponible <= 0 && estilos.agotado]}
                  >
                    {item.cantidad_disponible ?? 0}
                  </Text>
                </View>
              </View>

              {/* Estado con indicador VISIBLE (no solo color) */}
              <View style={estilos.filaEstado}>
                <Text style={[estilos.textoEstado, { color: estado.color }]}>{estado.texto}</Text>
                {item.dias_restantes != null && item.cantidad_disponible > 0 && (
                  <Text style={estilos.diasRestantes}>
                    {item.dias_restantes <= 0
                      ? `Vencido hace ${Math.abs(item.dias_restantes)} días`
                      : `Vence en ${item.dias_restantes} días`}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })
      ) : !cargando && !error ? (
        <View style={estilos.vacio}>
          <Text style={estilos.textoVacio}> Sin existencias registradas</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f8fafc",
  },
  cabecera: {
    marginBottom: 20,
  },
  titulo: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
  },
  subtitulo: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  tarjeta: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },
  tarjetaAgotada: {
    backgroundColor: "#f8fafc",
    borderStyle: "dashed",
    borderColor: "#cbd5e1",
    opacity: 0.8,
  },
  tarjetaPresionada: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  filaSuperior: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  nombreMedicamento: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    flexShrink: 1,
  },
  codigo: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "monospace",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  filaDatos: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  etiquetaDato: {
    fontSize: 10,
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  valorDato: {
    fontSize: 13,
    fontWeight: "500",
    color: "#334155",
    marginTop: 2,
  },
  stock: {
    alignItems: "center",
  },
  valorStock: {
    fontSize: 18,
    fontWeight: "800",
    color: "#059669",
    marginTop: 2,
  },
  agotado: {
    color: "#94a3b8",
  },
  filaEstado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  textoEstado: {
    fontSize: 13,
    fontWeight: "600",
  },
  diasRestantes: {
    fontSize: 11,
    color: "#64748b",
  },
  vacio: {
    paddingVertical: 60,
    alignItems: "center",
  },
  textoVacio: {
    fontSize: 15,
    color: "#64748b",
  },
});
