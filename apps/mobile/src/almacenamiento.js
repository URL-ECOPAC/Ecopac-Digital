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

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const PREFIJO_LLAVE_DE_CIFRADO = "llave-cifrado-";

/** Recupera la llave AES de esta clave desde SecureStore, o la crea si no existe. */
async function obtenerOCrearLlave(clave) {
  const claveEnSecureStore = PREFIJO_LLAVE_DE_CIFRADO + clave;
  const llaveGuardada = await SecureStore.getItemAsync(claveEnSecureStore);

  if (llaveGuardada) {
    return Crypto.AESEncryptionKey.import(llaveGuardada, "base64");
  }

  const llaveNueva = await Crypto.AESEncryptionKey.generate(256);
  const llaveCodificada = await llaveNueva.encoded("base64");
  await SecureStore.setItemAsync(claveEnSecureStore, llaveCodificada);
  return llaveNueva;
}

export const almacenamientoMovil = {
  async getItem(clave) {
    const valorCifrado = await AsyncStorage.getItem(clave);
    if (!valorCifrado) return valorCifrado;

    const claveEnSecureStore = PREFIJO_LLAVE_DE_CIFRADO + clave;
    const llaveCodificada = await SecureStore.getItemAsync(claveEnSecureStore);

    if (!llaveCodificada) {
      // Hay blob cifrado pero no la llave para abrirlo (dispositivo restaurado desde un
      // backup de AsyncStorage sin su Keychain/Keystore, por ejemplo). Es irrecuperable: se
      // descarta en vez de fallar, y supabase-js lo trata como "no hay sesion" (pide login
      // de nuevo) en vez de reventar con un blob que no puede descifrar.
      await AsyncStorage.removeItem(clave);
      return null;
    }

    const llave = await Crypto.AESEncryptionKey.import(llaveCodificada, "base64");
    const sellado = Crypto.AESSealedData.fromCombined(valorCifrado);
    const bytesDescifrados = await Crypto.aesDecryptAsync(sellado, llave);
    return new TextDecoder().decode(bytesDescifrados);
  },

  async setItem(clave, valor) {
    const llave = await obtenerOCrearLlave(clave);
    const bytesDelValor = new TextEncoder().encode(valor);
    const sellado = await Crypto.aesEncryptAsync(bytesDelValor, llave);
    const combinado = await sellado.combined("base64");
    await AsyncStorage.setItem(clave, combinado);
  },

  async removeItem(clave) {
    await AsyncStorage.removeItem(clave);
    await SecureStore.deleteItemAsync(PREFIJO_LLAVE_DE_CIFRADO + clave);
  },
};
