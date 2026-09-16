import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";
import { CAMPOS_PROYECTO, TIPOS_DE_CAMPO } from "@ecopac/shared";

import {
  DateField,
  Modal,
  PrimaryButton,
  SecondaryButton,
  Selector,
  TextField,
} from "../components";

function valoresDe(proyecto) {
  return CAMPOS_PROYECTO.reduce((valores, campo) => {
    valores[campo.id] = proyecto?.[campo.id] ?? "";
    return valores;
  }, {});
}

/**
 * Alta y edicion de un proyecto social en movil (issue #756). Espejo de
 * apps/web/src/pages/ModalProyecto.jsx: mismo hook compartido (guardarProyecto de
 * useProyectosSociales) y los mismos CAMPOS_PROYECTO.
 */
export default function ModalProyecto({ visible, proyecto, catalogos, onClose, onGuardar }) {
  const editando = Boolean(proyecto?.id);
  const [valores, setValores] = useState(() => valoresDe(proyecto));
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setValores(valoresDe(proyecto));
    setErrores({});
    setError(null);
  }, [proyecto]);

  const cambiar = (id, valor) => setValores((anteriores) => ({ ...anteriores, [id]: valor }));

  const guardar = async () => {
    setEnviando(true);
    setError(null);

    const resultado = await onGuardar(proyecto?.id ?? null, valores);

    setEnviando(false);
    if (!resultado.ok) {
      setErrores(resultado.errores ?? {});
      setError(resultado.error);
      return;
    }
    onClose?.();
  };

  const opcionesDe = (campo) =>
    campo.opciones ?? (campo.opcionesDesde ? (catalogos?.[campo.opcionesDesde] ?? []) : []);

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={editando ? "Editar proyecto" : "Nuevo proyecto"}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {error ? <Text style={styles.error}>{error.mensaje}</Text> : null}

        {CAMPOS_PROYECTO.map((campo) => {
          if (campo.tipo === TIPOS_DE_CAMPO.SELECT) {
            const opciones = opcionesDe(campo);
            return (
              <Selector
                key={campo.id}
                label={campo.label}
                value={valores[campo.id] || null}
                options={opciones}
                onSelect={(valor) => cambiar(campo.id, valor)}
                error={errores[campo.id]}
                disabled={enviando}
              />
            );
          }

          if (campo.tipo === TIPOS_DE_CAMPO.FECHA) {
            return (
              <DateField
                key={campo.id}
                label={campo.label}
                value={valores[campo.id] || null}
                onChange={(valor) => cambiar(campo.id, valor)}
                error={errores[campo.id]}
                disabled={enviando}
              />
            );
          }

          return (
            <TextField
              key={campo.id}
              label={campo.label}
              value={valores[campo.id] ?? ""}
              onChangeText={(texto) => cambiar(campo.id, texto)}
              multiline={campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO}
              numberOfLines={campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO ? 3 : undefined}
              maxLength={campo.validacion?.maxLongitud}
              error={errores[campo.id]}
              editable={!enviando}
            />
          );
        })}

        <PrimaryButton
          title={editando ? "Guardar cambios" : "Crear proyecto"}
          onPress={guardar}
          loading={enviando}
          disabled={!valores.nombre}
          style={styles.boton}
        />
        <SecondaryButton
          title="Cancelar"
          onPress={onClose}
          disabled={enviando}
          style={styles.boton}
        />
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  error: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  boton: {
    marginTop: spacing.sm,
  },
});
