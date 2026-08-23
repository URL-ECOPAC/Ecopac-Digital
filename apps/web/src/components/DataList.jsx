import { Badge, Table } from 'react-bootstrap';
import { formatearFechaCorta } from '@ecopac/shared';
import EmptyState from './EmptyState';
import LoadingState from './LoadingState';
import StatusChip from './StatusChip';
import { normalizarOpciones } from './opciones';

/**
 * Listado generico. Igual que FilterBar, no conoce las columnas de ningun modulo: interpreta
 * la forma del descriptor y ya. En web se vuelve una <Table>; en movil, el mismo descriptor
 * se vuelve una tarjeta con los campos apilados.
 *
 * El valor de cada celda sale de la fila por `id`, o por `desde` si la columna lo declara
 * (ej. la columna 'estado' de COLUMNAS_USUARIO lee el campo 'activo').
 */

/** Iniciales de un nombre, para el avatar. Dos como maximo, que es lo que cabe en el circulo. */
function iniciales(texto) {
  return String(texto ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra[0] ?? '')
    .join('')
    .toUpperCase();
}

function Avatar({ texto }) {
  return (
    <span
      className="d-inline-flex align-items-center justify-content-center rounded-circle"
      style={{
        width: '40px',
        height: '40px',
        backgroundColor: 'var(--color-primary)',
        color: 'var(--color-surface)',
        fontSize: '0.85rem',
        fontWeight: 600,
      }}
      aria-hidden="true"
    >
      {iniciales(texto)}
    </span>
  );
}

/** Dibuja una celda segun el tipo que declara la columna. */
function Celda({ columna, fila, catalogos }) {
  const valor = fila?.[columna.desde ?? columna.id];

  switch (columna.tipo) {
    case 'avatar':
      return <Avatar texto={valor} />;

    case 'numero':
      if (valor === null || valor === undefined) return null;
      return columna.sufijo ? `${valor} ${columna.sufijo}` : String(valor);

    case 'fecha':
      // Sale de shared y no de Intl: el resultado tiene que ser identico en web y en movil,
      // y una cadena AAAA-MM-DD no se puede leer como instante o se corre un dia.
      return formatearFechaCorta(valor);

    case 'chip':
      // A diferencia de 'estado', aqui el valor guardado YA es el del enum (ver
      // COLUMNAS_MOVIMIENTO y COLUMNAS_JORNADA), asi que indexa statusColors directamente.
      return <StatusChip status={valor} />;

    case 'booleano':
      if (valor === null || valor === undefined) return null;
      return valor ? 'Si' : 'No';

    case 'estado': {
      // Una columna de estado puede guardar un booleano y no el valor del enum (COLUMNAS_USUARIO
      // lee 'activo'). El catalogo trae la clave del enum en `clave` y el texto en `label`, que
      // es lo que statusColors sabe indexar y lo que la persona tiene que leer.
      const catalogo = normalizarOpciones(catalogos[columna.etiquetasDesde]);
      const entrada = catalogo.find((opcion) => opcion.value === valor);
      return <StatusChip status={entrada?.clave ?? valor} label={entrada?.label} />;
    }

    case 'chips': {
      const elementos = Array.isArray(valor) ? valor : [];
      if (elementos.length === 0) return null;
      return (
        <span className="d-inline-flex flex-wrap gap-1">
          {elementos.map((elemento) => (
            <Badge key={String(elemento)} bg="light" text="dark">
              {elemento}
            </Badge>
          ))}
        </span>
      );
    }

    default: {
      // Una columna puede declarar que su texto se traduce por un catalogo, como el rol de
      // COLUMNAS_USUARIO, que guarda el valor del enum pero muestra su etiqueta legible.
      if (columna.etiquetasDesde) {
        const catalogo = normalizarOpciones(catalogos[columna.etiquetasDesde]);
        const opcion = catalogo.find((entrada) => entrada.value === valor);
        return opcion ? opcion.label : (valor ?? null);
      }
      return valor === null || valor === undefined ? null : String(valor);
    }
  }
}

export default function DataList({
  columnas = [],
  datos = [],
  cargando = false,
  vacio,
  onRowPress,
  catalogos = {},
}) {
  if (cargando) return <LoadingState />;

  if (!datos || datos.length === 0) {
    return typeof vacio === 'string' || vacio === undefined ? (
      <EmptyState message={vacio} />
    ) : (
      vacio
    );
  }

  const interactiva = typeof onRowPress === 'function';

  return (
    // Las tablas densas del diseno (bodega, gastos, reportes) tienen mas columnas de las que
    // caben en una laptop de 1366x768. El scroll vive en este contenedor y no en el body, para
    // que la pagina entera no se desplace en horizontal.
    <div style={{ overflowX: 'auto' }}>
      <Table hover={interactiva} className="align-middle mb-0 bg-white">
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th key={columna.id} scope="col" style={{ width: columna.anchoWeb }}>
                {columna.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {datos.map((fila, indice) => (
            <tr
              key={fila.id ?? indice}
              onClick={interactiva ? () => onRowPress(fila) : undefined}
              style={{ cursor: interactiva ? 'pointer' : undefined }}
            >
              {columnas.map((columna) => (
                <td key={columna.id} className={columna.principal ? 'fw-semibold' : undefined}>
                  <Celda columna={columna} fila={fila} catalogos={catalogos} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
