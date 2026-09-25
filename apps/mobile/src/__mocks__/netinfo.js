/* global jest, module */
// Doble de @react-native-community/netinfo para Jest (issue #762). El modulo real escucha la
// interfaz de red del telefono, que no existe fuera de un binario. `__emitir(estado)` le avisa a
// cada escucha como lo haria el sistema al perder o recuperar la senal.
const escuchas = new Set();

module.exports = {
  __esModule: true,
  default: {
    addEventListener: jest.fn((escucha) => {
      escuchas.add(escucha);
      return () => escuchas.delete(escucha);
    }),
    fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
  },
  __emitir(estado) {
    escuchas.forEach((escucha) => escucha(estado));
  },
};
