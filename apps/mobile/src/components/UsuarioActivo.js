<<<<<<< HEAD
import React from "react";
=======
>>>>>>> origin/develop
import { StyleSheet, Text, View } from "react-native";
import { etiquetaDeRol } from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { useSesionCompartida } from "../contexto/SesionProvider";

<<<<<<< HEAD
export default function UsuarioActivo() {
=======
/**
 * Nombre y rol de quien tiene la sesion activa (issue #110, criterio 5).
 *
 * `compacto` (por defecto) es para el headerRight de AppNavigator: comparte fila con el titulo
 * de la pantalla, asi que trunca a una linea y nunca empuja el titulo.
 */
export default function UsuarioActivo({ compacto = true }) {
>>>>>>> origin/develop
  const { perfil } = useSesionCompartida();

  if (!perfil) return null;

<<<<<<< HEAD
  const nombre = `${perfil.nombres ?? ""} ${perfil.apellidos ?? ""}`.trim() || "Usuario";
  const rolTexto = etiquetaDeRol(perfil.rol) || perfil.rol;
  const inicial = nombre.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <View style={styles.userInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{inicial}</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.nombre} numberOfLines={1} ellipsizeMode="tail">
            {nombre}
          </Text>
          {rolTexto ? (
            <Text style={styles.rol} numberOfLines={1} ellipsizeMode="tail">
              {rolTexto}
            </Text>
          ) : null}
        </View>
      </View>
=======
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
>>>>>>> origin/develop
    </View>
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
  container: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.md,
  },
  textContainer: {
    flex: 1,
=======
  compacto: {
    maxWidth: 120,
    alignItems: "flex-end",
    marginRight: spacing.md,
    justifyContent: "center",
  },
  expandido: {
    alignItems: "flex-start",
>>>>>>> origin/develop
  },
  nombre: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
<<<<<<< HEAD
    fontWeight: typography.weights.bold,
    color: colors.text || "#0F172A",
=======
    fontWeight: typography.weights.semibold,
    color: colors.text,
>>>>>>> origin/develop
  },
  rol: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
<<<<<<< HEAD
    color: colors.textMuted || "#64748B",
  },
});
=======
    color: colors.textMuted,
  },
});
>>>>>>> origin/develop
