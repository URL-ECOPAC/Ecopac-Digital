import { View, Text, StyleSheet, RefreshControl, ScrollView, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAlertasVencimiento } from "../../../../packages/shared/inventario/useAlertasVencimiento";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { LoadingState, ErrorState } from "../components";

// Mapeo de umbrales a colores visuales
const COLORES_ALERTA = {
  critico: { fondo: "#fef2f2", borde: "#fecaca", texto: "#dc2626", etiqueta: "⚠️ Crítico" },
  alto: { fondo: "#fffbeb", borde: "#fde68a", texto: "#d97706", etiqueta: "🔴 Próximo" },
  medio: { fondo: "#f0f9ff", borde: "#bae6fd", texto: "#0284c7", etiqueta: "🟡 Atención" },
  normal: { fondo: "#f0fdf4", borde: "#bbf7d0", texto: "#059669", etiqueta: "✅ Vigente" },
  vencido: { fondo: "#f3f4f6", borde: "#d1d5db", texto: "#4b5563", etiqueta: "⛔ Vencido" },
};

export default function InventarioResumenAlertasScreen() {
  const navigation = useNavigation();
  const { rol } = useSesionCompartida();
  const { cargando, error, resumen, alertas, recargar } = useAlertasVencimiento({ rol });

  const irADetalleLote = (lote) => {
    navigation.navigate("DetalleLote", { loteId: lote.id, titulo: lote.medicamento });
  };

  return (
    <ScrollView
      style={estilos.contenedor}
      refreshControl={
        <RefreshControl refreshing={cargando} onRefresh={recargar} />
      }
    >
      {/* 📊 Tarjetas de resumen */}
      <View style={estilos.tarjetasResumen}>
        <View style={estilos.tarjeta}>
          <Text style={estilos.tarjetaValor}>{resumen?.total_medicamentos ?? 0}</Text>
          <Text style={estilos.tarjetaEtiqueta}>Medicamentos</Text>
        </View>
        <View style={estilos.tarjeta}>
          <Text style={estilos.tarjetaValor}>{resumen?.total_lotes ?? 0}</Text>
          <Text style={estilos.tarjetaEtiqueta}>Lotes activos</Text>
        </View>
        <View style={estilos.tarjeta}>
          <Text style={[estilos.tarjetaValor, { color: "#dc2626" }]}>
            {resumen?.criticos ?? 0}
          </Text>
          <Text style={estilos.tarjetaEtiqueta}>En riesgo</Text>
        </View>
      </View>

      {cargando && <LoadingState mensaje="Cargando inventario..." />}
      {error && <ErrorState mensaje={error.mensaje} alReintentar={recargar} />}

      {/* 🚨 Lista de alertas ordenada por urgencia */}
      {alertas?.length > 0 && (
        <>
          <Text style={estilos.tituloSeccion}> Lotes por vencer</Text>
          {alertas.map((alerta) => {
            const esVencido = alerta.dias_restantes <= 0;
            const nivel = esVencido ? "vencido" : alerta.nivel_alerta;
            const color = COLORES_ALERTA[nivel] || COLORES_ALERTA.normal;

            return (
              <Pressable
                key={alerta.lote_id}
                style={({ pressed }) => [
                  estilos.alerta,
                  { backgroundColor: color.fondo, borderColor: color.borde },
                  pressed && estilos.alertaPresionada,
                ]}
                onPress={() => irADetalleLote(alerta)}
              >
                <View style={estilos.alertaCabecera}>
                  <Text style={estilos.alertaMedicamento}>{alerta.medicamento}</Text>
                  <Text style={[estilos.alertaEtiqueta, { color: color.texto }]}>
                    {color.etiqueta}
                  </Text>
                </View>
                <Text style={estilos.alertaDetalle}>
                  Lote: {alerta.numero_lote} · {alerta.bodega || "Sin bodega"}
                </Text>
                <Text style={[estilos.alertaDias, { color: color.texto }]}>
                  {esVencido
                    ? ` Vencido hace ${Math.abs(alerta.dias_restantes)} días`
                    : ` Vence en ${alerta.dias_restantes} días`}
                </Text>
              </Pressable>
            );
          })}
        </>
      )}

      {!cargando && !error && alertas?.length === 0 && (
        <View style={estilos.vacio}>
          <Text style={estilos.textoVacio}> Sin lotes próximos a vencer</Text>
        </View>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f8fafc",
  },
  tarjetasResumen: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  tarjeta: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  tarjetaValor: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
  },
  tarjetaEtiqueta: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
    textAlign: "center",
  },
  tituloSeccion: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 12,
  },
  alerta: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  alertaPresionada: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  alertaCabecera: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  alertaMedicamento: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    flexShrink: 1,
  },
  alertaEtiqueta: {
    fontSize: 11,
    fontWeight: "700",
  },
  alertaDetalle: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },
  alertaDias: {
    fontSize: 13,
    fontWeight: "600",
  },
  vacio: {
    paddingVertical: 40,
    alignItems: "center",
  },
  textoVacio: {
    fontSize: 15,
    color: "#64748b",
  },
});