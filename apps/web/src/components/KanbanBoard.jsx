import { useState } from "react";

/**
 * Tablero kanban.
 *
 * No sabe cuantas columnas hay ni que representan: las declara el modulo que lo usa. Jornadas
 * lo usa con tres etapas y pacientes con cinco, y el componente es el mismo.
 *
 * Arrastrar y soltar con la API nativa del navegador, sin dependencias nuevas. En movil el
 * equivalente cambia de columna con un boton, porque arrastrar dentro de un ScrollView tactil
 * es poco confiable.
 *
 * El teclado tambien tiene que poder mover una tarjeta: arrastrar es exclusivo del raton, y
 * dejar la unica forma de mover en un gesto de raton deja fuera a quien navega con teclado.
 * Por eso cada tarjeta responde a las flechas izquierda y derecha.
 *
 * El punto y la pastilla del encabezado usan `--estado-<columna.id>`, la misma variable CSS que
 * StatusChip.jsx (publicada por theme.js a partir de statusColors de @ecopac/ui-tokens): el
 * componente sigue sin saber que representa cada columna, solo asume que `columna.id` es un
 * valor de un enum de estado, que es como Jornadas (y cualquier otro modulo que agrupe por
 * estado) ya nombra sus columnas. Si `columna.id` no tiene esa variable, cae al gris neutro de
 * `--color-secondary` por el propio valor de respaldo del var(), igual que StatusChip.
 *
 * `mensajeVacio` y `columnaAtenuada` son los dos puntos de personalizacion que le pide el modulo
 * que lo usa sin que el tablero necesite conocer el dominio: el texto de una columna sin
 * tarjetas, y si una columna en particular (por ejemplo un estado que es una salida del flujo,
 * no un paso mas) se pinta atenuada.
 */
export default function KanbanBoard({
  columnas = [],
  renderTarjeta,
  onMover,
  mensajeVacio = "Sin tarjetas",
  columnaAtenuada,
}) {
  const [arrastrada, setArrastrada] = useState(null);

  const mover = (tarjeta, origenId, destinoId) => {
    if (!destinoId || destinoId === origenId) return;
    onMover?.(tarjeta.id, origenId, destinoId);
  };

  const alSoltar = (destinoId) => {
    if (!arrastrada) return;
    mover(arrastrada.tarjeta, arrastrada.columnaId, destinoId);
    setArrastrada(null);
  };

  const conTeclado = (evento, tarjeta, indiceColumna) => {
    const salto = evento.key === "ArrowLeft" ? -1 : evento.key === "ArrowRight" ? 1 : 0;
    if (salto === 0) return;
    const destino = columnas[indiceColumna + salto];
    if (!destino) return;
    evento.preventDefault();
    mover(tarjeta, columnas[indiceColumna].id, destino.id);
  };

  return (
    <div className="d-flex gap-3" style={{ overflowX: "auto", alignItems: "flex-start" }}>
      {columnas.map((columna, indiceColumna) => {
        const tarjetas = columna.tarjetas ?? [];
        const colorEstado = `var(--estado-${String(columna.id).replace(/ /g, "-")}, var(--color-secondary))`;

        return (
          <section
            key={columna.id}
            className="rounded p-2"
            style={{
              flex: "0 0 280px",
              backgroundColor: "var(--color-background)",
              border: "1px solid var(--color-border)",
              opacity: columnaAtenuada?.(columna.id) ? 0.85 : 1,
            }}
            onDragOver={(evento) => evento.preventDefault()}
            onDrop={() => alSoltar(columna.id)}
          >
            <div className="d-flex align-items-center justify-content-between px-1 py-2 mb-2">
              <h3 className="h6 d-flex align-items-center gap-2 mb-0">
                <span
                  aria-hidden="true"
                  className="rounded-circle"
                  style={{
                    width: "var(--spacing-sm)",
                    height: "var(--spacing-sm)",
                    backgroundColor: colorEstado,
                    flex: "0 0 auto",
                  }}
                />
                {columna.titulo}
              </h3>
              <span
                className="badge rounded-pill"
                style={{
                  backgroundColor: `color-mix(in srgb, ${colorEstado} 13%, transparent)`,
                  color: colorEstado,
                }}
              >
                {tarjetas.length}
              </span>
            </div>

            {tarjetas.length === 0 ? (
              <div
                className="rounded text-center small px-2 py-4"
                style={{
                  border: "1px dashed var(--color-border)",
                  color: "var(--color-text-muted)",
                }}
              >
                {mensajeVacio}
              </div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {tarjetas.map((tarjeta) => (
                  <div
                    key={tarjeta.id}
                    draggable
                    tabIndex={0}
                    onKeyDown={(evento) => conTeclado(evento, tarjeta, indiceColumna)}
                    onDragStart={() => setArrastrada({ tarjeta, columnaId: columna.id })}
                    onDragEnd={() => setArrastrada(null)}
                    style={{ cursor: "grab" }}
                  >
                    {renderTarjeta?.(tarjeta)}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
