/**
 * Botonera de rangos de fecha de los reportes ("Última semana", "Este mes"...).
 *
 * El panel de impacto y el reporte de pacientes la dibujaban cada uno a su manera -uno con el
 * verde solido del sistema para el activo, el otro con dos variantes de contorno que casi no se
 * distinguian-. Ahora es una sola: el rango elegido en verde solido y el resto en contorno gris.
 *
 * @param {{ opciones: Array<{ value: string, label: string }>, activo: string|null,
 *   onElegir: (valor: string) => void }} props
 */
export default function BotonesDeRango({ opciones = [], activo, onElegir }) {
  return (
    <div className="reporte-presets" role="group" aria-label="Rango de fechas">
      {opciones.map((opcion) => (
        <button
          key={opcion.value}
          type="button"
          onClick={() => onElegir(opcion.value)}
          aria-pressed={activo === opcion.value}
          className={`btn btn-sm ${
            activo === opcion.value ? "btn-primary" : "btn-outline-secondary"
          }`}
        >
          {opcion.label}
        </button>
      ))}
    </div>
  );
}
