import { colors } from "@ecopac/ui-tokens";

// Provisional: confirmar con el dominio institucional real antes de la primera publicación en tiendas.
const IDENTIFICADOR_DE_PAQUETE = "org.ecopacguatemala.digital";

export default {
  expo: {
    name: "Ecopac Digital",
    slug: "ecopac-digital",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    scheme: "ecopac",
    icon: "./assets/icon.png",
    backgroundColor: colors.primary,
    primaryColor: colors.primary,
    plugins: [
      [
        "expo-splash-screen",
        {
          backgroundColor: colors.primary,
          image: "./assets/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
        },
      ],
    ],
    ios: {
      bundleIdentifier: IDENTIFICADOR_DE_PAQUETE,
      supportsTablet: true,
    },
    android: {
      package: IDENTIFICADOR_DE_PAQUETE,
      adaptiveIcon: {
        foregroundImage: "./assets/icon-foreground.png",
        backgroundColor: colors.primary,
      },
    },
  },
};
