import { StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

import {
  CAMPOS_FICHA_PACIENTE,
  cabeceraDePaciente,
  formatearFechaCorta,
  permisosDeFicha,
  resumenDeUltimaAtencion,
  textoDeCampoDeFicha,
  usePaciente,
  valoresDeFichaPaciente,
} from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  ErrorState,
  LoadingState,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  StatusChip,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";

function Dato({ etiqueta, valor }) {
  return (
    <View style={styles.dato}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <Text style={styles.valor}>{valor ?? "—"}</Text>
    </View>
  );
}

export default function FichaPacienteScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { rol } = useSesionCompartida();
  const pacienteId = params?.pacienteId;
  const { paciente, cargando, error, recargar } = usePaciente(pacienteId, { rol });

  if (cargando && !paciente) {
    return (
      <ScreenContainer scrollable={false}>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (error && !paciente) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  if (!paciente) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message="No se encontro el paciente." />
      </ScreenContainer>
    );
  }

  const cabecera = cabeceraDePaciente(paciente);
  const permisos = permisosDeFicha(rol);
  const ultima = permisos.puedeVerDatosClinicos ? resumenDeUltimaAtencion(paciente) : null;
  const valores = valoresDeFichaPaciente(paciente);

  return (
    <ScreenContainer>
      <Text style={styles.nombre}>{cabecera.nombreCompleto ?? "Paciente sin nombre"}</Text>
      <Text style={styles.subtitulo}>
        {[
          cabecera.numeroFicha ? `Ficha ${cabecera.numeroFicha}` : null,
          cabecera.edad,
          cabecera.comunidad,
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>

      {cabecera.condiciones.length > 0 && (
        <View style={styles.condiciones}>
          {cabecera.condiciones.map((condicion) => (
            <StatusChip
              key={condicion.id}
              status={condicion.estado}
              label={`${condicion.nombre} · ${condicion.etiquetaEstado}`}
            />
          ))}
        </View>
      )}

      {permisos.puedeVerDatosClinicos && (
        <Card title="Ultima atencion" style={styles.tarjeta}>
          {ultima ? (
            <>
              <Dato
                etiqueta="Fecha"
                valor={ultima.fecha ? formatearFechaCorta(ultima.fecha) : null}
              />
              <Dato etiqueta="Diagnostico" valor={ultima.diagnostico} />
              <Dato etiqueta="Jornada" valor={ultima.jornada} />
            </>
          ) : (
            <Text style={styles.vacio}>Sin atenciones registradas.</Text>
          )}
        </Card>
      )}

      {/* Debajo de la cabecera y de la ultima atencion a proposito: el criterio 4 de la #135
          pide que lo critico y los accesos quepan sin desplazarse en una pantalla de 5
          pulgadas, y trece campos no caben ahi arriba. */}
      <Card title="Datos generales" style={styles.tarjeta}>
        {CAMPOS_FICHA_PACIENTE.map((campo) => (
          <Dato key={campo.id} etiqueta={campo.label} valor={textoDeCampoDeFicha(campo, valores)} />
        ))}
      </Card>

      <View style={styles.acciones}>
        <PrimaryButton
          title="Registrar triaje"
          onPress={() => navigation.navigate(ROUTES.TRIAJE, { pacienteId })}
        />
        {permisos.puedeVerDatosClinicos && (
          <>
            <SecondaryButton
              title="Registrar consulta"
              onPress={() => navigation.navigate(ROUTES.CONSULTA, { pacienteId })}
              style={styles.accion}
            />
            <SecondaryButton
              title="Ver historial"
              onPress={() => navigation.navigate(ROUTES.HISTORIAL_PACIENTE, { pacienteId })}
              style={styles.accion}
            />
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  nombre: {
    color: colors.text,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  subtitulo: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  condiciones: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tarjeta: {
    marginBottom: spacing.sm,
  },
  dato: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  etiqueta: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
  },
  valor: {
    color: colors.text,
    fontSize: typography.sizes.sm,
    flexShrink: 1,
    textAlign: "right",
  },
  vacio: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
  },
  acciones: {
    marginTop: spacing.xs,
  },
  accion: {
    marginTop: spacing.sm,
  },
});
