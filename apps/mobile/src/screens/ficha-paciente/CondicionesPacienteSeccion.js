import React from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import {
  ESTADOS_CONDICION_CRONICA,
  ETIQUETAS_ESTADO_CONDICION,
  useCondicionesPaciente,
} from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { Card, ErrorState, LoadingState, SecondaryButton, StatusChip } from "../../components";

/**
 * Condiciones cronicas del paciente, en la ficha movil (issue #818).
 *
 * DOS IMPORTS QUE NO EXISTIAN
 *
 * Este componente importaba `useCondicionesCronicas` y `actualizarCondicionCronica`. **Ninguno de
 * los dos existe en packages/shared**, y no es que se hubieran dejado de exportar: nunca se
 * escribieron. El primero llegaba `undefined`, y un
 * `typeof useCondicionesCronicas === "function" ? ... : () => ({ condiciones: [] })` lo convertia
 * en una lista vacia PARA SIEMPRE -sin error, sin aviso, sin log-. El segundo habria reventado al
 * pulsar "Resolver", que es la unica accion de la pantalla.
 *
 * El hook de verdad es `useCondicionesPaciente(pacienteId, { rol })`, que ya existia, ya trae los
 * permisos resueltos por `condiciones.permisos.js` y ya expone `marcarResuelta`. La guarda con
 * `typeof` se retira: un export que falta tiene que reventar el import, no hacer mentir a la
 * pantalla. Ademas era una llamada condicional a un hook, que las reglas de hooks prohiben.
 */
export default function CondicionesPacienteSeccion({ pacienteId, rol, alActualizar }) {
  const { condiciones, cargando, error, enviando, permisos, marcarResuelta, recargar } =
    useCondicionesPaciente(pacienteId, { rol });

  const manejarResolver = (condicion) => {
    const nombre = condicion.condicion ?? "esta condicion";
    Alert.alert("Resolver condición", `¿Deseas marcar "${nombre}" como resuelta?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Resolver",
        onPress: async () => {
          const { ok } = await marcarResuelta(condicion.id);

          if (!ok) {
            Alert.alert("Error", "No se pudo resolver la condición. Intentalo de nuevo.");
            return;
          }

          alActualizar?.();
        },
      },
    ]);
  };

  if (cargando || enviando) {
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
                  // La etiqueta del estado, no la clave del enum: el chip decia "activa" y
                  // "resuelta" en minusculas, que es como lo guarda la base, no como se lee
                  // (issue #838). Sale de ETIQUETAS_ESTADO_CONDICION, igual que en la web.
                  label={`${item.condicion ?? "Sin nombre"} · ${
                    ETIQUETAS_ESTADO_CONDICION[item.estado] ?? item.estado
                  }`}
                />
                {item.notas ? <Text style={styles.notas}>{item.notas}</Text> : null}
              </View>

              {permisos.puedeQuitar && item.estado !== ESTADOS_CONDICION_CRONICA.RESUELTA && (
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
    borderBottomColor: colors.border,
  },
  infoCondicion: {
    flex: 1,
    marginRight: spacing.xs,
  },
  notas: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  botonAccion: {
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
  },
});
