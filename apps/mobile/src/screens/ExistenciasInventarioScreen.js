import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  diasHastaVencimiento,
  formatearFechaCorta,
  listarExistenciasDisponibles,
  listarLotes,
} from "@ecopac/shared";
import { colors, labels, radii, spacing, typography } from "@ecopac/ui-tokens";

import { Card, EmptyState, ErrorState, LoadingState, StatusChip } from "../components";

const DIAS_CRITICO = 7;
const DIAS_AVISO_VENCIMIENTO = 30;

const ETIQUETAS_POR_ESTADO = {
  disponible: labels.disponible,
  "por vencer": labels.proximoAVencer,
  critico: labels.critico,
  vencido: labels.medicamentoVencido,
  agotado: labels.sinStock,
};

function calcularEstado(diasRestantes, cantidadDisponible) {
  if (diasRestantes !== null && diasRestantes < 0) return "vencido";
  if (cantidadDisponible <= 0) return "agotado";
  if (diasRestantes !== null && diasRestantes <= DIAS_CRITICO) return "critico";
  if (diasRestantes !== null && diasRestantes <= DIAS_AVISO_VENCIMIENTO) return "por vencer";
  return "disponible";
}

/**
 * Existencias por lote, con el stock sumado entre bodegas (issue #270): a diferencia de la
 * tabla multi-bodega de la web (#159) y de StockScreen.js, esta vista no desglosa por bodega.
 *
 * QUE ESTABA MAL (issue #785). Llamaba a useVistaExistencias({ rol }): ese hook toma
 * { existencias, bodegas } por props (un filtro derivado puro, sin fetch propio) y nunca
 * devuelve cargando/error/existencias/recargar. La pantalla quedaba siempre en su rama
 * "sin datos", sin llamar nunca a una API, y ademas no estaba registrada en el navegador.
 *
 * QUE HACE AHORA. listarExistenciasDisponibles() (vista_lotes_disponibles, 00047) solo trae
 * lotes con stock positivo y no vencidos: no alcanza para el criterio "un lote sin existencia
 * se muestra marcado como agotado". Por eso la lista real es listarLotes() (todos los lotes,
 * vencidos o en cero incluidos) con el stock de cada uno tomado de
 * listarExistenciasDisponibles() y sumado entre bodegas; un lote que no aparece ahi (vencido o
 * agotado en todas las bodegas) queda en 0.
 */
export default function ExistenciasInventarioScreen() {
  const [lotes, setLotes] = useState([]);
  const [existenciasDisponibles, setExistenciasDisponibles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    const [respuestaLotes, respuestaExistencias] = await Promise.all([
      listarLotes(),
      listarExistenciasDisponibles(),
    ]);

    setLotes(respuestaLotes.lotes || []);
    setExistenciasDisponibles(respuestaExistencias.existencias || []);
    setError(respuestaLotes.error ?? respuestaExistencias.error ?? null);
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const existencias = useMemo(() => {
    const stockPorLote = new Map();
    existenciasDisponibles.forEach((fila) => {
      stockPorLote.set(
        fila.loteId,
        (stockPorLote.get(fila.loteId) ?? 0) + Number(fila.cantidadDisponible || 0),
      );
    });

    return lotes.map((lote) => {
      const cantidadDisponible = stockPorLote.get(lote.id) ?? 0;
      const diasRestantes = diasHastaVencimiento(lote.fechaVencimiento);

      return {
        loteId: lote.id,
        medicamento: lote.medicamento || "Desconocido",
        codigo: lote.numeroLote,
        numeroLote: lote.numeroLote,
        fechaVencimiento: formatearFechaCorta(lote.fechaVencimiento),
        cantidadDisponible,
        diasRestantes,
        estado: calcularEstado(diasRestantes, cantidadDisponible),
      };
    });
  }, [lotes, existenciasDisponibles]);

  if (cargando && lotes.length === 0) {
    return <LoadingState message="Cargando existencias..." />;
  }

  return (
    <ScrollView
      style={estilos.contenedor}
      contentContainerStyle={estilos.contenido}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
    >
      <Text style={estilos.titulo}>Existencias de inventario</Text>
      <Text style={estilos.subtitulo}>{existencias.length} lotes registrados</Text>

      {error ? <ErrorState message={error.mensaje} onRetry={cargar} /> : null}

      {!error && existencias.length === 0 ? (
        <EmptyState message="No hay lotes registrados." />
      ) : null}

      {existencias.map((item) => (
        <Card key={item.loteId} style={estilos.tarjeta}>
          <View style={estilos.filaSuperior}>
            <Text style={estilos.nombreMedicamento} numberOfLines={1}>
              {item.medicamento}
            </Text>
            <Text style={estilos.codigo}>{item.codigo || "S/C"}</Text>
          </View>

          <View style={estilos.filaDatos}>
            <View>
              <Text style={estilos.etiquetaDato}>Lote</Text>
              <Text style={estilos.valorDato}>{item.numeroLote}</Text>
            </View>
            <View>
              <Text style={estilos.etiquetaDato}>Caducidad</Text>
              <Text style={estilos.valorDato}>{item.fechaVencimiento}</Text>
            </View>
            <View style={estilos.stock}>
              <Text style={estilos.etiquetaDato}>Stock</Text>
              <Text style={estilos.valorStock}>{item.cantidadDisponible}</Text>
            </View>
          </View>

          <View style={estilos.filaEstado}>
            <StatusChip status={item.estado} label={ETIQUETAS_POR_ESTADO[item.estado]} />
            {item.diasRestantes !== null ? (
              <Text style={estilos.diasRestantes}>
                {item.diasRestantes < 0
                  ? `Vencido hace ${Math.abs(item.diasRestantes)} días`
                  : `Vence en ${item.diasRestantes} días`}
              </Text>
            ) : null}
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contenido: {
    padding: spacing.md,
  },
  titulo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  subtitulo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  tarjeta: {
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  filaSuperior: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  nombreMedicamento: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    flexShrink: 1,
  },
  codigo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  filaDatos: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  etiquetaDato: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  valorDato: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginTop: 2,
  },
  stock: {
    alignItems: "center",
  },
  valorStock: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: 2,
  },
  filaEstado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  diasRestantes: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
});
