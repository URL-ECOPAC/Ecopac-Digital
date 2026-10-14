// Impresion en movil (issue #866, punto 1). Hasta esta issue la app no tenia ninguna capacidad
// de impresion: ni expo-print ni expo-sharing estaban en las dependencias.
//
// En Android no se manda a imprimir directo: se genera el PDF y se abre la hoja de compartir, que
// es de donde sale tanto "Imprimir" como "Guardar en Drive" o mandarlo por WhatsApp -- que es lo
// que de verdad se hace en una comunidad donde no hay impresora cerca.

import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { imprimirHtml } from "./impresion";

const HTML = "<html><body>Receta</body></html>";

describe("imprimirHtml", () => {
  beforeEach(() => {
    Print.printAsync.mockClear();
    Print.printToFileAsync.mockClear();
    Sharing.isAvailableAsync.mockClear();
    Sharing.shareAsync.mockClear();
    Print.printAsync.mockResolvedValue(undefined);
    Print.printToFileAsync.mockResolvedValue({ uri: "file:///prueba/receta.pdf" });
    Sharing.isAvailableAsync.mockResolvedValue(true);
    Platform.OS = "android";
  });

  it("sin html no intenta nada y lo dice", async () => {
    const resultado = await imprimirHtml(null);

    expect(resultado.ok).toBe(false);
    expect(Print.printAsync).not.toHaveBeenCalled();
    expect(Print.printToFileAsync).not.toHaveBeenCalled();
  });

  it("en iOS abre el dialogo de impresion del sistema", async () => {
    Platform.OS = "ios";

    const resultado = await imprimirHtml(HTML);

    expect(resultado.ok).toBe(true);
    expect(Print.printAsync).toHaveBeenCalledWith({ html: HTML });
    expect(Print.printToFileAsync).not.toHaveBeenCalled();
  });

  it("en Android genera el PDF y lo pasa a la hoja de compartir", async () => {
    const resultado = await imprimirHtml(HTML, { nombreDelArchivo: "Receta REC-1" });

    expect(resultado.ok).toBe(true);
    expect(Print.printToFileAsync).toHaveBeenCalledWith({ html: HTML });
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      "file:///prueba/receta.pdf",
      expect.objectContaining({ mimeType: "application/pdf", dialogTitle: "Receta REC-1" }),
    );
  });

  it("si el telefono no puede compartir, cae al dialogo de impresion con el PDF", async () => {
    Sharing.isAvailableAsync.mockResolvedValue(false);

    const resultado = await imprimirHtml(HTML);

    expect(resultado.ok).toBe(true);
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(Print.printAsync).toHaveBeenCalledWith({ uri: "file:///prueba/receta.pdf" });
  });

  it("un fallo del sistema vuelve como error con mensaje, no como excepcion suelta", async () => {
    Print.printToFileAsync.mockRejectedValue(new Error("Sin espacio en el telefono"));

    const resultado = await imprimirHtml(HTML);

    expect(resultado.ok).toBe(false);
    expect(resultado.error.mensaje).toBe("Sin espacio en el telefono");
  });
});
