import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  formatearFechaCorta,
  listarBodegas,
  listarLotes,
  listarMedicamentos,
  useAlertasVencimiento,
} from "@ecopac/shared";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";

import { Card, EmptyState, ErrorState, LoadingState } from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";

/**
 * Resumen y alertario de inventario (issue #268): tarjetas de resumen en la cabecera y las
 * alertas de vencimiento, ordenadas por urgencia, separadas en "por vencer" y "vencidas".
 *
 * QUE ESTABA MAL (issue #785). Llamaba a useAlertasVencimiento({ rol }): ese hook toma
 * { lotes, bodegas, usuarioId, rolUsuario } por props (tampoco hace fetch propio) y nunca
 * devuelve cargando/error/resumen/alertas -- devuelve { alertas, porVencer, vencidas,
 * cantidadPendientes, ... }. Ademas leia campos snake_case (alerta.dias_restantes,
 * alerta.nivel_alerta, resumen.total_medicamentos) que no existen en esa forma. La pantalla
 * quedaba siempre en su rama "sin datos", y ademas no estaba registrada en el navegador.
 *
 * QUE HACE AHORA. Carga listarLotes(), listarBodegas() y listarMedicamentos() al montar (mismo
 * patron que StockScreen.js), y se las pasa a useAlertasVencimiento() para obtener las alertas
 * reales. El resumen de cabecera se arma con esos mismos datos: medicamentos del catalogo,
 * lotes no vencidos, y el total de alertas pendientes (cantidadPendientes) como "en riesgo".
 */
export default function InventarioResumenAlertasScreen() {
  const { perfil, rol } = useSesionCompartida();

  const [lotes, setLotes] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [totalMedicamentos, setTotalMedicamentos] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    const [respuestaLotes, respuestaBodegas, respuestaMedicamentos] = await Promise.all([
      listarLotes(),
      listarBodegas(),
      listarMedicamentos(),
    ]);

    setLotes(respuestaLotes.lotes || []);
    setBodegas(respuestaBodegas.bodegas || []);
    setTotalMedicamentos((respuestaMedicamentos.medicamentos || []).length);
    setError(respuestaLotes.error ?? respuestaBodegas.error ?? respuestaMedicamentos.error ?? null);
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const { porVencer, vencidas, cantidadPendientes } = useAlertasVencimiento({
    lotes,
    bodegas,
    usuarioId: perfil?.id,
    rolUsuario: rol,
  });

  const lotesActivos = lotes.filter((lote) => !lote.vencido).length;

  if (cargando && lotes.length === 0) {
    return <LoadingState message="Cargando inventario..." />;
  }

  return (
    <ScrollView
      style={estilos.contenedor}
      contentContainerStyle={estilos.contenido}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
    >
      <Text style={estilos.titulo}>Resumen de inventario</Text>

      <View style={estilos.tarjetasResumen}>
        <View style={estilos.tarjetaResumen}>
          <Text style={estilos.valorResumen}>{totalMedicamentos}</Text>
          <Text style={estilos.etiquetaResumen}>Medicamentos</Text>
        </View>
        <View style={estilos.tarjetaResumen}>
          <Text style={estilos.valorResumen}>{lotesActivos}</Text>
          <Text style={estilos.etiquetaResumen}>Lotes activos</Text>
        </View>
        <View style={estilos.tarjetaResumen}>
          <Text style={[estilos.valorResumen, estilos.valorEnRiesgo]}>{cantidadPendientes}</Text>
          <Text style={estilos.etiquetaResumen}>En riesgo</Text>
        </View>
      </View>

      {error ? <ErrorState message={error.mensaje} onRetry={cargar} /> : null}

      {!error ? (
        <>
          <Text style={estilos.tituloSeccion}>Por vencer ({porVencer.length})</Text>
          {porVencer.length === 0 ? (
            <EmptyState message="Ningún lote vence en los próximos 30 días." />
          ) : (
            porVencer.map((alerta) => (
              <Card key={alerta.id} style={estilos.alertaPorVencer}>
                <View style={estilos.alertaCabecera}>
                  <Text style={estilos.alertaMedicamento} numberOfLines={1}>
                    {alerta.medicamento}
                  </Text>
                  <Text style={estilos.alertaDias}>
                    {alerta.diasRestantes === 0 ? "Vence hoy" : `${alerta.diasRestantes} días`}
                  </Text>
                </View>
                <Text style={estilos.alertaDetalle}>
                  Lote {alerta.lote} · vence el {formatearFechaCorta(alerta.fechaVencimiento)}
                </Text>
              </Card>
            ))
          )}

          <Text style={estilos.tituloSeccion}>Vencidos ({vencidas.length})</Text>
          {vencidas.length === 0 ? (
            <EmptyState message="No hay lotes vencidos." />
          ) : (
            vencidas.map((alerta) => (
              <Card key={alerta.id} style={estilos.alertaVencida}>
                <View style={estilos.alertaCabecera}>
                  <Text style={estilos.alertaMedicamento} numberOfLines={1}>
                    {alerta.medicamento}
                  </Text>
                  <Text style={[estilos.alertaDias, estilos.alertaDiasVencida]}>
                    Vencido hace {Math.abs(alerta.diasRestantes)} días
                  </Text>
                </View>
                <Text style={estilos.alertaDetalle}>
                  Lote {alerta.lote} · venció el {formatearFechaCorta(alerta.fechaVencimiento)}
                </Text>
              </Card>
            ))
          )}
        </>
      ) : null}
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
    marginBottom: spacing.md,
  },
  tarjetasResumen: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tarjetaResumen: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  valorResumen: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  valorEnRiesgo: {
    color: colors.danger,
  },
  etiquetaResumen: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  tituloSeccion: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  alertaPorVencer: {
    marginBottom: spacing.sm,
    borderColor: colors.warning,
    gap: spacing.xs,
  },
  alertaVencida: {
    marginBottom: spacing.sm,
    borderColor: colors.danger,
    gap: spacing.xs,
  },
  alertaCabecera: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  alertaMedicamento: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    flexShrink: 1,
  },
  alertaDias: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.warning,
  },
  alertaDiasVencida: {
    color: colors.danger,
  },
  alertaDetalle: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
});
