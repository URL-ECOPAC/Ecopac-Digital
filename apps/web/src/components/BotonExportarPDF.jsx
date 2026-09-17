import { FileDown } from "lucide-react";
import SecondaryButton from "./SecondaryButton";

/**
 * Boton de exportar un reporte a PDF (issue #216).
 *
 * Era un <button> con estilos en linea -verde "#059669", gris "#94a3b8" al generar, radio de 6px-
 * que no se parecia al "Exportar CSV" de al lado, un SecondaryButton. Ahora son el mismo boton:
 * contorno, misma letra, mismo radio, y el giro de carga del catalogo mientras se genera.
 */
export default function BotonExportarPDF({ onClick, generando = false }) {
  return (
    <SecondaryButton
      title={generando ? "Generando PDF..." : "Exportar PDF"}
      onClick={onClick}
      disabled={generando}
      icon={<FileDown size={16} aria-hidden="true" />}
    />
  );
}
