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
    // Fondo de la vista raiz, el que se ve en el instante antes de que React pinte la primera
    // pantalla (y al montar una pantalla nueva). Era colors.primary, y eso daba un destello verde
    // de ~120 ms al abrir la app y al entrar a Inicio (medido cuadro a cuadro en un telefono al
    // probar la #755). Ahora es el mismo fondo de todas las pantallas; el verde de marca se queda
    // donde corresponde: la pantalla de carga (expo-splash-screen, abajo) y el icono adaptativo.
    backgroundColor: colors.background,
    primaryColor: colors.primary,
    plugins: [
      // Notificaciones del sistema (issue #755). Expo Go ignora los plugins; este solo cuenta para
      // un development build o una build de tienda, donde fija el color de la notificacion.
      ["expo-notifications", { color: colors.primary }],
      "expo-sharing",
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
