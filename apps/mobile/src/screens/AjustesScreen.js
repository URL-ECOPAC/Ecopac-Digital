import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";
import {
  TIPOS_DE_CAMPO,
  etiquetaDeRol,
  puedeVerCatalogoComunidades,
  usePerfilPropio,
  valoresInicialesDePerfil,
} from "@ecopac/shared";

import {
  Card,
  ErrorState,
  PasswordField,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  Selector,
  StatusChip,
  TextField,
  UsuarioActivo,
} from "../components";
import { useRegistroSinGuardar } from "../contexto/RegistroSinGuardarProvider";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";
import { useCantidadDeNotificaciones } from "../contexto/NotificacionesProvider";

// Id fijo: solo hay un formulario de perfil propio montado a la vez (issue #645).
const ID_FORMULARIO = "perfil-propio";

// Pantalla de Ajustes + perfil propio y cambio de contrasena (issue #645, espejo de la #102).
// Solo presentacion: los datos, la edicion, la reverificacion de contrasena y el refresco de la
// sesion compartida salen de usePerfilPropio(), en packages/shared/usuarios/. Las etiquetas, el
// tipo y el orden de los campos de perfil salen de CAMPOS_USUARIO via camposDePerfilPropio():
// esta pantalla no escribe ninguna de esas etiquetas a mano, solo las de los campos de
// contrasena, que no tienen descriptor (mismo patron que apps/web/src/pages/PerfilPage.jsx).
export default function AjustesScreen({ navigation }) {
  const { usuario, perfil, refrescarPerfil } = useSesionCompartida();
  const { registrar, desregistrar } = useRegistroSinGuardar();
  const notificacionesSinLeer = useCantidadDeNotificaciones();

  const {
    campos,
    valores,
    setCampo,
    erroresDeCampo,
    guardando,
    errorGlobal,
    guardadoExitoso,
    guardarPerfil,
    especialidades,
    cargandoEspecialidades,
    contrasena,
    setCampoDeContrasena,
    erroresDeContrasena,
    cambiandoContrasena,
    errorGlobalDeContrasena,
    contrasenaCambiada,
    cambiarContrasena,
  } = usePerfilPropio({ usuario, perfil, refrescarPerfil });

  const sinCambiosDePerfil =
    JSON.stringify(valores) === JSON.stringify(valoresInicialesDePerfil(perfil));
  const sinCambiosDeContrasena =
    !contrasena.actual && !contrasena.nueva && !contrasena.confirmarNueva;
  const hayCambios = !sinCambiosDePerfil || !sinCambiosDeContrasena;

  // El formulario de perfil tambien cuenta para el aviso de cambios sin guardar de la #110,
  // mismo patron que ya usa ConsultaScreen.js: se registra mientras haya algo sin guardar y se
  // desregistra solo, sin depender de que la persona toque un boton de guardar antes de irse.
  useEffect(() => {
    if (!hayCambios) return;
    registrar(ID_FORMULARIO);
    return () => desregistrar(ID_FORMULARIO);
  }, [hayCambios, registrar, desregistrar]);

  return (
    <ScreenContainer contentContainerStyle={styles.contenido}>
      <Text style={styles.titulo}>Ajustes</Text>
      <UsuarioActivo compacto={false} />

      {/* Notificaciones (issue #755): solo el resumen y el acceso a su propia pantalla, donde se
          filtran. El buzon entero aqui empujaba el perfil hacia abajo y crecia sin limite. */}
      <Card
        title="Notificaciones"
        subtitle={notificacionesSinLeer > 0 ? `${notificacionesSinLeer} sin leer` : "Todo al día"}
      >
        <SecondaryButton
          title="Ver notificaciones"
          onPress={() => navigation.navigate(ROUTES.NOTIFICACIONES)}
        />
      </Card>

      {puedeVerCatalogoComunidades(perfil?.rol) && (
        <Card title="Administración">
          <PrimaryButton
            title="Catalogo de comunidades"
            onPress={() => navigation.navigate(ROUTES.TAB_INICIO, { screen: ROUTES.COMUNIDADES })}
          />
        </Card>
      )}

      <Card title="Mi perfil">
        {errorGlobal ? <ErrorState message={errorGlobal} /> : null}

        {campos.map((campo) => {
          if (campo.tipo === TIPOS_DE_CAMPO.ETIQUETAS) {
            return (
              <View key={campo.id} style={styles.campoEtiquetas}>
                <Text style={styles.labelEtiquetas}>{campo.label}</Text>
                {cargandoEspecialidades ? (
                  <Text style={styles.textoMuted}>Cargando...</Text>
                ) : especialidades.length === 0 ? (
                  <Text style={styles.textoMuted}>Sin especialidades asignadas.</Text>
                ) : (
                  <View style={styles.listaEtiquetas}>
                    {especialidades.map((nombre) => (
                      <StatusChip key={nombre} status={nombre} />
                    ))}
                  </View>
                )}
              </View>
            );
          }

          if (campo.id === "rol" && !campo.editable) {
            return (
              <TextField
                key={campo.id}
                label={campo.label}
                value={etiquetaDeRol(valores.rol)}
                editable={false}
              />
            );
          }

          if (campo.tipo === TIPOS_DE_CAMPO.SELECT) {
            return (
              <Selector
                key={campo.id}
                label={campo.label}
                value={valores[campo.id]}
                options={campo.opciones}
                onSelect={(valor) => setCampo(campo.id, valor)}
                error={erroresDeCampo?.[campo.id]}
                disabled={guardando}
              />
            );
          }

          return (
            <TextField
              key={campo.id}
              label={campo.label}
              value={valores[campo.id] ?? ""}
              onChangeText={campo.editable ? (texto) => setCampo(campo.id, texto) : undefined}
              error={erroresDeCampo?.[campo.id]}
              editable={campo.editable && !guardando}
            />
          );
        })}

        <PrimaryButton
          title="Guardar cambios"
          onPress={guardarPerfil}
          loading={guardando}
          disabled={guardando}
          style={styles.boton}
        />
        {guardadoExitoso ? <Text style={styles.textoExito}>Perfil actualizado.</Text> : null}
      </Card>

      <Card title="Cambiar contraseña">
        {errorGlobalDeContrasena ? <ErrorState message={errorGlobalDeContrasena} /> : null}

        {/* ISSUE #864. Tres campos, tres estados de visibilidad. Antes los tres compartian un
            unico `verContrasena`: al mostrar uno se mostraban los tres, y aqui se escribe la
            contrasena nueva dos veces sin poder comprobar cual de las dos esta mal escrita.
            Mismo arreglo que en PerfilPage de la web. */}
        <PasswordField
          label="Contraseña actual"
          value={contrasena.actual}
          onChangeText={(texto) => setCampoDeContrasena("actual", texto)}
          error={erroresDeContrasena?.actual}
          editable={!cambiandoContrasena}
          textContentType="password"
          autoComplete="current-password"
        />
        <PasswordField
          label="Contraseña nueva"
          value={contrasena.nueva}
          onChangeText={(texto) => setCampoDeContrasena("nueva", texto)}
          error={erroresDeContrasena?.nueva}
          editable={!cambiandoContrasena}
          textContentType="newPassword"
          autoComplete="password-new"
        />
        <PasswordField
          label="Confirmar contraseña nueva"
          value={contrasena.confirmarNueva}
          onChangeText={(texto) => setCampoDeContrasena("confirmarNueva", texto)}
          error={erroresDeContrasena?.confirmarNueva}
          editable={!cambiandoContrasena}
          textContentType="newPassword"
          autoComplete="password-new"
        />

        <PrimaryButton
          title="Cambiar contraseña"
          onPress={cambiarContrasena}
          loading={cambiandoContrasena}
          disabled={cambiandoContrasena}
          style={styles.boton}
        />
        {contrasenaCambiada ? <Text style={styles.textoExito}>Contraseña actualizada.</Text> : null}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contenido: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  titulo: {
    color: colors.text,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  campoEtiquetas: {
    marginBottom: spacing.md,
  },
  labelEtiquetas: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  listaEtiquetas: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  textoMuted: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  textoExito: {
    marginTop: spacing.sm,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.success || colors.primary,
    textAlign: "center",
  },
  boton: {
    marginTop: spacing.sm,
  },
});
