import { useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { puedeAjustarEntregaReceta, useEntregaMedicamentos } from "@ecopac/shared";
import { colors, spacing } from "@ecopac/ui-tokens";
import { LoadingState, ErrorState, ScreenContainer, SecondaryButton } from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalAjusteEntrega from "./ModalAjusteEntrega";

// La receta descuenta el inventario de forma atomica al emitirse (fn_generar_receta, migracion
// 00112): esta pantalla no repite ese descuento. La cantidad realmente entregada es
// detalle.cantidadRealEntregada (cantidadAjustada si alguien ya la corrigio, si no
// cantidadEntregada), y "Ajustar" es la unica forma de cambiarla -llama a ajustarEntrega()
// (useEntregaMedicamentos.js), que registra solo la diferencia contra el ultimo valor confirmado
// (fn_ajustar_entrega_receta, migracion 00128, issue #764). Solo medico o administracion pueden
// ajustar (puedeAjustarEntregaReceta, espejo de la guarda de esa funcion); un voluntario ve la
// receta igual, de solo lectura.
export default function EntregaMedicamentosScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { atencionId } = route.params || {};
  const { rol } = useSesionCompartida();

  const { cargando, error, receta, detalles, recargar, ajustarEntrega } =
    useEntregaMedicamentos(atencionId);
  const [detalleEnAjuste, setDetalleEnAjuste] = useState(null);

  const puedeAjustar = puedeAjustarEntregaReceta(rol);

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
          detalles.map((detalle) => {
            // Sin lote y bodega no hay movimiento de inventario que ajustar (00128 rechaza este
            // caso): no se ofrece el boton para no llevar a un error garantizado.
            const puedeAjustarEsteRenglon = puedeAjustar && detalle.loteId && detalle.bodegaId;

            return (
              <View key={detalle.id} style={styles.renglon}>
                <View style={styles.datosMedicamento}>
                  <Text style={styles.nombreMedicamento}>{detalle.medicamento}</Text>
                  <Text style={styles.detalleMedicamento}>
                    Entregado: {detalle.cantidadRealEntregada} · Disponible:{" "}
                    {detalle.cantidadDisponible ?? "—"}
                    {detalle.cantidadAjustada !== null ? " · Ajustado" : ""}
                  </Text>
                  {detalle.vencido && (
                    <Text style={styles.textoVencido}>VENCIDO — No se puede entregar</Text>
                  )}
                </View>
                {puedeAjustarEsteRenglon && (
                  <SecondaryButton
                    title="Ajustar"
                    onPress={() => setDetalleEnAjuste(detalle)}
                    style={styles.botonAjustar}
                  />
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.barraBotones}>
        <SecondaryButton title="Volver" onPress={() => navigation.goBack()} />
      </View>

      <ModalAjusteEntrega
        visible={Boolean(detalleEnAjuste)}
        detalle={detalleEnAjuste}
        onClose={() => setDetalleEnAjuste(null)}
        onGuardar={ajustarEntrega}
      />
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
  botonAjustar: { marginTop: spacing.sm, alignSelf: "flex-start" },
  barraBotones: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
