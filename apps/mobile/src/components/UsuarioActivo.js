import { StyleSheet, Text, View } from "react-native";
import { etiquetaDeRol } from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { useSesionCompartida } from "../contexto/SesionProvider";

/**
 * Nombre y rol de quien tiene la sesion activa (issue #110, criterio 5).
 *
 * `compacto` (por defecto) es para el headerRight de AppNavigator: comparte fila con el titulo
 * de la pantalla, asi que trunca a una linea y nunca empuja el titulo.
 */
export default function UsuarioActivo({ compacto = true }) {
  const { perfil } = useSesionCompartida();

  if (!perfil) return null;

  const nombre = `${perfil.nombres ?? ""} ${perfil.apellidos ?? ""}`.trim();
  // Obtiene la etiqueta traducida o usa el valor del rol directamente si ya viene formateado
  const rolTexto = etiquetaDeRol(perfil.rol) || perfil.rol;
  const lineas = compacto ? 1 : undefined;

  return (
    <View style={compacto ? styles.compacto : styles.expandido}>
      <Text style={styles.nombre} numberOfLines={lineas} ellipsizeMode="tail">
        {nombre || "Sesión activa"}
      </Text>
      {rolTexto ? (
        <Text style={styles.rol} numberOfLines={lineas} ellipsizeMode="tail">
          {rolTexto}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  compacto: {
    maxWidth: 120,
    alignItems: "flex-end",
    marginRight: spacing.md,
    justifyContent: "center",
  },
  expandido: {
    alignItems: "flex-start",
  },
  nombre: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  rol: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
});