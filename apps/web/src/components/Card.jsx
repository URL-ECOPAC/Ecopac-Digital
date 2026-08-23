import { Card as CardBootstrap } from 'react-bootstrap';

/**
 * Tarjeta: base visual de cualquier bloque agrupado de un dashboard, y de las tarjetas que
 * DataList dibuja en movil.
 *
 * Si se pasa `onClick` la tarjeta se vuelve interactiva, y entonces tiene que serlo tambien
 * para el teclado y para un lector de pantalla: por eso recibe role, tabIndex y responde a
 * Enter y espacio. Un div con onClick y nada mas solo funciona con raton.
 */
export default function Card({ children, title, onClick, style, ...rest }) {
  const interactiva = typeof onClick === 'function';

  const propsDeInteraccion = interactiva
    ? {
        role: 'button',
        tabIndex: 0,
        onClick,
        onKeyDown: (evento) => {
          if (evento.key === 'Enter' || evento.key === ' ') {
            evento.preventDefault();
            onClick(evento);
          }
        },
      }
    : {};

  return (
    <CardBootstrap
      style={{ cursor: interactiva ? 'pointer' : undefined, ...style }}
      {...propsDeInteraccion}
      {...rest}
    >
      <CardBootstrap.Body>
        {title && <CardBootstrap.Title as="h2" className="h6">{title}</CardBootstrap.Title>}
        {children}
      </CardBootstrap.Body>
    </CardBootstrap>
  );
}
