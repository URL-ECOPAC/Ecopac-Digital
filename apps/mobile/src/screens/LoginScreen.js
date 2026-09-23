import { useRef } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";
import { useInicioSesion } from "@ecopac/shared";

import LOGO from "../../assets/icon.png";
import { Card, PasswordField, PrimaryButton, ScreenContainer, TextField } from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";

export default function LoginScreen({ navigation }) {
  const {
    correo,
    setCorreo,
    contrasena,
    setContrasena,
    erroresDeCampo,
    error,
    enviando,
    handleSubmit,
  } = useInicioSesion();

  // ISSUE #864. `error` de la sesion, no del formulario: son dos cosas distintas y aqui hacen
  // falta las dos (ver el comentario del bloque que las pinta).
  const { cerradaPorInactividad, error: errorDeSesion } = useSesionCompartida();
  const campoContrasena = useRef(null);

  // ISSUE #864. A quien tiene la cuenta desactivada se le vaciaba el formulario sin decirle nada.
  // La contrasena era correcta, asi que Supabase emite SIGNED_IN, `haySesion` pasa a true y App.js
  // cambia el AuthNavigator entero por las pestanas: ESO DESMONTA ESTA PANTALLA. Un instante
  // despues useSesion termina de evaluar el perfil, lo ve inactivo y cierra la sesion; se vuelve
  // al login, pero con la pantalla montada de cero, y el error que `useInicioSesion` habia
  // guardado se fue con el componente anterior.
  //
  // El error de la sesion sobrevive porque useSesion vive POR ENCIMA del navegador, asi que sirve
  // de respaldo: se muestra solo cuando el formulario no tiene uno propio, que es exactamente el
  // caso de a quien acaban de desactivar. Mismo arreglo que LoginPage.jsx en la web.
  const errorAMostrar = error ?? errorDeSesion;

  return (
    <ScreenContainer contentContainerStyle={styles.contenido}>
      <Card style={styles.tarjeta}>
        <View style={styles.encabezado}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.titulo}>Ecopac Digital</Text>
          <Text style={styles.subtitulo}>Inicia sesión para continuar</Text>
        </View>

        {/* Por que el cierre fue automatico. Sin esto, la sesion se cerraba sola y la pantalla
            de inicio aparecia sin explicar nada, que es el defecto que la web ya habia corregido
            (issue #840). Cede el lugar a un error de credenciales: ese es mas urgente. */}
        {cerradaPorInactividad && !errorAMostrar ? (
          <View style={styles.avisoInactividad}>
            <Text style={styles.avisoInactividadTexto}>
              Cerramos tu sesión porque la app estuvo una hora sin usarse. Volvé a entrar para
              continuar.
            </Text>
          </View>
        ) : null}

        {errorAMostrar ? (
          <View style={styles.errorGeneral}>
            <Text style={styles.errorGeneralTexto}>{errorAMostrar.mensaje || errorAMostrar}</Text>
          </View>
        ) : null}

        <TextField
          label="Correo electrónico"
          value={correo}
          onChangeText={setCorreo}
          error={erroresDeCampo.email}
          editable={!enviando}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          autoComplete="email"
          returnKeyType="next"
          onSubmitEditing={() => campoContrasena.current?.focus()}
          blurOnSubmit={false}
        />

        {/* ISSUE #864. Antes el control era la palabra "Mostrar"/"Ocultar" a la derecha de la
            etiqueta, fuera del campo. Ahora es el icono de ojo dentro del campo, igual que en la
            web, y lo lleva el propio PasswordField: la pantalla ya no arrastra el estado. */}
        <PasswordField
          ref={campoContrasena}
          label="Contraseña"
          value={contrasena}
          onChangeText={setContrasena}
          error={erroresDeCampo.contrasena}
          editable={!enviando}
          textContentType="password"
          autoComplete="password"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        <Pressable
          onPress={() => navigation.navigate(ROUTES.RESTABLECER_CONTRASENA)}
          hitSlop={8}
          style={styles.olvideContrasena}
        >
          <Text style={styles.olvideContrasenaTexto}>¿Olvidaste tu contraseña?</Text>
        </Pressable>

        <PrimaryButton
          title="Iniciar sesión"
          onPress={handleSubmit}
          loading={enviando}
          disabled={enviando}
          style={styles.boton}
        />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contenido: {
    justifyContent: "center",
  },
  tarjeta: {
    padding: spacing.lg,
  },
  encabezado: {
    marginBottom: spacing.xl,
    alignItems: "center",
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: spacing.sm,
  },
  titulo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  subtitulo: {
    marginTop: spacing.xs,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    color: colors.textMuted,
  },
  // En informativo y no en rojo: la sesion se cerro como estaba previsto, no fallo nada.
  avisoInactividad: {
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.info,
    backgroundColor: colors.surface,
  },
  avisoInactividadTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.info,
    textAlign: "center",
  },
  errorGeneral: {
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  errorGeneralTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.danger,
    textAlign: "center",
  },
  olvideContrasena: {
    marginTop: spacing.sm,
    alignSelf: "flex-end",
  },
  olvideContrasenaTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  boton: {
    marginTop: spacing.md,
  },
});
