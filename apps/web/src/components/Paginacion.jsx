import SecondaryButton from "./SecondaryButton";

/**
 * Pie de paginacion de un listado (issue #862).
 *
 * POR QUE EXISTE. El mismo bloque -dos SecondaryButton y un "Pagina X de Y" en medio- estaba
 * escrito a mano en BitacoraAuditoriaPage.jsx y en ColaboradoresPage.jsx, y los cuatro reportes
 * lo necesitaban para dejar de volcar cientos de filas de una sola vez. Tres copias del mismo
 * pie era el momento de subirlo al catalogo.
 *
 * NO PAGINA NADA: solo dibuja y avisa. Que filas caen en cada pagina lo decide el hook de
 * packages/shared, igual que en DataList. Aqui no hay estado.
 *
 * Con una sola pagina no se dibuja: un pie que siempre dice "Pagina 1 de 1" con los dos botones
 * apagados es ruido, y asi la pantalla no tiene que envolver la llamada en un condicional.
 *
 * El rotulo va en un aria-live="polite" porque cambiar de pagina no mueve el foco: sin esto, un
 * lector de pantalla anuncia que se pulso "Siguiente" pero nunca que ahora se esta en la 3 de 7.
 *
 * @param {object} props
 * @param {number} props.pagina Pagina actual, empezando en 1.
 * @param {number} props.totalPaginas
 * @param {(pagina: number) => void} props.onCambiar Recibe el numero de pagina destino.
 */
export default function Paginacion({ pagina, totalPaginas, onCambiar }) {
  if (!totalPaginas || totalPaginas <= 1) return null;

  const hayAnterior = pagina > 1;
  const haySiguiente = pagina < totalPaginas;

  return (
    <nav
      className="d-flex justify-content-between align-items-center mt-3 gap-2"
      aria-label="Paginacion"
    >
      <SecondaryButton
        title="Anterior"
        onClick={() => onCambiar(pagina - 1)}
        disabled={!hayAnterior}
      />

      <span aria-live="polite" style={{ color: "var(--color-text-muted)" }}>
        Pagina {pagina} de {totalPaginas}
      </span>

      <SecondaryButton
        title="Siguiente"
        onClick={() => onCambiar(pagina + 1)}
        disabled={!haySiguiente}
      />
    </nav>
  );
}
