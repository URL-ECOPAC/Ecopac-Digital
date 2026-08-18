// Adaptador de almacenamiento de la sesion para la app movil.
//
// Implementa el contrato documentado en packages/shared/api/almacenamiento.js usando
// AsyncStorage, que es lo que hace que la sesion sobreviva a cerrar y reabrir la app. Sus
// tres metodos devuelven promesas y supabase-js siempre hace await, asi que encajan directo.
//
// El envoltorio existe para que el import de AsyncStorage viva en un unico archivo: la
// issue #57, que ajusta el comportamiento de restaurar y limpiar la sesion, tiene asi un
// solo sitio donde tocar.

import AsyncStorage from "@react-native-async-storage/async-storage";

export const almacenamientoMovil = {
  getItem(clave) {
    return AsyncStorage.getItem(clave);
  },
  setItem(clave, valor) {
    return AsyncStorage.setItem(clave, valor);
  },
  removeItem(clave) {
    return AsyncStorage.removeItem(clave);
  },
};
