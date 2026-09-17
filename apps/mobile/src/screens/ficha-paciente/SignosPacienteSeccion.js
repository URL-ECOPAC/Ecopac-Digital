import React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  estaFueraDeRango,
  formatearFechaCorta,
  ultimaMedicion,
  useEvolucionSignos,
} from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { Card, ErrorState, LoadingState } from "../../components";

function MedidaIndividual({ serie }) {
  if (serie.mediciones === 0) {
    return null;
  }

  const ultima = ultimaMedicion(serie);

  return (
    <View style={styles.medidaContenedor}>
      <Text style={styles.etiquetaSerie}>{serie.label}</Text>
      <View style={styles.valoresFila}>
        {serie.lineas
          .filter((linea) => linea.puntos.length > 0)
          .map((linea) => {
            const ultimoPunto = linea.puntos[linea.puntos.length - 1];
            const fueraRango = estaFueraDeRango(ultimoPunto.valor, linea.normal);

            return (
              <View key={linea.id} style={styles.valorItem}>
                <Text style={styles.lineaLabel}>{linea.label}: </Text>
                <Text style={[styles.valorTexto, fueraRango && styles.valorAlerta]}>
                  {ultimoPunto.valor} {serie.sufijo}
                </Text>
              </View>
            );
          })}
      </View>
      {ultima?.fecha && (
        <Text style={styles.fechaTexto}>Registrado el {formatearFechaCorta(ultima.fecha)}</Text>
      )}
    </View>
  );
}

export default function SignosPacienteSeccion({ pacienteId, rol }) {
  const { series, hayMediciones, cargando, error, recargar } = useEvolucionSignos(pacienteId, {
    rol,
  });

  if (cargando) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error.mensaje} onRetry={recargar} />;
  }

  return (
    <Card title="Signos vitales" style={styles.tarjeta}>
      {!hayMediciones ? (
        <Text style={styles.vacio}>Este paciente todavía no tiene signos vitales registrados.</Text>
      ) : (
        series.map((serie) => <MedidaIndividual key={serie.id} serie={serie} />)
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
  medidaContenedor: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight ?? colors.border,
  },
  etiquetaSerie: {
    color: colors.text,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: 2,
  },
  valoresFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  valorItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  lineaLabel: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
  },
  valorTexto: {
    color: colors.text,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  valorAlerta: {
    color: colors.danger ?? colors.danger,
    fontWeight: typography.weights.bold,
  },
  fechaTexto: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs ?? 12,
    marginTop: 2,
  },
});
