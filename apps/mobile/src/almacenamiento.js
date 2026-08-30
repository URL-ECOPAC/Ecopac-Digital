// Adaptador de almacenamiento de la sesion para la app movil.
//
// Implementa el contrato documentado en packages/shared/api/almacenamiento.js. La sesion de
// supabase-js (access token, refresh token y metadata del usuario) es una credencial de larga
// duracion (persistSession + autoRefreshToken, packages/shared/api/cliente.js), asi que no
// puede vivir en texto plano: AsyncStorage no esta cifrado por el sistema operativo, y en un
// telefono con root/jailbreak (o un backup sin cifrar) es legible por cualquier app (issue
// #238, OWASP A02). SecureStore la guarda cifrada por el Keychain de iOS o el Keystore de
// Android.
//
// Se descarto el patron hibrido (SecureStore solo para una llave AES, el blob cifrado en
// AsyncStorage) que documenta el blog de Supabase para sesiones grandes: depende de
// `expo-crypto` (`AESEncryptionKey`/`AESSealedData`), una API nativa muy reciente del SDK 57
// que Expo Go -la app generica, no un dev client propio- todavia no sirve de forma confiable:
// las llamadas nativas fallan con errores vacios en vez de cifrar o descifrar, lo que
// impedia persistir la sesion (docs/PROTECCION-DE-DATOS.md documento ese cambio como no
// probado en un dispositivo real, y en la practica no funciono). Mientras el equipo siga
// probando en Expo Go, SecureStore solo -que si es nativo estable- es la opcion que
// realmente persiste la sesion entre arranques de la app.
//
// Limite conocido: SecureStore tiene un tope historico de ~2048 bytes por valor en iOS
// (docs.expo.dev/versions/v57.0.0/sdk/securestore). La sesion completa de Supabase (dos JWT
// mas metadata del usuario) puede acercarse a ese limite; si en pruebas de iOS
// SecureStore.setItemAsync empieza a fallar por tamano, ahi si hace falta retomar un patron
// hibrido, pero ya con expo-crypto probado en un dispositivo real o con un dev client (no
// Expo Go).
//
// En web (Platform.OS === "web", cuando se corre con "expo start --web") no hay
// SecureStore/Keychain nativo disponible: se usa localStorage directo, igual que
// apps/web/src/almacenamiento.js.
//
// El envoltorio existe para que el import de SecureStore viva en un unico archivo: la issue
// #57, que ajusta el comportamiento de restaurar y limpiar la sesion, tiene asi un solo sitio
// donde tocar.

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * SecureStore solo acepta [A-Za-z0-9._-] en las claves (docs.expo.dev/versions/v57.0.0/sdk/securestore),
 * pero el contrato de almacenamiento compartido (packages/shared/api/almacenamiento.js) no
 * restringe los caracteres: useJornadaActiva guarda "jornada_activa:<perfilId>", con ":".
 * Se escapa cada caracter fuera de ese alfabeto -incluido el punto, que aqui se reserva como
 * marcador de escape para que no colisione con una clave que ya trajera un punto literal- por
 * su codigo en hex.
 */
function claveSeguraParaSecureStore(clave) {
  return clave.replace(
    /[^A-Za-z0-9_-]/g,
    (caracter) => `.${caracter.codePointAt(0).toString(16).padStart(4, "0")}`,
  );
}

export const almacenamientoMovil = {
  async getItem(clave) {
    try {
      if (Platform.OS === "web") {
        return typeof window !== "undefined" ? localStorage.getItem(clave) : null;
      }
      return await SecureStore.getItemAsync(claveSeguraParaSecureStore(clave));
    } catch (error) {
      console.error(`Error al leer la clave "${clave}":`, error);
      return null;
    }
  },

  async setItem(clave, valor) {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          localStorage.setItem(clave, valor);
        }
        return;
      }
      await SecureStore.setItemAsync(claveSeguraParaSecureStore(clave), valor);
    } catch (error) {
      console.error(`Error al guardar la clave "${clave}":`, error);
    }
  },

  async removeItem(clave) {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          localStorage.removeItem(clave);
        }
        return;
      }
      await SecureStore.deleteItemAsync(claveSeguraParaSecureStore(clave));
    } catch (error) {
      console.error(`Error al eliminar la clave "${clave}":`, error);
    }
  },
};
