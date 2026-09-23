import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CAMPOS_PRINCIPIO_ACTIVO } from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { Modal, PrimaryButton, SecondaryButton, TextField } from "../components";

function valoresDe(principioActivo) {
  return { nombre: principioActivo?.nombre ?? "" };
}

export default function ModalPrincipioActivo({
  visible,
  principioActivo,
  puedeEliminar = false,
  onClose,
  onGuardar,
  onEliminar,
}) {
  const [valores, setValores] = useState(() => valoresDe(principioActivo));
  const [error, setError] = useState(null);
  const [medicamentosEnUso, setMedicamentosEnUso] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const editando = Boolean(principioActivo?.id);

  useEffect(() => {
    setValores(valoresDe(principioActivo));
    setError(null);
    setMedicamentosEnUso(null);
  }, [principioActivo]);

  const guardar = async () => {
    setEnviando(true);
    setError(null);

    const resultado = await onGuardar(principioActivo?.id ?? null, valores);

    setEnviando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onClose?.();
  };

  const eliminar = async () => {
    setEnviando(true);
    setError(null);
    setMedicamentosEnUso(null);

    const resultado = await onEliminar(principioActivo.id);

    setEnviando(false);
    if (resultado.medicamentosEnUso) {
      setMedicamentosEnUso(resultado.medicamentosEnUso);
      return;
    }
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={editando ? "Editar principio activo" : "Nuevo principio activo"}
    >
      {error ? <Text style={estilos.error}>{error.mensaje}</Text> : null}

      {medicamentosEnUso ? (
        <View style={estilos.aviso}>
          <Text style={estilos.avisoTitulo}>No se puede eliminar: lo usan estos medicamentos.</Text>
          {medicamentosEnUso.map((medicamento) => (
            <Text key={medicamento.id} style={estilos.avisoItem}>
              · {medicamento.nombre}
            </Text>
          ))}
        </View>
      ) : null}

      {CAMPOS_PRINCIPIO_ACTIVO.map((campo) => (
        <TextField
          key={campo.id}
          label={campo.label}
          placeholder={campo.placeholder}
          maxLength={campo.validacion?.maxLongitud}
          value={valores[campo.id] ?? ""}
          onChangeText={(texto) =>
            setValores((anteriores) => ({ ...anteriores, [campo.id]: texto }))
          }
          editable={!enviando}
        />
      ))}

      <PrimaryButton
        title={editando ? "Guardar cambios" : "Crear"}
        onPress={guardar}
        loading={enviando}
        disabled={enviando}
        style={estilos.boton}
      />

      {editando && puedeEliminar ? (
        <SecondaryButton
          title="Eliminar"
          variant="peligro"
          onPress={eliminar}
          disabled={enviando}
          style={estilos.boton}
        />
      ) : null}

      <SecondaryButton
        title="Cancelar"
        onPress={onClose}
        disabled={enviando}
        style={estilos.boton}
      />
    </Modal>
  );
}

const estilos = StyleSheet.create({
  error: {
    color: colors.danger,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  aviso: {
    backgroundColor: `${colors.warning}1F`,
    borderRadius: spacing.xs,
    marginBottom: spacing.sm,
    padding: spacing.sm,
  },
  avisoTitulo: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  avisoItem: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  boton: {
    marginTop: spacing.sm,
  },
});
