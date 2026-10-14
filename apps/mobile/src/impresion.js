import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

export async function imprimirHtml(html, { nombreDelArchivo = "documento" } = {}) {
  if (!html) {
    return { ok: false, error: { mensaje: "No hay nada que imprimir." } };
  }

  try {
    if (Platform.OS === "ios" || Platform.OS === "web") {
      await Print.printAsync({ html });
      return { ok: true };
    }

    const { uri } = await Print.printToFileAsync({ html });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: nombreDelArchivo,
        UTI: "com.adobe.pdf",
      });
      return { ok: true, uri };
    }

    await Print.printAsync({ uri });
    return { ok: true, uri };
  } catch (error) {
    return { ok: false, error: { mensaje: error?.message ?? "No se pudo preparar la impresión." } };
  }
}
