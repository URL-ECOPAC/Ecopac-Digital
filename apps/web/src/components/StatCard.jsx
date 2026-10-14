/**
 * Tarjeta de indicador: un rotulo, una cifra y un pie.
 *
 * Es la tarjeta que el modulo de inventario ya tenia -rotulo en versalitas del color del
 * indicador, cifra grande, pie apagado- y que el resto de los modulos no. Ahi estaba escrita con
 * hexadecimales en linea ("#10b981", "#94a3b8", "28px"), repetida cuatro veces en el mismo
 * archivo; donaciones y presupuestos tenian su propia version plana, cada una distinta.
 *
 * El aspecto entero lo resuelve .ec-kpi en src/ui.css contra los tokens. Aqui solo se elige el
 * acento, que viaja como la custom property --ec-acento: se le pasa una variable de tokens
 * (`var(--accent-inventario)`, `var(--color-danger)`), nunca un color escrito a mano.
 *
 * `esTexto` existe porque no todo indicador es un numero: "Sin costo registrado" al tamano de
 * una cifra se parte en tres lineas y desalinea la fila entera de tarjetas.
 *
 * Espejo de apps/mobile/src/components/StatCard.js.
 *
 * @param {object} props
 * @param {string} props.label Rotulo del indicador, en versalitas.
 * @param {import("react").ReactNode} props.value La cifra.
 * @param {string} [props.caption] Pie: la unidad, el periodo o la salvedad.
 * @param {string} [props.accent] Variable CSS del acento, ej. "var(--color-warning)".
 * @param {boolean} [props.esTexto] El valor es una frase, no un numero.
 * @param {() => void} [props.onClick] Si se pasa, la tarjeta se vuelve pulsable.
 */
export default function StatCard({
  label,
  value,
  caption,
  accent = "var(--color-primary)",
  esTexto = false,
  onClick,
  style,
  ...rest
}) {
  const interactiva = typeof onClick === "function";

  const propsDeInteraccion = interactiva
    ? {
        role: "button",
        tabIndex: 0,
        onClick,
        onKeyDown: (evento) => {
          if (evento.key === "Enter" || evento.key === " ") {
            evento.preventDefault();
            onClick(evento);
          }
        },
      }
    : {};

  return (
    <div
      className="ec-kpi"
      style={{ "--ec-acento": accent, ...style }}
      {...propsDeInteraccion}
      {...rest}
    >
      <span className="ec-kpi-etiqueta">{label}</span>
      <p className={`ec-kpi-valor${esTexto ? " ec-kpi-valor--texto" : ""}`}>{value}</p>
      {caption && <span className="ec-kpi-pie">{caption}</span>}
    </div>
  );
}
