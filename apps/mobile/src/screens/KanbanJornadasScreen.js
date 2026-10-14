import { useState } from "react";
import { View, Text, StyleSheet, RefreshControl, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  ESTADOS_JORNADA,
  ETIQUETAS_ESTADO_JORNADA,
  formatearFechaCorta,
  transicionesDeJornadaDesde,
  useJornadasKanban,
} from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  ErrorState,
  KanbanBoard,
  LoadingState,
  PrimaryButton,
  SecondaryButton,
  StatusChip,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";

/**
 * Tarjeta de una jornada en el tablero. Espejo (acotado) de TarjetaJornada en
 * apps/web/src/pages/JornadasPage.jsx: sin "Editar" (crear/editar jornada sigue siendo exclusivo
 * de la web) y sin botones de mover -en movil mover una tarjeta es mantenerla presionada
 * (KanbanBoard.js, issue #840), no un boton, para no ocupar espacio en la tarjeta.
 */
function TarjetaJornada({ jornada, puedeReabrir, moviendo, onMover, onVerDetalle }) {
  const esReapertura = jornada.estado === ESTADOS_JORNADA.FINALIZADA;
  const [confirmandoReapertura, setConfirmandoReapertura] = useState(false);
  const [destino] = transicionesDeJornadaDesde(jornada.estado);
  const puedeMover = esReapertura && puedeReabrir && Boolean(destino);

  return (
    <Card style={estilos.tarjeta}>
      <View style={estilos.filaSuperior}>
        <Text style={estilos.nombre} numberOfLines={2}>
          {jornada.nombre}
        </Text>
        <StatusChip status={jornada.estado} label={ETIQUETAS_ESTADO_JORNADA[jornada.estado]} />
      </View>

      <Text style={estilos.detalle}>
        {jornada.comunidad || "Sin comunidad"} · {formatearFechaCorta(jornada.fecha)}
      </Text>
      <Text style={estilos.detalle}>Responsable: {jornada.responsable || "Sin asignar"}</Text>
      {Object.prototype.hasOwnProperty.call(jornada, "pacientesAtendidos") && (
        <Text style={estilos.detalle}>
          Pacientes atendidos: {jornada.pacientesAtendidos}
          {typeof jornada.cupoEstimado === "number" && jornada.cupoEstimado > 0
            ? `/${jornada.cupoEstimado}`
            : ""}
        </Text>
      )}

      {confirmandoReapertura ? (
        <View>
          <Text style={estilos.avisoReapertura}>
            ¿Reabrir la jornada? Vuelve a quedar en curso.
          </Text>
          <View style={estilos.filaBotones}>
            <PrimaryButton
              title="Reabrir"
              loading={moviendo}
              onPress={() => {
                setConfirmandoReapertura(false);
                onMover(jornada.id, jornada.estado, destino);
              }}
              style={estilos.boton}
            />
            <SecondaryButton
              title="Cancelar"
              onPress={() => setConfirmandoReapertura(false)}
              disabled={moviendo}
              style={estilos.boton}
            />
          </View>
        </View>
      ) : (
        <View style={estilos.filaBotones}>
          <SecondaryButton
            title="Ver detalle"
            onPress={onVerDetalle}
            disabled={moviendo}
            style={estilos.boton}
          />
          {puedeMover && (
            <SecondaryButton
              title="Reabrir"
              onPress={() => setConfirmandoReapertura(true)}
              disabled={moviendo}
              style={estilos.boton}
            />
          )}
        </View>
      )}
    </Card>
  );
}

export default function KanbanJornadasScreen() {
  const navigation = useNavigation();
  const { rol } = useSesionCompartida();
  const {
    cargando,
    error,
    columnas,
    recargar,
    puedeEditar,
    puedeReabrir,
    moverJornada,
    moviendo,
    errorMovimiento,
    descartarErrorMovimiento,
  } = useJornadasKanban(rol);

  const verDetalle = (jornada) => {
    navigation.navigate(ROUTES.DETALLE_JORNADA, { jornadaId: jornada.id, titulo: jornada.nombre });
  };

  return (
    <ScrollView
      style={estilos.contenedor}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={recargar} />}
    >
      <View style={estilos.cabecera}>
        <Text style={estilos.titulo}>Tablero de Jornadas</Text>
        <Text style={estilos.subtitulo}>Mantén presionada una tarjeta para cambiar su etapa</Text>
      </View>

      {cargando && <LoadingState message="Cargando tablero..." />}
      {error && <ErrorState message={error.mensaje} onRetry={recargar} />}

      {/* Issue #925: el mensaje dice por que no se pudo mover (p. ej. la bodega ya esta en otra
          jornada en curso, y dice cual). Antes se perdia: nada en pantalla lo mostraba. */}
      {errorMovimiento && (
        <Card style={estilos.avisoMovimiento}>
          <Text style={estilos.textoAvisoMovimiento}>{errorMovimiento.mensaje}</Text>
          <SecondaryButton
            title="Descartar"
            onPress={descartarErrorMovimiento}
            style={estilos.botonDescartar}
          />
        </Card>
      )}

      {!cargando && !error && (
        <KanbanBoard
          columnas={columnas}
          onMover={puedeEditar ? moverJornada : undefined}
          mensajeVacio="Sin jornadas"
          columnaAtenuada={(id) => id === ESTADOS_JORNADA.CANCELADA}
          renderTarjeta={(tarjeta) => (
            <TarjetaJornada
              jornada={tarjeta}
              puedeReabrir={puedeReabrir}
              moviendo={moviendo}
              onMover={moverJornada}
              onVerDetalle={() => verDetalle(tarjeta)}
            />
          )}
        />
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.background,
  },
  cabecera: {
    marginBottom: 16,
  },
  titulo: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  subtitulo: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  avisoMovimiento: {
    marginBottom: spacing.md,
    borderColor: colors.danger,
    gap: spacing.sm,
  },
  textoAvisoMovimiento: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.danger,
  },
  botonDescartar: {
    alignSelf: "flex-start",
  },
  tarjeta: {
    width: 250,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  filaSuperior: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  nombre: {
    flex: 1,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  detalle: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  filaBotones: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  boton: {
    flex: 1,
  },
  avisoReapertura: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.warning,
    marginBottom: spacing.xs,
  },
});
