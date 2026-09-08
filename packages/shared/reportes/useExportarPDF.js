import { useState } from "react";

/**
 * Hook compartido para exportar reportes a PDF.
 * SOLO prepara datos y estado. NO toca el DOM.
 * La generación con document va en el componente de apps/web.
 */
export function useExportarPDF({ tituloReporte, periodo }) {
  const [generando, setGenerando] = useState(false);

  // Prepara los datos que van al PDF
  const construirDatosPDF = (contenidoTabla = []) => {
    const fechaGeneracion = new Date().toLocaleDateString("es-GT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    return {
      titulo: tituloReporte,
      periodo,
      fechaGeneracion,
      columnas: [], // [{ etiqueta, clave }, ...]
      filas: contenidoTabla,
      totalizadores: {}, // { etiqueta, valor }
    };
  };

  // Función que llama el componente web para generar el PDF
  const exportar = async (generarPDF) => {
    if (generando) return;
    try {
      setGenerando(true);
      const datos = construirDatosPDF();
      // ✅ Aquí NO hay document — se pasa al componente
      await generarPDF(datos);
    } catch (err) {
      console.error("Error al generar PDF:", err);
      throw err;
    } finally {
      setGenerando(false);
    }
  };

  return {
    generando,
    exportar,
  };
}
