import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";
import { ETIQUETAS_ESTADO_JORNADA, useReporteJornada } from "@ecopac/shared";

import { useJornadaActivaCompartida } from "../contexto/JornadaActivaProvider";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { Card, ErrorState, LoadingState, StatusChip } from "../components";

/**
 * Resumen de avance de la jornada activa (issue #178/#268).
 *
 * QUE ESTABA MAL (issue #792, encontrado al resolver la #785). ErrorState y LoadingState
 * (catalogo de componentes) reciben `message`/`onRetry`; esta pantalla les pasaba
 * `mensaje`/`alReintentar`, props que esos componentes no declaran. Cuando useReporteJornada()
 * devolvia un error, ErrorState caia a su mensaje generico de conexion sin boton de reintentar,
 * en vez del error real. Ademas la pantalla no usaba @ecopac/ui-tokens (colores en hexadecimal
 * escritos a mano) ni el resto del catalogo (Card, StatusChip), mismo patron ya corregido en
 * StockScreen.js (#165) y en ExistenciasInventarioScreen.js/InventarioResumenAlertasScreen.js
 * (#785).
 */
export default function ResumenJornadaScreen() {
  const { jornada } = useJornadaActivaCompartida();
  const { rol } = useSesionCompartida();

  const { cargando, error, ficha, personal, medicamentos, recargar } = useReporteJornada(
    jornada?.id,
    { rol },
  );

  if (!jornada) {
    return (
      <View style={estilos.contenedorCentrado}>
        <Text style={estilos.texto}>No hay jornada activa seleccionada</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={estilos.contenedor}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={recargar} />}
    >
      <Card style={estilos.tarjetaPrincipal}>
        <Text style={estilos.titulo}>{ficha?.nombre || jornada.nombre}</Text>
        <Text style={estilos.subtitulo}>
          {ficha?.fecha || jornada.fecha} · {ficha?.comunidad || jornada.comunidad?.nombre}
        </Text>
        <View style={estilos.filaEstado}>
          <Text style={estilos.etiquetaEstado}>Estado:</Text>
          <StatusChip
            status={ficha?.estado || jornada.estado}
            label={ETIQUETAS_ESTADO_JORNADA[ficha?.estado || jornada.estado]}
          />
        </View>
      </Card>

      {cargando && <LoadingState message="Cargando resumen..." />}

      {error && error.codigo === "SIN_PERMISO" ? (
        <View style={estilos.contenedorCentrado}>
          <Text style={estilos.texto}>{error.mensaje}</Text>
        </View>
      ) : error ? (
        <ErrorState message={error.mensaje} onRetry={recargar} />
      ) : null}

      {ficha && (
        <>
          <Text style={estilos.seccionTitulo}>Avance del día</Text>

          <View style={estilos.fila}>
            <TarjetaResumen etiqueta="Pacientes Atendidos" valor={ficha.pacientes_atendidos} />
            <TarjetaResumen etiqueta="Consultas Realizadas" valor={ficha.total_consultas} />
          </View>

          <View style={estilos.fila}>
            <TarjetaResumen
              etiqueta="Medicamentos Entregados"
              valor={
                medicamentos.length ? medicamentos.reduce((s, m) => s + (m.cantidad || 0), 0) : 0
              }
            />
            <TarjetaResumen etiqueta="Personal Participante" valor={personal.length} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const TarjetaResumen = ({ etiqueta, valor }) => (
  <Card style={estilos.tarjeta}>
    <Text style={estilos.etiqueta}>{etiqueta}</Text>
    <Text style={estilos.valor}>{valor ?? 0}</Text>
  </Card>
);

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  contenedorCentrado: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  tarjetaPrincipal: {
    marginBottom: spacing.lg,
  },
  titulo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitulo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  filaEstado: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  etiquetaEstado: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontWeight: typography.weights.medium,
  },
  seccionTitulo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  fila: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tarjeta: {
    flex: 1,
    borderRadius: radii.md,
  },
  etiqueta: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  valor: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  texto: {
    textAlign: "center",
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    color: colors.textMuted,
  },
});
