import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";
import { etiquetaDeRol } from "@ecopac/shared";

import PrimaryButton from "../components/PrimaryButton";
import ScreenContainer from "../components/ScreenContainer";
import { useSesionCompartida } from "../contexto/SesionProvider";

export default function AppSoloParaCampoScreen() {
  const { perfil, logout } = useSesionCompartida();

  return (
    <ScreenContainer contentContainerStyle={estilos.contenido}>
      <View style={estilos.tarjeta}>
        <View style={estilos.icono}>
          <Ionicons name="phone-portrait-outline" size={32} color={colors.primary} />
        </View>

        <Text style={estilos.titulo}>Esta aplicación es para el equipo en jornada</Text>

        <Text style={estilos.parrafo}>
          La aplicación del teléfono sirve para atender pacientes y mover medicamentos durante una
          jornada. Tu cuenta
          {perfil?.rol ? ` de ${etiquetaDeRol(perfil.rol).toLowerCase()}` : ""} trabaja con
          donaciones, presupuestos, proyectos y reportes, y todo eso está en la versión de
          computadora.
        </Text>

        <Text style={estilos.parrafo}>
          Entra desde una computadora con el mismo correo y la misma contraseña para ver tu
          información completa.
        </Text>

        <PrimaryButton title="Cerrar sesión" onPress={logout} style={estilos.boton} />
      </View>
    </ScreenContainer>
  );
}

const estilos = StyleSheet.create({
  contenido: {
    flexGrow: 1,
    justifyContent: "center",
  },
  tarjeta: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  icono: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: `${colors.primary}1F`,
    borderRadius: radii.pill,
    height: 64,
    justifyContent: "center",
    marginBottom: spacing.md,
    width: 64,
  },
  titulo: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  parrafo: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  boton: {
    marginTop: spacing.xs,
  },
});
