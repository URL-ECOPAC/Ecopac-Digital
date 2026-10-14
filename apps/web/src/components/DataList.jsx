import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Table } from "react-bootstrap";
import {
  DIRECCIONES,
  formatearFechaConHora,
  formatearFechaCorta,
  formatearMoneda,
} from "@ecopac/shared";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import SecondaryButton from "./SecondaryButton";
import StatusChip from "./StatusChip";

/**
 * Listado generico. Igual que FilterBar, no conoce las columnas de ningun modulo: interpreta
 * la forma del descriptor y ya. En web se vuelve una <Table>; en movil, el mismo descriptor
 * se vuelve una tarjeta con los campos apilados.
 *
 * El valor de cada celda sale de la fila por `id`, o por `desde` si la columna lo declara
 * (ej. la columna 'estado' de COLUMNAS_USUARIO lee el campo 'activo').
 *
 * `accionSecundaria` (issue #108) agrega una segunda accion por fila, independiente de
 * `onRowPress`: una columna final sin encabezado con un boton que llama a `onClick(fila)`. Sin
 * esta prop la tabla se ve exactamente igual que antes -es aditiva-, y el click del boton no
 * dispara tambien `onRowPress` (se corta la propagacion en la celda que lo contiene). No hay
 * equivalente todavia en apps/mobile/src/components/DataList.js: queda pendiente para cuando
 * la pantalla que la necesite se porte a movil.
 *
 * ORDENAMIENTO (issue #862). `ordenarPor` y `onOrdenar` son igual de aditivas: una columna solo
 * se vuelve pulsable si declara `ordenable: true` EN SU DESCRIPTOR y ademas llega `onOrdenar`.
 * Sin las dos cosas, el <th> se dibuja exactamente como siempre, asi que las pantallas que no
 * las pasan -auditoria, catalogos, colaboradores- no cambian en nada.
 *
 * Este componente NO ORDENA. Solo avisa de que encabezado se pulso; quien reordena es el hook de
 * packages/shared (useOrdenYPagina), que es donde vive la regla de como se compara cada tipo y
 * donde puede probarse sin un DOM.
 *
 * MODO TARJETA (issue #862). Una tabla de nueve columnas -- COLUMNAS_PACIENTES_ATENDIDOS -- en un
 * telefono se recorta a tres y sin ninguna senal de que hay mas: era el peor problema de
 * responsividad de los reportes. Bajo 768px las mismas filas se apilan como tarjetas.
 *
 * Se resuelve en CSS y no duplicando el arbol ni midiendo el ancho con matchMedia: cada <td>
 * lleva su rotulo en `data-label` y la hoja lo pinta con ::before. Un solo DOM, sin estado de
 * layout dentro de un componente de presentacion, y sin el parpadeo de renderizar primero la
 * tabla y despues las tarjetas.
 *
 * Los `role` explicitos NO son decorativos: cambiar el `display` de un <table> le quita al
 * navegador la semantica de tabla, y un lector de pantalla deja de anunciar filas y columnas.
 * Declararlos a mano la conserva cuando el CSS de movil entra. Con `display: table` son
 * redundantes y no molestan.
 */

/** Iniciales de un nombre, para el avatar. Dos como maximo, que es lo que cabe en el circulo. */
function iniciales(texto) {
  return String(texto ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra[0] ?? "")
    .join("")
    .toUpperCase();
}

