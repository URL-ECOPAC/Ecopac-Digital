import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useEntregaMedicamentos } from "@ecopac/shared";
import { colors, spacing } from "@ecopac/ui-tokens";
import {
  LoadingState,
  ErrorState,
  ScreenContainer,
  PrimaryButton,
  SecondaryButton,
} from "../components";

// Pantalla de solo lectura (issue #749): el descuento de inventario de una receta con lote ya
// ocurre al generarla (fn_generar_receta, migracion 00112), no aqui. Todavia no existe un
// mecanismo de "confirmar entrega" en la base de datos, asi que el boton de accion queda
// deshabilitado hasta que exista esa issue.
export default function EntregaMedicamentosScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { atencionId } = route.params || {};

  const { cargando, error, receta, detalles, recargar } = useEntregaMedicamentos(atencionId);

  if (cargando && !error && detalles.length === 0) {
    return (
      <ScreenContainer>
        <LoadingState message="Cargando receta..." />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.contenedor}>
      <View style={styles.cabecera}>
        <Text style={styles.etiquetaPaciente}>Paciente</Text>
        <Text style={styles.nombrePaciente}>{receta?.pacienteNombre || "—"}</Text>
        <Text style={styles.datosPaciente}>Ficha: {receta?.numeroFicha || "—"}</Text>
      </View>

      <ScrollView style={styles.lista} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitulo}>Medicamentos recetados</Text>

        {detalles.length === 0 ? (
          <Text style={styles.vacio}>No hay medicamentos en la receta</Text>
        ) : (
          detalles.map((detalle) => (
            <View key={detalle.id} style={styles.renglon}>
              <View style={styles.datosMedicamento}>
                <Text style={styles.nombreMedicamento}>{detalle.medicamento}</Text>
                <Text style={styles.detalleMedicamento}>
                  Entregado: {detalle.cantidadEntregada} · Disponible:{" "}
                  {detalle.cantidadDisponible ?? "—"}
                </Text>
                {detalle.vencido && (
                  <Text style={styles.textoVencido}>VENCIDO — No se puede entregar</Text>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.barraBotones}>
        <SecondaryButton title="Volver" onPress={() => navigation.goBack()} />
        <PrimaryButton title="Entrega no disponible aun" disabled />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, padding: spacing.md },
  cabecera: {
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  etiquetaPaciente: { fontSize: 13, color: colors.textMuted },
  nombrePaciente: { fontSize: 18, fontWeight: "700", color: colors.text },
  datosPaciente: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  subtitulo: { fontSize: 15, fontWeight: "600", marginBottom: spacing.sm },
  lista: { flex: 1 },
  vacio: { textAlign: "center", color: colors.textMuted, padding: spacing.xl },
  renglon: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  datosMedicamento: { flex: 1 },
  nombreMedicamento: { fontSize: 15, fontWeight: "600", color: colors.text },
  detalleMedicamento: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  textoVencido: { color: colors.danger, fontWeight: "600", marginTop: 4 },
  barraBotones: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
