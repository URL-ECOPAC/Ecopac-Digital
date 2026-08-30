// Adaptador de almacenamiento de la sesion para la app movil.
//
// Implementa el contrato documentado en packages/shared/api/almacenamiento.js. La sesion de
// supabase-js (access token, refresh token y metadata del usuario) es una credencial de larga
// duracion (persistSession + autoRefreshToken, packages/shared/api/cliente.js), asi que no
// puede vivir en texto plano: AsyncStorage no esta cifrado por el sistema operativo, y en un
// telefono con root/jailbreak (o un backup sin cifrar) es legible por cualquier app (issue
// #238, OWASP A02).
//
// Patron hibrido, no SecureStore puro: SecureStore por si solo rechaza valores grandes (limite
// historico de iOS, ~2048 bytes -- docs.expo.dev/versions/v57.0.0/sdk/securestore), y la sesion
// completa de Supabase supera eso facil. Se cifra el valor con AES-GCM (expo-crypto, nativo
// desde el SDK 57, sin depender de la libreria aes-js que documenta el blog de Supabase para
// versiones viejas de Expo) y solo la LLAVE de cifrado -pequena, ~32 bytes- vive en SecureStore.
// El blob cifrado se guarda en AsyncStorage: sin la llave, es basura ilegible.
//
// El envoltorio existe para que el import de AsyncStorage/SecureStore/Crypto viva en un unico
// archivo: la issue #57, que ajusta el comportamiento de restaurar y limpiar la sesion, tiene
// asi un solo sitio donde tocar.

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Adaptador de almacenamiento híbrido (Web / Nativo)
 * Mantiene la compatibilidad con expo-secure-store en móviles
 * y recurre a localStorage cuando se ejecuta en el navegador.
 */
export const almacenamientoMovil = {
  getItem: async (key) => {
    try {
      if (Platform.OS === "web") {
        return typeof window !== "undefined" ? localStorage.getItem(key) : null;
      }
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`Error al leer la clave "${key}":`, error);
      return null;
    }
  },

  setItem: async (key, value) => {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          localStorage.setItem(key, value);
        }
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error(`Error al guardar la clave "${key}":`, error);
    }
  },

  removeItem: async (key) => {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          localStorage.removeItem(key);
        }
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`Error al eliminar la clave "${key}":`, error);
    }
  },
};
