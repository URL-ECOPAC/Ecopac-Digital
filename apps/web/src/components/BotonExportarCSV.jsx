import { FileDown } from "lucide-react";
import SecondaryButton from "./SecondaryButton";

/**
 * Boton de descargar un listado como CSV (issue #862).
 *
 * Gemelo de BotonImprimir. Existe porque el CSV se ofrecia de tres formas distintas: con un
 * SecondaryButton en dos pantallas, con un <button> de clase propia (.reporte-exportar) en el
 * reporte de jornada, y con una clase de Bootstrap cruda en el dashboard.
 */
export default function BotonExportarCSV({ onClick, disabled = false, title = "Exportar CSV" }) {
  return (
    <SecondaryButton
      title={title}
      onClick={onClick}
      disabled={disabled}
      icon={<FileDown size={16} aria-hidden="true" />}
    />
  );
}
