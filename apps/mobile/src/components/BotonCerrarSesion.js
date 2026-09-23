import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { useRegistroSinGuardar } from "../contexto/RegistroSinGuardarProvider";
import { useSesionCompartida } from "../contexto/SesionProvider";
import IconoDeModulo from "./IconoDeModulo";
import Modal from "./Modal";
import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";

export default function BotonCerrarSesion() {
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
    <>
      <Pressable
        onPress={pedirCierre}
        accessibilityRole="button"
        accessibilityLabel="Cerrar sesión"
        hitSlop={spacing.sm}
        style={estilos.boton}
      >
        <IconoDeModulo nombre="LogOut" color={colors.secondary} size={22} />
      </Pressable>

      <Modal visible={confirmando} onClose={() => setConfirmando(false)}>
        <Text style={estilos.tituloModal}>Hay cambios sin guardar</Text>
        <Text style={estilos.textoModal}>
          Si cierras sesión ahora se perderán los cambios hechos.
        </Text>
        <View style={estilos.accionesModal}>
          <SecondaryButton
            title="Seguir editando"
            onPress={() => setConfirmando(false)}
            style={estilos.botonModal}
          />
          <PrimaryButton
            title="Cerrar sesión sin guardar"
            onPress={cerrarSinGuardar}
            style={estilos.botonModal}
          />
        </View>
      </Modal>
    </>
  );
}

const estilos = StyleSheet.create({
  boton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  tituloModal: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  textoModal: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.md,
  },
  accionesModal: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  botonModal: {
    flex: 1,
  },
});
