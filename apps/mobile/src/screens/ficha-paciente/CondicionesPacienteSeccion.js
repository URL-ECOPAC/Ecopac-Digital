import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import {
  actualizarCondicionCronica,
  ESTADOS_CONDICION_CRONICA,
  useCondicionesCronicas,
} from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  ErrorState,
  LoadingState,
  SecondaryButton,
  StatusChip,
} from "../../components";

export default function CondicionesPacienteSeccion({ pacienteId, rol, alActualizar }) {
  // Verificación de seguridad por si el hook no está exportado en @ecopac/shared
  const obtenerCondiciones = typeof useCondicionesCronicas === "function" 
    ? useCondicionesCronicas 
    : () => ({ condiciones: [], cargando: false, error: null, recargar: () => {} });

  const { condiciones = [], cargando = false, error = null, recargar = () => {} } = obtenerCondiciones(pacienteId);
  const [guardando, setGuardando] = useState(false);

  const puedeEditar = rol === "medico" || rol === "administrador";

  const manejarResolver = (condicion) => {
    Alert.alert(
      "Resolver condición",
      `¿Deseas marcar "${condicion.nombre}" como resuelta?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Resolver",
          onPress: async () => {
            setGuardando(true);
            const { error: errorApi } = await actualizarCondicionCronica(condicion.id, {
              estado: ESTADOS_CONDICION_CRONICA.RESUELTA,
            });
            setGuardando(false);

            if (errorApi) {
              Alert.alert("Error", errorApi.mensaje);
            } else {
              recargar();
              if (alActualizar) alActualizar();
            }
          },
        },
      ]
    );
  };

  if (cargando || guardando) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error.mensaje} onRetry={recargar} />;
  }

  return (
    <Card title="Condiciones crónicas" style={styles.tarjeta}>
      {!condiciones || condiciones.length === 0 ? (
        <Text style={styles.vacio}>Sin condiciones crónicas registradas.</Text>
      ) : (
        <View style={styles.lista}>
          {condiciones.map((item) => (
            <View key={item.id} style={styles.filaCondicion}>
              <View style={styles.infoCondicion}>
                <StatusChip
                  status={item.estado}
                  label={`${item.nombre} · ${item.etiquetaEstado ?? item.estado}`}
                />
                {item.notas ? <Text style={styles.notas}>{item.notas}</Text> : null}
              </View>

              {puedeEditar && item.estado !== ESTADOS_CONDICION_CRONICA.RESUELTA && (
                <SecondaryButton
                  title="Resolver"
                  onPress={() => manejarResolver(item)}
                  style={styles.botonAccion}
                />
              )}
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    marginBottom: spacing.sm,
  },
  vacio: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
  },
  lista: {
    gap: spacing.xs,
  },
  filaCondicion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight ?? "#E5E7EB",
  },
  infoCondicion: {
    flex: 1,
    marginRight: spacing.xs,
  },
  notas: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs ?? 12,
    marginTop: 2,
  },
  botonAccion: {
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
  },
});