/* global jest, module */
// Doble de expo-sharing para Jest (issue #866), por la misma razon que expo-print: la hoja de
// compartir es del sistema operativo.
module.exports = {
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
};
