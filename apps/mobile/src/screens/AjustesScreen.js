import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import {
  Modal,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  UsuarioActivo,
} from "../components";
import { useRegistroSinGuardar } from "../contexto/RegistroSinGuardarProvider";
import { useSesionCompartida } from "../contexto/SesionProvider";

export default function AjustesScreen() {
  const { logout } = useSesionCompartida();
  const { hayAlgoSinGuardar } = useRegistroSinGuardar();
  const [confirmando, setConfirmando] = useState(false);

  const pedirCierre = () => {
    if (hayAlgoSinGuardar()) {
      setConfirmando(true);
      return;
    }
    logout();
  };

  const cerrarSinGuardar = () => {
    setConfirmando(false);
    logout();
  };

  return (
    <ScreenContainer>
      <View style={styles.contenido}>
        <Text style={styles.titulo}>Ajustes</Text>
        <UsuarioActivo compacto={false} />
        <PrimaryButton title="Cerrar sesión" onPress={pedirCierre} />
      </View>

      <Modal
        visible={confirmando}
        onClose={() => setConfirmando(false)}
        title="Hay cambios sin guardar"
      >
        <Text style={styles.textoModal}>
          Si cerrás sesión ahora se pierden los cambios que hiciste en un formulario que todavía no
          guardaste.
        </Text>
        <View style={styles.accionesModal}>
          <SecondaryButton title="Seguir editando" onPress={() => setConfirmando(false)} />
          <PrimaryButton title="Cerrar sesión sin guardar" onPress={cerrarSinGuardar} />
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contenido: {
    gap: spacing.lg,
  },
  titulo: {
    color: colors.text,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  textoModal: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.text,
    marginBottom: spacing.md,
  },
  accionesModal: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});