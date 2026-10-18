import { colors } from "@ecopac/ui-tokens";

// Definitivo desde la issue #252. No tiene que ser un dominio real -la app se reparte como APK, no
// por tienda-, pero NO SE CAMBIA: Android trata otro identificador como otra app, y cambiarlo
// obligaria a desinstalar y reinstalar en cada telefono.
const IDENTIFICADOR_DE_PAQUETE = "org.ecopacguatemala.digital";

export default {
  expo: {
    name: "Ecopac Digital",
    slug: "ecopac-digital",
    // Cuenta de Expo de la organizacion, duena de las builds de EAS y de la llave de firma.
    owner: "ecopacdigitals-team",
    extra: {
      // Proyecto de EAS. `eas init` no puede escribirlo en un app.config.js (es JavaScript, no
      // JSON), asi que se copia a mano de lo que devuelve.
      eas: { projectId: "a47ad811-6f01-43cb-be59-b10617b994e1" },
    },
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
