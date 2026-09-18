import { useRoute } from "@react-navigation/native";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  ETIQUETAS_ESTADO_MOVIMIENTO,
  ETIQUETAS_ORIGEN_LOTE,
  ETIQUETAS_TIPO_MOVIMIENTO,
  formatearFechaCorta,
  TIPOS_DE_MOVIMIENTO,
  useDetalleLote,
} from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  ScreenContainer,
  StatusChip,
} from "../components";

// Pantalla de detalle de un lote (issue #791): Existencias y el alertario de vencimiento
// navegaban a "DetalleLote", una ruta que nunca se construyo. Muestra los datos del lote
// (medicamento, numero, proveedor, origen, fechas) y su kardex -los movimientos de
// movimientos_inventario de ESE lote, via useKardexMovimientos({ loteId })-, no el costo
// unitario: eso es informacion financiera gateada por puedeVerValorizacion (issue #752) y esta
// pantalla la ve cualquier rol que pueda ver existencias.
export default function DetalleLoteScreen() {
  const { params } = useRoute();
  const loteId = params?.loteId;

  const { lote, movimientos, cargando, error, recargar } = useDetalleLote(loteId);

  if (cargando && !lote) {
    return (
      <ScreenContainer>
        <LoadingState message="Cargando el lote..." />
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

  if (!lote) {
    return (
      <ScreenContainer>
        <EmptyState message="No se encontro el lote." />
      </ScreenContainer>
    );
  }

  return (
    <ScrollView
      style={estilos.contenedor}
      contentContainerStyle={estilos.contenido}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={recargar} />}
    >
      <Card style={estilos.tarjetaLote}>
        <Text style={estilos.medicamento}>{lote.medicamento || "Medicamento desconocido"}</Text>
        {lote.vencido ? <Text style={estilos.avisoVencido}>Este lote esta vencido</Text> : null}

        <View style={estilos.filaDatos}>
          <View style={estilos.dato}>
            <Text style={estilos.etiquetaDato}>Número de lote</Text>
            <Text style={estilos.valorDato}>{lote.numeroLote}</Text>
          </View>
          <View style={estilos.dato}>
            <Text style={estilos.etiquetaDato}>Proveedor</Text>
            <Text style={estilos.valorDato}>{lote.proveedor || "—"}</Text>
          </View>
        </View>

        <View style={estilos.filaDatos}>
          <View style={estilos.dato}>
            <Text style={estilos.etiquetaDato}>Origen</Text>
            <Text style={estilos.valorDato}>
              {ETIQUETAS_ORIGEN_LOTE[lote.origen] ?? lote.origen ?? "—"}
            </Text>
          </View>
          <View style={estilos.dato}>
            <Text style={estilos.etiquetaDato}>Cantidad ingresada</Text>
            <Text style={estilos.valorDato}>{lote.cantidadIngresada}</Text>
          </View>
        </View>

        <View style={estilos.filaDatos}>
          <View style={estilos.dato}>
            <Text style={estilos.etiquetaDato}>Fecha de ingreso</Text>
            <Text style={estilos.valorDato}>{formatearFechaCorta(lote.fechaIngreso) || "—"}</Text>
          </View>
          <View style={estilos.dato}>
            <Text style={estilos.etiquetaDato}>Fecha de vencimiento</Text>
            <Text style={estilos.valorDato}>
              {formatearFechaCorta(lote.fechaVencimiento) || "—"}
            </Text>
          </View>
        </View>
      </Card>

      <Text style={estilos.tituloSeccion}>Movimientos ({movimientos.length})</Text>

      {movimientos.length === 0 ? (
        <EmptyState message="Este lote todavia no tiene movimientos registrados." />
      ) : (
        movimientos.map((movimiento) => (
          <Card key={movimiento.id} style={estilos.tarjetaMovimiento}>
            <View style={estilos.filaCabeceraMovimiento}>
              <Text style={estilos.tipoMovimiento}>
                {ETIQUETAS_TIPO_MOVIMIENTO[movimiento.tipo] ?? movimiento.tipo}
              </Text>
              <Text
                style={[
                  estilos.cantidadMovimiento,
                  movimiento.tipo === TIPOS_DE_MOVIMIENTO.SALIDA && estilos.cantidadSalida,
                ]}
              >
                {movimiento.tipo === TIPOS_DE_MOVIMIENTO.SALIDA ? "-" : "+"}
                {movimiento.cantidad}
              </Text>
            </View>
            <Text style={estilos.fechaMovimiento}>
              {formatearFechaCorta(movimiento.created_at)} · {movimiento.bodega_nombre || "—"}
            </Text>
            <View style={estilos.filaPieMovimiento}>
              <StatusChip
                status={movimiento.estado}
                label={ETIQUETAS_ESTADO_MOVIMIENTO[movimiento.estado]}
              />
              <Text style={estilos.registradoPor}>{movimiento.registrado_por_nombre || "—"}</Text>
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contenido: {
    padding: spacing.lg,
  },
  tarjetaLote: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  medicamento: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  avisoVencido: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.danger,
  },
  filaDatos: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  dato: {
    flex: 1,
  },
  etiquetaDato: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  valorDato: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginTop: spacing.xs / 2,
  },
  tituloSeccion: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  tarjetaMovimiento: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  filaCabeceraMovimiento: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tipoMovimiento: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  cantidadMovimiento: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  cantidadSalida: {
    color: colors.danger,
  },
  fechaMovimiento: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  filaPieMovimiento: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  registradoPor: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
});
