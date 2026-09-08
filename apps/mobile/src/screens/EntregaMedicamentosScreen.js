import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useEntregaMedicamentos } from "../../../../packages/shared/inventario/useEntregaMedicamentos";
import { colors, spacing } from "@ecopac/ui-tokens";
import {
  LoadingState,
  ErrorState,
  ScreenContainer,
  PrimaryButton,
  SecondaryButton,
} from "../components";

export default function EntregaMedicamentosScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { atencionId, paciente, rolEntregador } = route.params || {};

  const {
    receta,
    entrega,
    cargando,
    error,
    cargarReceta,
    registrarCantidad,
    confirmarEntrega,
    validarEntrega,
  } = useEntregaMedicamentos({
    atencionId,
    pacienteId: paciente?.id,
    rolEntregador,
  });

  useEffect(() => {
    cargarReceta();
  }, [cargarReceta]);

  const [erroresPorRenglon, setErroresPorRenglon] = useState({});

  const cambiarCantidad = (detalle, texto) => {
    const cantidad = Number(texto) || 0;
    registrarCantidad(detalle.id, cantidad);

    const err = validarEntrega(detalle, cantidad, detalle.existencias);
    setErroresPorRenglon((prev) => ({
      ...prev,
      [detalle.id]: err,
    }));
  };

  const handleConfirmar = async () => {
    const hayErrores = Object.values(erroresPorRenglon).some(
      (lista) => lista && lista.length > 0
    );
    if (hayErrores) {
      Alert.alert("Corrige los errores antes de continuar");
      return;
    }

    const algunoEntregado = Object.values(entrega).some((c) => Number(c) > 0);
    if (!algunoEntregado) {
      Alert.alert("Ingresa al menos una cantidad para entregar");
      return;
    }

    Alert.alert(
      "Confirmar entrega",
      "¿Registrar los medicamentos entregados y dar por cerrada la atención?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            const resultado = await confirmarEntrega();
            if (resultado.exito) {
              Alert.alert("✅ Entrega registrada", "Atención cerrada", [
                { text: "OK", onPress: () => navigation.goBack() },
              ]);
            }
          },
        },
      ]
    );
  };

  if (cargando && receta.length === 0) {
    return (
      <ScreenContainer>
        <LoadingState message="Cargando receta..." />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <ErrorState message={error} onRetry={cargarReceta} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.contenedor}>
      <View style={styles.cabecera}>
        <Text style={styles.etiquetaPaciente}>Paciente</Text>
        <Text style={styles.nombrePaciente}>
          {paciente?.nombreCompleto || "—"}
        </Text>
        <Text style={styles.datosPaciente}>
          Ficha: {paciente?.numeroFicha || "—"}
        </Text>
      </View>

      <ScrollView style={styles.lista} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitulo}>Medicamentos recetados</Text>

        {receta.length === 0 ? (
          <Text style={styles.vacio}>No hay medicamentos en la receta</Text>
        ) : (
          receta.map((detalle) => {
            const cant = entrega[detalle.id] ?? detalle.cantidad_recetada ?? 0;
            const errores = erroresPorRenglon[detalle.id] || [];

            return (
              <View key={detalle.id} style={styles.renglon}>
                <View style={styles.datosMedicamento}>
                  <Text style={styles.nombreMedicamento}>
                    {detalle.medicamento}
                  </Text>
                  <Text style={styles.detalleMedicamento}>
                    Recetado: {detalle.cantidad_recetada} · Disponible:{" "}
                    {detalle.existencias}
                  </Text>
                  {detalle.vencido && (
                    <Text style={styles.textoVencido}>
                      ⚠️ VENCIDO — No se puede entregar
                    </Text>
                  )}
                </View>

                <View style={styles.contenedorCantidad}>
                  <Text style={styles.etiquetaCantidad}>Entregado</Text>
                  <TextInput
                    style={[
                      styles.inputCantidad,
                      errores.length > 0 && styles.inputConError,
                    ]}
                    keyboardType="number-pad"
                    value={String(cant)}
                    onChangeText={(txt) => cambiarCantidad(detalle, txt)}
                    editable={!detalle.vencido}
                  />
                </View>

                {errores.length > 0 && (
                  <View style={styles.cajaErrores}>
                    {errores.map((e, i) => (
                      <Text key={i} style={styles.textoError}>
                        {e}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.barraBotones}>
        <SecondaryButton label="Cancelar" onPress={() => navigation.goBack()} />
        <PrimaryButton
          label={cargando ? "Guardando..." : "Confirmar entrega"}
          onPress={handleConfirmar}
          disabled={cargando}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, padding: spacing.md },
  cabecera: {
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    marginBottom: spacing.md,
  },
  etiquetaPaciente: { fontSize: 13, color: colors.neutral[500] },
  nombrePaciente: { fontSize: 18, fontWeight: "700", color: colors.neutral[900] },
  datosPaciente: { fontSize: 14, color: colors.neutral[600], marginTop: 2 },
  subtitulo: { fontSize: 15, fontWeight: "600", marginBottom: spacing.sm },
  lista: { flex: 1 },
  vacio: { textAlign: "center", color: colors.neutral[500], padding: spacing.xl },
  renglon: {
    backgroundColor: colors.neutral[50],
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  datosMedicamento: { flex: 1 },
  nombreMedicamento: { fontSize: 15, fontWeight: "600" },
  detalleMedicamento: { fontSize: 13, color: colors.neutral[500], marginTop: 2 },
  textoVencido: { color: colors.danger[600], fontWeight: "600", marginTop: 4 },
  contenedorCantidad: { marginTop: spacing.sm },
  etiquetaCantidad: { fontSize: 13, color: colors.neutral[600] },
  inputCantidad: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    marginTop: 4,
  },
  inputConError: {
    borderColor: colors.danger[500],
    backgroundColor: colors.danger[50],
  },
  cajaErrores: { marginTop: 6 },
  textoError: { fontSize: 12, color: colors.danger[600] },
  barraBotones: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
}); 