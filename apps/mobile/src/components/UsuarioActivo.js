import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { etiquetaDeRol } from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { useSesionCompartida } from "../contexto/SesionProvider";

export default function UsuarioActivo() {
  const { perfil } = useSesionCompartida();

  if (!perfil) return null;

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
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  nombre: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text || "#0F172A",
  },
  rol: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.textMuted || "#64748B",
  },
});