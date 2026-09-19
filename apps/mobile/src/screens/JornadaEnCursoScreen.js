import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import ResumenJornadaScreen from "../screens/ResumenJornadaScreen";

import { pacientesDeLaJornada, usePanelJornada } from "@ecopac/shared";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";

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

// LAS COLAS SE RETIRAN (issue #840, bloque F).
//
// Esta pantalla mostraba a los pacientes agrupados en colas -espera triaje, espera consulta,
// espera entrega, lista para cerrar- para moverlos de una etapa a otra. Con la consulta como
// unidad ya no hay etapas que recorrer: se abre la ficha y se pulsa "Nueva consulta", y dentro van
// los signos, la consulta y la receta. El usuario las senalo aparte como sobrantes.
//
// Se retiran de la INTERFAZ, no de la base: vista_cola_jornada sigue existiendo (corregida en la
// 00135 para los signos opcionales) por si una jornada grande necesita volver a saber quien espera.
// Lo que queda es la lista de los pacientes de la jornada, que es lo que hace falta para volver a
// abrir a alguien.

function Contador({ etiqueta, valor }) {
  return (
    <View style={styles.contador}>
      <Text style={styles.contadorValor}>{valor === null ? "—" : valor}</Text>
      <Text style={styles.contadorEtiqueta}>{etiqueta}</Text>
    </View>
  );
}

function FilaDePaciente({ fila, onPress }) {
  const nombre = [fila.nombres, fila.apellidos].filter(Boolean).join(" ") || "Paciente";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fila, pressed && styles.filaPresionada]}
      accessibilityRole="button"
      accessibilityHint="Abre la ficha del paciente"
    >
      <View style={styles.filaContenido}>
        <Text style={styles.filaNombre} numberOfLines={1}>
          {nombre}
        </Text>
        <Text style={styles.filaEspera}>Ver ficha</Text>
      </View>
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
    error: errorDePanel,
    recargar: recargarPanel,
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

  const irABusqueda = () =>
    navigation.navigate(ROUTES.TAB_PACIENTES, { screen: ROUTES.BUSQUEDA_PACIENTE });

  const irAFicha = (pacienteId) =>
    navigation.navigate(ROUTES.TAB_PACIENTES, {
      screen: ROUTES.FICHA_PACIENTE,
      params: { pacienteId },
    });

  const pacientes = pacientesDeLaJornada(cola);

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
      <ResumenJornadaScreen />

      {/* Llega un paciente: se busca, y si no esta, se registra. La consulta se abre desde su
          ficha (issue #840). */}
      <View style={styles.acciones}>
        <PrimaryButton title="Buscar paciente" onPress={irABusqueda} style={styles.accion} />
        <SecondaryButton
          title="Registrar paciente"
          onPress={irARegistroDePaciente}
          disabled={!puedeRegistrar}
          style={styles.accion}
        />
      </View>

      <View style={styles.grupo}>
        <View style={styles.grupoCabecera}>
          <Text style={styles.grupoTitulo}>Pacientes de esta jornada ({totalEnCola})</Text>
          <SecondaryButton
            title={cargandoCola ? "Actualizando..." : "Actualizar"}
            onPress={recargarTodo}
            disabled={cargandoCola}
          />
        </View>
        {totalEnCola === 0 && !cargandoCola ? (
          <EmptyState message="Todavía no hay pacientes atendidos en esta jornada." />
        ) : (
          pacientes.map((fila) => (
            <FilaDePaciente
              key={fila.atencionId}
              fila={fila}
              onPress={() => irAFicha(fila.pacienteId)}
            />
          ))
        )}
      </View>
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
  grupoCabecera: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginBottom: spacing.xs,
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
    borderRadius: radii.md,
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
