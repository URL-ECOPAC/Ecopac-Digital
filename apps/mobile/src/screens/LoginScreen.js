import { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@ecopac/ui-tokens';
import { useInicioSesion } from '@ecopac/shared';

import LOGO from '../../assets/icon.png';
import { Card, PrimaryButton, ScreenContainer, TextField } from '../components';

export default function LoginScreen() {
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

  const campoContrasena = useRef(null);
  const [verContrasena, setVerContrasena] = useState(false);

  return (
    <ScreenContainer contentContainerStyle={styles.contenido}>
      <Card style={styles.tarjeta}>
        <View style={styles.encabezado}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.titulo}>Ecopac Digital</Text>
          <Text style={styles.subtitulo}>Inicia sesión para continuar</Text>
        </View>

        {error ? (
          <View style={styles.errorGeneral}>
            <Text style={styles.errorGeneralTexto}>{error.mensaje}</Text>
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

        <View style={styles.encabezadoContrasena}>
          <Text style={styles.labelContrasena}>Contraseña</Text>
          <Pressable onPress={() => setVerContrasena((valor) => !valor)} hitSlop={8}>
            <Text style={styles.toggleContrasena}>{verContrasena ? 'Ocultar' : 'Mostrar'}</Text>
          </Pressable>
        </View>
        <TextField
          ref={campoContrasena}
          value={contrasena}
          onChangeText={setContrasena}
          error={erroresDeCampo.contrasena}
          editable={!enviando}
          secureTextEntry={!verContrasena}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          autoComplete="password"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

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
    justifyContent: 'center',
  },
  tarjeta: {
    padding: spacing.lg,
  },
  encabezado: {
    marginBottom: spacing.xl,
    alignItems: 'center',
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
  errorGeneral: {
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.xs,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  errorGeneralTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.danger,
    textAlign: 'center',
  },
  encabezadoContrasena: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  labelContrasena: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  toggleContrasena: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  boton: {
    marginTop: spacing.md,
  },
});
