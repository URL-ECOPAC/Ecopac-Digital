import { Printer } from "lucide-react";
import SecondaryButton from "./SecondaryButton";

/**
 * Boton de sacar un reporte en papel (issue #862).
 *
 * Reemplaza a BotonExportarPDF. El texto dice "Imprimir / PDF" y no "Exportar PDF" porque es lo
 * que de verdad ocurre: se abre el dialogo de impresion del navegador, y de ahi sale tanto la
 * hoja como el PDF por "Guardar como PDF". El boton anterior prometia un archivo que nadie
 * generaba -no habia ni una libreria de PDF en el repositorio- y que ademas fallaba al pulsarlo.
 */
export default function BotonImprimir({ onClick, disabled = false }) {
  return (
    <SecondaryButton
      title="Imprimir / PDF"
      onClick={onClick}
      disabled={disabled}
      icon={<Printer size={16} aria-hidden="true" />}
    />
  );
}
