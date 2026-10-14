/* global jest, module */
// Doble de expo-notifications para Jest (issue #755). El modulo real habla con el sistema de
// notificaciones del telefono, que no existe fuera de un binario; aqui cada funcion es un jest.fn
// que las pruebas pueden inspeccionar (ver AvisosDelSistema.test.js).
const suscripcion = () => ({ remove: jest.fn() });

module.exports = {
  AndroidImportance: { HIGH: 4 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  scheduleNotificationAsync: jest.fn(async () => "id-de-prueba"),
  addNotificationResponseReceivedListener: jest.fn(suscripcion),
};