function Avatar({ texto }) {
  return (
    <span
      className="d-inline-flex align-items-center justify-content-center rounded-circle"
      style={{
        width: "40px",
        height: "40px",
        backgroundColor: "var(--color-primary)",
        color: "var(--color-surface)",
        fontSize: "var(--texto-sm)",
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
    case "avatar":
      return <Avatar texto={valor} />;

    case "numero":
      if (valor === null || valor === undefined) return null;
      return columna.sufijo ? `${valor} ${columna.sufijo}` : String(valor);

    case "moneda":
      // Mismo motivo que 'fecha': el importe se formatea en shared para que web y movil escriban
      // el mismo numero. Devuelve null si no hay valor, para no hacer pasar por cero un dato que
      // no se registro.
      return formatearMoneda(valor);

    case "fecha":
      // Sale de shared y no de Intl: el resultado tiene que ser identico en web y en movil,
      // y una cadena AAAA-MM-DD no se puede leer como instante o se corre un dia.
      return formatearFechaCorta(valor);

    case "fecha_hora":
      // Una marca de auditoria -cuando se registro, cuando se corrigio- es un instante, no un
      // dia de calendario: sin la hora, dos correcciones del mismo dia se leen iguales.
      return formatearFechaConHora(valor);

    case "chip":
      // A diferencia de 'estado', aqui el valor guardado YA es el del enum (ver
      // COLUMNAS_MOVIMIENTO y COLUMNAS_JORNADA), asi que indexa statusColors directamente.
      return <StatusChip status={valor} />;

    case "booleano":
      if (valor === null || valor === undefined) return null;
      return valor ? "Si" : "No";

    case "estado": {
      // Una columna de estado puede guardar un booleano y no el valor del enum (COLUMNAS_USUARIO
      // lee 'activo'). El catalogo trae la clave del enum en `clave` y el texto en `label`, que
      // es lo que statusColors sabe indexar y lo que la persona tiene que leer.
      const catalogo = catalogos[columna.etiquetasDesde] ?? [];
      const entrada = catalogo.find((opcion) => opcion.value === valor);
      return (
        <StatusChip
          status={entrada?.clave ?? valor}
          label={entrada?.label}
          icono={entrada?.icono}
        />
      );
    }

    case "chips": {
      const elementos = Array.isArray(valor) ? valor : [];
      if (elementos.length === 0) return null;
      // .ec-chip y no un <Badge bg="light">: el badge claro de Bootstrap es gris sobre gris y
      // apenas se distingue del fondo de la celda. El chip del sistema sale de los tokens y es
      // el mismo que se usa en la ficha del paciente y en la de colaborador.
      return (
        <span className="d-inline-flex flex-wrap gap-1">
          {elementos.map((elemento) => (
            <span className="ec-chip" key={String(elemento)}>
              {elemento}
            </span>
          ))}
        </span>
      );
    }

    default: {
      // Una columna puede declarar que su texto se traduce por un catalogo, como el rol de
      // COLUMNAS_USUARIO, que guarda el valor del enum pero muestra su etiqueta legible.
      if (columna.etiquetasDesde) {
        const catalogo = catalogos[columna.etiquetasDesde] ?? [];
        const opcion = catalogo.find((entrada) => entrada.value === valor);
        return opcion ? opcion.label : (valor ?? null);
      }
      return valor === null || valor === undefined ? null : String(valor);
    }
  }
}

/**
 * Encabezado de una columna. Es un <button> solo cuando de verdad ordena, y no un <th> con
 * onClick: sin boton no se alcanza con el teclado ni se anuncia como algo pulsable.
 */
function EncabezadoDeColumna({ columna, ordenarPor, onOrdenar }) {
  const ordenable = Boolean(columna.ordenable && onOrdenar);
  const activa = ordenarPor?.id === columna.id;
  const direccion = activa ? ordenarPor.direccion : null;

  // aria-sort va en el <th>, no en el boton: es una propiedad de la columna, no del control.
  const ariaSort = !ordenable
    ? undefined
    : direccion === DIRECCIONES.ASC
      ? "ascending"
      : direccion === DIRECCIONES.DESC
        ? "descending"
        : "none";

  if (!ordenable) {
    return (
      <th scope="col" role="columnheader" style={{ width: columna.anchoWeb }}>
        {columna.label}
      </th>
    );
  }

  const Flecha =
    direccion === DIRECCIONES.ASC
      ? ArrowUp
      : direccion === DIRECCIONES.DESC
        ? ArrowDown
        : ChevronsUpDown;

  return (
    <th scope="col" role="columnheader" aria-sort={ariaSort} style={{ width: columna.anchoWeb }}>
      <button type="button" className="ec-tabla-ordenar" onClick={() => onOrdenar(columna.id)}>
        {columna.label}
        {/* La flecha sola no dice que ordena: el texto accesible lo nombra, porque un icono
            girado no se lee en voz alta y el color tampoco distingue nada aqui. */}
        <Flecha size={14} aria-hidden="true" className={activa ? "es-activa" : undefined} />
        <span className="visually-hidden">
          {direccion === DIRECCIONES.ASC
            ? ": ordenado de menor a mayor"
            : direccion === DIRECCIONES.DESC
              ? ": ordenado de mayor a menor"
              : ": sin ordenar, pulsa para ordenar"}
        </span>
      </button>
    </th>
  );
}

/**
 * Clases de la celda segun lo que declare la columna.
 *
 * `uppercase` (issue #864) lo pide la columna, no el componente: DataList lo comparten todas las
 * pantallas y una regla global pondria en caja alta tambien las fechas y los nombres propios.
 * Se resuelve con `text-uppercase` y no con `.toUpperCase()` sobre el dato para que el texto que
 * lee un lector de pantalla siga siendo el original, y para que el valor que viaja a un CSV o a
 * un PDF no cambie.
 *
 * Al vivir en el <td>, `text-transform` alcanza tambien a lo que dibuja adentro un StatusChip,
 * que es lo que necesitan las columnas de estado de la bitacora.
 */
function clasesDeCelda(columna) {
  const clases = [];
  if (columna.principal) clases.push("fw-semibold");
  //  Aplica la clase en el <td> SI y SOLO SI uppercase === true
  if (columna.uppercase === true) {
    clases.push("text-uppercase");
  }
  return clases.length > 0 ? clases.join(" ") : undefined;
}

export default function DataList({
  columnas = [],
  datos = [],
  cargando = false,
  vacio,
  onRowPress,
  accionSecundaria,
  catalogos = {},
  ordenarPor,
  onOrdenar,
}) {
  if (cargando) return <LoadingState />;

  if (!datos || datos.length === 0) {
    return typeof vacio === "string" || vacio === undefined ? (
      <EmptyState message={vacio} />
    ) : (
      vacio
    );
  }

  const interactiva = typeof onRowPress === "function";
  const tieneAccionSecundaria = typeof accionSecundaria?.onClick === "function";

  return (
    // Las tablas densas del diseno (bodega, gastos, reportes) tienen mas columnas de las que
    // caben en una laptop de 1366x768. El scroll vive en este contenedor y no en el body, para
    // que la pagina entera no se desplace en horizontal.
    // .ec-tabla da el marco -borde, radio y elevacion-, que no puede ir en la <table>: con
    // border-collapse, una tabla no recorta sus propias esquinas.
    <div className="ec-tabla" style={{ overflowX: "auto" }}>
      <Table hover={interactiva} className="align-middle mb-0" role="table">
        <thead role="rowgroup">
          <tr role="row">
            {columnas.map((columna) => (
              <EncabezadoDeColumna
                key={columna.id}
                columna={columna}
                ordenarPor={ordenarPor}
                onOrdenar={onOrdenar}
              />
            ))}
            {tieneAccionSecundaria && <th scope="col" role="columnheader" aria-hidden="true" />}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {datos.map((fila, indice) => (
            <tr
              key={fila.id ?? indice}
              role="row"
              onClick={interactiva ? () => onRowPress(fila) : undefined}
              style={{ cursor: interactiva ? "pointer" : undefined }}
            >
              {columnas.map((columna) => (
                <td
                  key={columna.id}
                  role="cell"
                  // El rotulo viaja en el atributo para que el modo tarjeta lo pinte con ::before
                  // sin que el componente sepa a que ancho se esta dibujando (issue #862).
                  data-label={columna.label}
                  className={clasesDeCelda(columna)}
                >
                  <Celda
                    columna={columna}
                    fila={fila}
                    catalogos={catalogos}
                    forzarMayusculas={columna.uppercase === true}
                  />
                </td>
              ))}
              {tieneAccionSecundaria && (
                <td
                  role="cell"
                  className="text-end"
                  // Corta la propagacion: sin esto, el click del boton tambien dispararia
                  // onRowPress porque el <tr> escucha el evento en burbuja.
                  onClick={(evento) => evento.stopPropagation()}
                >
                  {/* Un boton de verdad y no un <Button variant="link">: ese lo dibuja
                    Bootstrap como un enlace azul subrayado -"Editar" al final de la fila de
                    donantes era el ejemplo-, que ni es del color de la marca ni se reconoce
                    como accion. El tamano pequeno lo mantiene dentro del alto de la fila. */}
                  <SecondaryButton
                    size="sm"
                    title={accionSecundaria.label}
                    onClick={() => accionSecundaria.onClick(fila)}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
