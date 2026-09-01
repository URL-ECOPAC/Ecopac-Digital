import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import {
  ESTADOS_JORNADA,
  ETIQUETAS_ESTADO_JORNADA,
  formatearFechaCorta,
  useJornadasAsignadas,
} from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  ScreenContainer,
  StatusChip,
  Tabs,
} from "../components";
import { useJornadaActivaCompartida } from "../contexto/JornadaActivaProvider";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";

const PESTANAS = [
  { id: "proximas", label: "Proximas" },
  { id: "pasadas", label: "Pasadas" },
];

function FilaDeJornada({ jornada, onPress }) {
  const horario =
    jornada.horaInicio && jornada.horaFin ? `${jornada.horaInicio} – ${jornada.horaFin}` : null;
  const esEnCurso = jornada.estado === ESTADOS_JORNADA.EN_CURSO;
  // Se muestra el estado siempre que no sea el default "va a pasar" de una asignacion sin
  // novedad: una PLANIFICADA no necesita chip (es lo esperado), pero EN_CURSO, FINALIZADA y
  // CANCELADA si, para que una cancelada nunca se confunda con una que si se realizo (correccion
  // 4 de PLAN.md: separarProximasYPasadas() ya saca las canceladas de "proximas", esto evita que
  // se confundan tambien dentro de "pasadas").
  const muestraEstado = jornada.estado !== ESTADOS_JORNADA.PLANIFICADA;

  return (
    <Card style={styles.tarjeta} onPress={esEnCurso ? () => onPress(jornada) : undefined}>
      {muestraEstado && (
        <View style={styles.chip}>
          <StatusChip status={jornada.estado} label={ETIQUETAS_ESTADO_JORNADA[jornada.estado]} />
        </View>
      )}
      <Text style={styles.nombre}>{jornada.nombre}</Text>
      <Text style={styles.dato}>{formatearFechaCorta(jornada.fecha)}</Text>
      <Text style={styles.dato}>{jornada.comunidad?.nombre ?? "Comunidad sin definir"}</Text>
      {horario && <Text style={styles.dato}>{horario}</Text>}
      {jornada.responsabilidad && <Text style={styles.dato}>{jornada.responsabilidad}</Text>}
      {esEnCurso && <Text style={styles.enCurso}>Toca para ir al panel de trabajo</Text>}
    </Card>
  );
}

export default function JornadasAsignadasScreen() {
  const navigation = useNavigation();
  const { perfil } = useSesionCompartida();
  const { seleccionarJornada } = useJornadaActivaCompartida();
  const { proximas, pasadas, cargando, error, recargar } = useJornadasAsignadas({
    perfilId: perfil?.id,
  });

  const [pestana, setPestana] = useState("proximas");
  const jornadas = pestana === "proximas" ? proximas : pasadas;

  const entrarAlPanel = async (jornada) => {
    await seleccionarJornada(jornada.id);
    navigation.navigate(ROUTES.JORNADA_EN_CURSO);
  };

  if (error) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Tabs tabs={PESTANAS} activo={pestana} onChange={setPestana}>
        {cargando ? (
          <LoadingState />
        ) : jornadas.length === 0 ? (
          <EmptyState
            message={
              pestana === "proximas"
                ? "No tenes jornadas proximas asignadas."
                : "No tenes jornadas pasadas."
            }
          />
        ) : (
          <View>
            {jornadas.map((jornada) => (
              <FilaDeJornada key={jornada.id} jornada={jornada} onPress={entrarAlPanel} />
            ))}
          </View>
        )}
      </Tabs>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    marginBottom: spacing.sm,
  },
  chip: {
    marginBottom: spacing.xs,
  },
  nombre: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  dato: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  enCurso: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
});
