import { useState } from "react";

/**
 * Hook para exportar cualquier reporte a PDF en el cliente.
 * Requisito: incluir html2pdf.js en el proyecto o instalarlo.
 */
export function useExportarPDF({ tituloReporte, periodo }) {
  const [generando, setGenerando] = useState(false);

  const exportar = async () => {
    setGenerando(true);
    try {
      // Cargar html2pdf dinámicamente si no está disponible
      const html2pdf = (await import("html2pdf.js")).default;

      // Elemento que contiene el reporte (sin navegación ni botones)
      const contenido = document.getElementById("contenido-reporte-pdf");
      if (!contenido) throw new Error("No se encontró el contenido del reporte");

      // Configuración del PDF
      const opciones = {
        margin: 10,
        filename: `${tituloReporte.replace(/\s+/g, "-")}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "landscape",
        },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      };

      // Construir encabezado institucional
      const fechaGeneracion = new Date().toLocaleDateString("es-GT", {
        dateStyle: "full",
      });

      const encabezado = `
        <div style="padding: 12px 0; border-bottom: 2px solid #059669; margin-bottom: 16px;">
          <h1 style="margin: 0; font-size: 18px; color: #0f766e;">ECOPAC Digital</h1>
          <h2 style="margin: 4px 0; font-size: 15px; color: #1e293b;">${tituloReporte}</h2>
          <p style="margin: 0; font-size: 11px; color: #64748b;">
            Período: ${periodo || "Todo el rango"} • Generado el: ${fechaGeneracion}
          </p>
        </div>
      `;

      // Generar y descargar
      html2pdf()
        .from(contenido)
        .set(opciones)
        .toPdf()
        .save();
    } catch (error) {
      console.error("Error al generar PDF:", error);
      alert("No se pudo generar el PDF. Inténtalo de nuevo.");
    } finally {
      setGenerando(false);
    }
  };

  return { exportar, generando };
}