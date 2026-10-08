import { useState } from "react";
import { useRoute } from "@react-navigation/native";
import { StyleSheet, Text, View } from "react-native";
import {
  ESTADOS_JORNADA,
  ETIQUETAS_ESTADO_JORNADA,
  jornadaUsaBodegaPrincipal,
  motivoParaNoCargarBodega,
  puedeVerInsumosDeJornada,
  useDetalleJornada,
} from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { Card, ErrorState, LoadingState, ScreenContainer, StatusChip, Tabs } from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ConsumoDeJornada from "./ConsumoDeJornada";
import InsumosDeJornada from "./InsumosDeJornada";

const PESTANIAS = [
  { id: "resumen", label: "Resumen" },
  { id: "insumos", label: "Insumos" },
  { id: "consumo", label: "Consumo" },
];

/**
 * Detalle de una jornada en movil (issue #925): version acotada de
 * apps/web/src/pages/DetalleJornadaPage.jsx -solo Resumen, Insumos y Consumo, que es lo que el
 * personal de campo necesita en el telefono. Equipo, Pacientes atendidos, Historial, Presupuesto,
 * Gastos y Cierre siguen siendo exclusivos de la web (no tienen pantalla movil, docs/MODULOS.md).
 *
 * Reutiliza useDetalleJornada() tal cual lo usa la web: mismo hook, mismo shape de jornada
 * (jornada.proyecto, jornada.botiquinBodega ya vienen embebidos, COLUMNAS_DE_JORNADA).
 *
 * Llega desde KanbanJornadasScreen.js (tocar una tarjeta) con { jornadaId }: antes navegaba a una
 * ruta "DetalleJornada" que no existia en ningun lado del stack movil.
 */
export default function DetalleJornadaScreen() {
  const { params } = useRoute();
  const jornadaId = params?.jornadaId;
  const { rol } = useSesionCompartida();

  const { jornada, cargando, error, recargar } = useDetalleJornada({ jornadaId, rol });
  const [pestaniaActiva, setPestaniaActiva] = useState("resumen");

  if (cargando && !jornada) {
    return (
      <ScreenContainer>
        <LoadingState message="Cargando la jornada..." />
      </ScreenContainer>
    );
  }

  if (error && !jornada) {
    return (
      <ScreenContainer>
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  if (!jornada) {
    return (
      <ScreenContainer>
        <ErrorState message="No se encontró la jornada." />
      </ScreenContainer>
    );
  }

  const puedeVerInsumos = puedeVerInsumosDeJornada(rol);
  const pestanias = PESTANIAS.filter((pestania) => pestania.id === "resumen" || puedeVerInsumos);
  const pestaniaMostrada = pestanias.some((p) => p.id === pestaniaActiva)
    ? pestaniaActiva
    : pestanias[0].id;

  const usaBodegaPrincipal = jornadaUsaBodegaPrincipal(jornada);
  const bodega = jornada.botiquinBodegaId
    ? {
        id: jornada.botiquinBodegaId,
        nombre: jornada.botiquinBodega?.nombre ?? "",
        esPrincipal: usaBodegaPrincipal,
      }
    : null;
  const jornadaFinalizada = jornada.estado === ESTADOS_JORNADA.FINALIZADA;

  return (
    <ScreenContainer>
      <Text style={styles.titulo}>{jornada.nombre}</Text>
      {jornada.proyecto?.nombre ? (
        <Text style={styles.subtitulo}>Proyecto: {jornada.proyecto.nombre}</Text>
      ) : null}

      {error && <ErrorState message={error.mensaje} onRetry={recargar} />}

      <Tabs tabs={pestanias} activo={pestaniaMostrada} onChange={setPestaniaActiva}>
        {pestaniaMostrada === "resumen" && (
          <Card>
            <View style={styles.filaResumen}>
              <StatusChip
                status={jornada.estado}
                label={ETIQUETAS_ESTADO_JORNADA[jornada.estado]}
              />
            </View>
            <Dato etiqueta="Proyecto" valor={jornada.proyecto?.nombre} />
            <Dato etiqueta="Bodega" valor={jornada.botiquinBodega?.nombre} />
          </Card>
        )}

        {pestaniaMostrada === "insumos" && (
          <InsumosDeJornada
            jornadaId={jornada.id}
            bodega={bodega}
            rol={rol}
            soloConsulta={jornadaFinalizada}
            motivoSinCarga={motivoParaNoCargarBodega(jornada)}
          />
        )}

        {pestaniaMostrada === "consumo" && (
          <ConsumoDeJornada
            jornadaId={jornada.id}
            rol={rol}
            usaBodegaPrincipal={usaBodegaPrincipal}
          />
        )}
      </Tabs>
    </ScreenContainer>
  );
}

function Dato({ etiqueta, valor }) {
  return (
    <View style={styles.dato}>
      <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
      <Text style={styles.datoValor}>{valor ?? "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: spacing.sm,
  },
  filaResumen: {
    marginBottom: spacing.sm,
  },
  dato: {
    marginBottom: spacing.sm,
  },
  datoEtiqueta: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  datoValor: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    color: colors.text,
    marginTop: spacing.xs / 2,
  },
});
