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
 */
export default function KanbanBoard({ columnas = [], renderTarjeta, onMover }) {
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
      {columnas.map((columna, indiceColumna) => (
        <section
          key={columna.id}
          className="rounded p-2"
          style={{
            flex: "0 0 280px",
            backgroundColor: "var(--color-background)",
            border: "1px solid var(--color-border)",
          }}
          onDragOver={(evento) => evento.preventDefault()}
          onDrop={() => alSoltar(columna.id)}
        >
          <h3 className="h6 px-1 py-2 mb-2" style={{ color: "var(--color-text-muted)" }}>
            {columna.titulo}
            <span className="ms-2">{(columna.tarjetas ?? []).length}</span>
          </h3>

          <div className="d-flex flex-column gap-2">
            {(columna.tarjetas ?? []).map((tarjeta) => (
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
        </section>
      ))}
    </div>
  );
}
