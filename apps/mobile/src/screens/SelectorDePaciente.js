import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useBusquedaPacientes } from "@ecopac/shared";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";

import { EmptyState, ErrorState, LoadingState, SecondaryButton, TextField } from "../components";

/**
 * Elegir un paciente con el buscador de pacientes de siempre (useBusquedaPacientes). Espejo de
 * apps/web/src/pages/SelectorDePacienteCita.jsx, con sus mismas props; lo usa la salida de
 * inventario a un paciente sin consulta (issue #964).
 *
 * @param {{ paciente: object|null, onElegir: (paciente: object|null) => void, error?: string,
 *   disabled?: boolean }} props `paciente` es `{ id, nombre, numeroFicha }`.
 */
export default function SelectorDePaciente({ paciente, onElegir, error, disabled = false }) {
  const busqueda = useBusquedaPacientes({ porPagina: 8 });

  if (paciente) {
    return (
      <View style={styles.elegido}>
        <View style={styles.elegidoTexto}>
          <Text style={styles.rotulo}>Paciente</Text>
          <Text style={styles.nombre}>{paciente.nombre ?? "Paciente"}</Text>
          {paciente.numeroFicha ? <Text style={styles.detalle}>{paciente.numeroFicha}</Text> : null}
        </View>
        <SecondaryButton title="Cambiar" onPress={() => onElegir(null)} disabled={disabled} />
      </View>
    );
  }

  const conTermino = busqueda.termino.trim().length > 0;

  return (
    <View>
      <TextField
        label="Paciente"
        requerido
        placeholder="Nombre, número de ficha o DPI"
        value={busqueda.termino}
        onChangeText={busqueda.setTermino}
        error={error}
        editable={!disabled}
      />

      {busqueda.cargando ? <LoadingState message="Buscando pacientes..." /> : null}
      {busqueda.error ? <ErrorState message={busqueda.error.mensaje} /> : null}
      {busqueda.terminoDemasiadoCorto ? (
        <Text style={styles.detalle}>Escribe al menos tres letras del nombre.</Text>
      ) : null}

      {busqueda.resultados.map((resultado) => {
        const nombre = [resultado.nombres, resultado.apellidos].filter(Boolean).join(" ");
        return (
          <TouchableOpacity
            key={resultado.id}
            style={styles.resultado}
            accessibilityRole="button"
            onPress={() =>
              onElegir({ id: resultado.id, nombre, numeroFicha: resultado.numeroFicha })
            }
            disabled={disabled}
          >
            <Text style={styles.nombre}>{nombre}</Text>
            <Text style={styles.detalle}>
              {[resultado.numeroFicha, resultado.comunidad?.nombre].filter(Boolean).join(" · ")}
            </Text>
          </TouchableOpacity>
        );
      })}

      {conTermino &&
      !busqueda.cargando &&
      !busqueda.terminoDemasiadoCorto &&
      busqueda.resultados.length === 0 &&
      !busqueda.error ? (
        <EmptyState message="Ningún paciente coincide con la búsqueda." />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  elegido: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  elegidoTexto: {
    flex: 1,
  },
  rotulo: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
  },
  nombre: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  detalle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
  },
  resultado: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
});
