/* global jest, module */
// Doble de expo-print para Jest (issue #866). El modulo real abre el dialogo de impresion del
// sistema y escribe un PDF en disco, que no existen fuera de un binario.
module.exports = {
  printAsync: jest.fn(async () => undefined),
  printToFileAsync: jest.fn(async () => ({ uri: "file:///prueba/receta.pdf" })),
};
