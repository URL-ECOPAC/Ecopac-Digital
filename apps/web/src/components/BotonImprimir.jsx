import { Printer } from "lucide-react";
import SecondaryButton from "./SecondaryButton";

/**
 * Boton de sacar algo en papel: reportes, kardex, cuadro de turnos, constancia, receta.
 *
 * Reemplaza a BotonExportarPDF (issue #862). El texto dice "Imprimir / PDF" y no "Exportar PDF"
 * porque es lo que de verdad ocurre: se abre el dialogo de impresion del navegador, y de ahi sale
 * tanto la hoja como el PDF por "Guardar como PDF". Es el unico boton de imprimir del sistema, junto
 * a su gemelo BotonExportarCSV: cada pantalla que imprime lo usa, en vez de su propio texto.
 *
 * @param {{ onClick: () => void, disabled?: boolean, size?: "sm" }} props `size="sm"` dentro de
 *   una tarjeta, donde el tamano normal pesa demasiado.
 */
export default function BotonImprimir({ onClick, disabled = false, size }) {
  return (
    <SecondaryButton
      title="Imprimir / PDF"
      onClick={onClick}
      disabled={disabled}
      size={size}
      icon={<Printer size={16} aria-hidden="true" />}
    />
  );
}
