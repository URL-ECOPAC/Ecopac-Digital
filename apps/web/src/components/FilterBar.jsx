import { SUBTIPOS_DE_RANGO, TIPOS_DE_FILTRO } from "@ecopac/shared";
import DateField from "./DateField";
import NumberField from "./NumberField";
import SecondaryButton from "./SecondaryButton";
import Selector from "./Selector";
import TextField from "./TextField";

/**
 * Un rango como dos campos del mismo aspecto que cualquier otro filtro, uno al lado del otro y
 * separados por un guion.
 *
 * Antes eran dos variantes que no se parecian a nada: un marco comun con los dos campos sin borde
 * por dentro, y -para la edad- un desplegable de grupos que al elegir "Personalizado" abria ese
 * marco debajo, cambiando la altura de la barra entera. Ahora un rango ocupa lo mismo que un
 * filtro doble y se lee como dos cuadros para escribir, que es lo que es.
 */
function Rango({ campo, rango, onChange }) {
  const esFecha = campo.subtipo === SUBTIPOS_DE_RANGO.FECHA;
  const etiqueta = campo.sufijo ? `${campo.label} (${campo.sufijo})` : campo.label;

  const desde = esFecha ? (
    <DateField
      aria-label={`${campo.label}: desde`}
      value={rango.min ?? null}
      maxDate={rango.max ?? undefined}
      onChange={(nuevo) => onChange({ ...rango, min: nuevo })}
      style={{ marginBottom: 0 }}
    />
  ) : (
    <NumberField
      aria-label={`${campo.label}: desde`}
      placeholder="Desde"
      value={rango.min ?? null}
      min={campo.min}
      max={rango.max ?? campo.max}
      onChange={(nuevo) => onChange({ ...rango, min: nuevo })}
      style={{ marginBottom: 0 }}
    />
  );

  const hasta = esFecha ? (
    <DateField
      aria-label={`${campo.label}: hasta`}
      value={rango.max ?? null}
      minDate={rango.min ?? undefined}
      onChange={(nuevo) => onChange({ ...rango, max: nuevo })}
      style={{ marginBottom: 0 }}
    />
  ) : (
    <NumberField
      aria-label={`${campo.label}: hasta`}
      placeholder="Hasta"
      value={rango.max ?? null}
      min={rango.min ?? campo.min}
      max={campo.max}
      onChange={(nuevo) => onChange({ ...rango, max: nuevo })}
      style={{ marginBottom: 0 }}
    />
  );

  return (
    <fieldset className="ec-filtro ec-filtro--rango">
      <legend className="form-label">{etiqueta}</legend>
      <div className="ec-rango-doble">
        {desde}
        <span className="ec-rango-separador" aria-hidden="true">
          -
        </span>
        {hasta}
      </div>
    </fieldset>
  );
}

/**
 * Barra de filtros. Es deliberadamente tonta: no conoce los filtros de ningun modulo, solo sabe
 * interpretar la forma generica de un descriptor. El mismo componente sirve para pacientes,
 * inventario, gastos o reportes porque toda la informacion especifica vive en shared.
 *
 * No guarda estado propio: llama a onChange(id, valor) y quien lo usa decide que hacer.
 *
 * Sobre `catalogos`: los descriptores declaran de DONDE salen las opciones de un select
 * (`opcionesDesde: 'comunidades'`), no cuales son. Quien tiene esos datos los inyecta aqui. Un
 * catalogo que todavia no cargo deja el select vacio y deshabilitado.
 *
 * Un filtro de rango se representa como { min, max }; cualquiera de los dos extremos puede ser
 * null ("sin limite por ese lado"). De que es el rango lo dice `subtipo` (issue #386); un rango
 * sin subtipo cae en numero, y que no pase lo comprueba packages/shared/filtros.test.js.
 *
 * LA BARRA ES LA TARJETA. Cada pantalla la envolvia a su manera -en una tarjeta en pacientes y
 * gastos, suelta en reportes- y ponia "Limpiar filtros" donde podia: debajo a la derecha, debajo
 * a la izquierda, o solo cuando habia algun filtro puesto, asi que el boton aparecia y
 * desaparecia moviendo la pantalla. Ahora:
 *
 *   - `onLimpiar`: el boton va SIEMPRE, al final de la ultima fila, deshabilitado mientras no
 *     haya nada que limpiar (`hayFiltros`).
 *   - `children`: controles de la pantalla que no son un filtro del descriptor ("Agrupar por")
 *     y van en la misma barra, antes del boton.
 */
export default function FilterBar({
  campos = [],
  valores = {},
  onChange,
  catalogos = {},
  onLimpiar,
  hayFiltros = true,
  children,
}) {
  const cambiar = (id, valor) => onChange?.(id, valor);

  return (
    <div className="ec-filtros">
      {campos.map((campo) => {
        const valor = valores[campo.id];

        if (campo.tipo === TIPOS_DE_FILTRO.BUSQUEDA) {
          return (
            <div key={campo.id} className="ec-filtro ec-filtro--busqueda">
              <TextField
                label={campo.label}
                placeholder={campo.placeholder}
                value={valor ?? ""}
                onChange={(evento) => cambiar(campo.id, evento.target.value)}
                style={{ marginBottom: 0 }}
              />
            </div>
          );
        }

        if (campo.tipo === TIPOS_DE_FILTRO.SELECT) {
          // Un descriptor puede traer sus opciones ya escritas (un enum cerrado) o decir de que
          // catalogo salen (las que vienen de la base de datos).
          const opciones = campo.opciones ?? catalogos[campo.opcionesDesde] ?? [];
          return (
            <div key={campo.id} className="ec-filtro">
              <Selector
                label={campo.label}
                value={valor ?? null}
                options={opciones}
                onSelect={(elegido) => cambiar(campo.id, elegido)}
                placeholder={campo.placeholder ?? "Todos"}
                disabled={opciones.length === 0}
                style={{ marginBottom: 0 }}
              />
            </div>
          );
        }

        if (campo.tipo === TIPOS_DE_FILTRO.RANGO) {
          return (
            <Rango
              key={campo.id}
              campo={campo}
              rango={valor ?? {}}
              onChange={(nuevo) => cambiar(campo.id, nuevo)}
            />
          );
        }

        // Un tipo que este componente todavia no sabe dibujar se omite en vez de tumbar la
        // pantalla entera: el resto de los filtros sigue siendo util.
        return null;
      })}

      {children}

      {onLimpiar && (
        <div className="ec-filtros-limpiar">
          <SecondaryButton
            title="Limpiar filtros"
            variant="neutra"
            onClick={onLimpiar}
            disabled={!hayFiltros}
          />
        </div>
      )}
    </div>
  );
}
