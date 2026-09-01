import { StyleSheet, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { mensajeSinJornada } from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryButton,
  ScreenContainer,
} from "../components";
import { useJornadaActivaCompartida } from "../contexto/JornadaActivaProvider";
import { ROUTES } from "../navigation/rutas";

export default function SeleccionJornadaScreen() {
  const navigation = useNavigation();
  const {
    jornadasEnCurso,
    jornadasAsignadas,
    jornadaId,
    cargando,
    error,
    seleccionarJornada,
    recargar,
  } = useJornadaActivaCompartida();

  if (cargando) {
    return (
      <ScreenContainer scrollable={false}>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  const mensaje = mensajeSinJornada(jornadasAsignadas, jornadasEnCurso);

  return (
    <ScreenContainer>
      {mensaje ? (
        <EmptyState message={mensaje} />
      ) : (
        <>
          {jornadasEnCurso.length === 1 && (
            <Text style={styles.aviso}>Trabajando en: {jornadasEnCurso[0].nombre}</Text>
          )}
          {jornadasEnCurso.length > 1 && (
            <Text style={styles.aviso}>Elegi en que jornada estas trabajando ahora.</Text>
          )}

          {jornadasEnCurso.map((jornada) => (
            <Card key={jornada.id} style={styles.tarjeta}>
              <Text style={styles.nombre}>{jornada.nombre}</Text>
              <Text style={styles.detalle}>{jornada.comunidad?.nombre ?? ""}</Text>
              <PrimaryButton
                title={jornada.id === jornadaId ? "Trabajando aqui" : "Trabajar aqui"}
                onPress={() => seleccionarJornada(jornada.id)}
                disabled={jornada.id === jornadaId}
                style={styles.boton}
              />
            </Card>
          ))}
        </>
      )}

      <PrimaryButton
        title="Ver mis jornadas asignadas"
        onPress={() => navigation.navigate(ROUTES.JORNADAS_ASIGNADAS)}
        style={styles.verMas}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  aviso: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: spacing.md,
  },
  tarjeta: {
    marginBottom: spacing.sm,
  },
  nombre: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  detalle: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  boton: {
    marginTop: spacing.xs,
  },
  verMas: {
    marginTop: spacing.md,
  },
});
