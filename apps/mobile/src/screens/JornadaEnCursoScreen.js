import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import {
  ETAPAS_DE_COLA,
  NOMBRES_DE_ETAPA,
  ORDEN_DE_ETAPAS,
  minutosEsperando,
  usePanelJornada,
} from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
} from "../components";
import { useJornadaActivaCompartida } from "../contexto/JornadaActivaProvider";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";

const ETAPAS_CON_CIERRE = new Set([
  ETAPAS_DE_COLA.ESPERA_ENTREGA,
  ETAPAS_DE_COLA.LISTA_PARA_CERRAR,
]);

function Contador({ etiqueta, valor }) {
  return (
    <View style={styles.contador}>
      <Text style={styles.contadorValor}>{valor === null ? "—" : valor}</Text>
      <Text style={styles.contadorEtiqueta}>{etiqueta}</Text>
    </View>
  );
}

function FilaDeCola({ fila, accionable, onPress }) {
  const nombre = [fila.nombres, fila.apellidos].filter(Boolean).join(" ") || "Paciente";
  const minutos = minutosEsperando(fila.esperandoDesde);

  const contenido = (
    <View style={styles.filaContenido}>
      <Text style={styles.filaNombre}>{nombre}</Text>
      <Text style={styles.filaEspera}>
        {minutos === null ? "Esperando" : `Esperando ${minutos} min`}
      </Text>
    </View>
  );

  if (!accionable) {
    return <View style={styles.fila}>{contenido}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fila, pressed && styles.filaPresionada]}
      accessibilityRole="button"
    >
      {contenido}
    </Pressable>
  );
}

export default function JornadaEnCursoScreen() {
  const navigation = useNavigation();
  const { rol } = useSesionCompartida();
  const {
    jornadaId,
    jornada,
    cola,
    totalEnCola,
    puedeRegistrar,
    motivoBloqueo,
    cargando,
    cargandoCola,
    error: errorDeCola,
    recargar: recargarCola,
  } = useJornadaActivaCompartida();

  const {
    pacientesRegistrados,
    consultasRealizadas,
    tratamientosEntregados,
    puedeCerrar,
    error: errorDePanel,
    recargar: recargarPanel,
    cerrar,
  } = usePanelJornada({ jornadaId, rol });

  const recargarTodo = useCallback(() => {
    recargarCola();
    recargarPanel();
  }, [recargarCola, recargarPanel]);

  // Criterio 4: se actualiza al volver de otra pantalla (por ejemplo, tras registrar un triaje
  // en la pantalla hermana del tab Pacientes y volver aca).
  useFocusEffect(
    useCallback(() => {
      recargarTodo();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jornadaId]),
  );

  const irARegistroDePaciente = () =>
    navigation.navigate(ROUTES.TAB_PACIENTES, { screen: ROUTES.REGISTRO_PACIENTE });

  const irATriaje = (pacienteId) =>
    navigation.navigate(ROUTES.TAB_PACIENTES, { screen: ROUTES.TRIAJE, params: { pacienteId } });

  const irAConsulta = (pacienteId) =>
    navigation.navigate(ROUTES.TAB_PACIENTES, { screen: ROUTES.CONSULTA, params: { pacienteId } });

  const cerrarFila = async (atencionId) => {
    await cerrar(atencionId, "Entrega completada");
    recargarTodo();
  };

  const accionDeEtapa = (etapa) => {
    if (etapa === ETAPAS_DE_COLA.ESPERA_TRIAJE) return (fila) => irATriaje(fila.pacienteId);
    if (etapa === ETAPAS_DE_COLA.ESPERA_CONSULTA) return (fila) => irAConsulta(fila.pacienteId);
    if (ETAPAS_CON_CIERRE.has(etapa) && puedeCerrar) {
      return (fila) => cerrarFila(fila.atencionId);
    }
    return null;
  };

  if (cargando) {
    return (
      <ScreenContainer scrollable={false}>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (!jornadaId) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState
          message={
            motivoBloqueo ?? "No hay una jornada activa. Elegila en la pantalla de Jornadas."
          }
        />
      </ScreenContainer>
    );
  }

  const error = errorDeCola ?? errorDePanel;

  return (
    <ScreenContainer>
      <Text style={styles.titulo}>{jornada?.nombre ?? "Jornada en curso"}</Text>

      {!puedeRegistrar && motivoBloqueo && (
        <Card style={styles.avisoBloqueo}>
          <Text style={styles.textoBloqueo}>{motivoBloqueo}</Text>
        </Card>
      )}

      {error && <ErrorState message={error.mensaje} onRetry={recargarTodo} />}

      <View style={styles.contadores}>
        <Contador etiqueta="Registrados" valor={pacientesRegistrados} />
        <Contador etiqueta="Consultas" valor={consultasRealizadas} />
        <Contador etiqueta="Entregas" valor={tratamientosEntregados} />
      </View>

      <View style={styles.acciones}>
        <PrimaryButton
          title="Registrar paciente"
          onPress={irARegistroDePaciente}
          disabled={!puedeRegistrar}
          style={styles.accion}
        />
        <SecondaryButton
          title={cargandoCola ? "Actualizando..." : "Actualizar"}
          onPress={recargarTodo}
          disabled={cargandoCola}
          style={styles.accion}
        />
      </View>

      {totalEnCola === 0 && !cargandoCola ? (
        <EmptyState message="No hay pacientes en la cola de esta jornada." />
      ) : (
        ORDEN_DE_ETAPAS.map((etapa) => {
          const filas = cola[etapa] ?? [];
          const accion = accionDeEtapa(etapa);

          return (
            <View key={etapa} style={styles.grupo}>
              <Text style={styles.grupoTitulo}>
                {NOMBRES_DE_ETAPA[etapa]} ({filas.length})
              </Text>
              {filas.length === 0 ? (
                <Text style={styles.grupoVacio}>Nadie en esta etapa.</Text>
              ) : (
                filas.map((fila) => (
                  <FilaDeCola
                    key={fila.atencionId}
                    fila={fila}
                    accionable={Boolean(accion)}
                    onPress={accion ? () => accion(fila) : undefined}
                  />
                ))
              )}
            </View>
          );
        })
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  titulo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  avisoBloqueo: {
    marginBottom: spacing.sm,
    borderColor: colors.warning,
  },
  textoBloqueo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.warning,
  },
  contadores: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  contador: {
    flex: 1,
    alignItems: "center",
  },
  contadorValor: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  contadorEtiqueta: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  acciones: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  accion: {
    flex: 1,
  },
  grupo: {
    marginBottom: spacing.md,
  },
  grupoTitulo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  grupoVacio: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  fila: {
    minHeight: 48,
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filaPresionada: {
    opacity: 0.85,
  },
  filaContenido: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filaNombre: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    color: colors.text,
    flexShrink: 1,
  },
  filaEspera: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
});
