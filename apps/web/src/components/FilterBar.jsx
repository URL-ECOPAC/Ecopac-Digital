import { TIPOS_DE_FILTRO } from '@ecopac/shared';
import DateField from './DateField';
import NumberField from './NumberField';
import Selector from './Selector';
import TextField from './TextField';

/**
 * Barra de filtros. Es deliberadamente tonta: no conoce los filtros de ningun modulo, solo
 * sabe interpretar la forma generica de un descriptor. El mismo componente sirve para
 * pacientes, inventario o donaciones porque toda la informacion especifica vive en shared.
 *
 * No guarda estado propio: llama a onChange(id, valor) y quien lo usa decide que hacer.
 *
 * Sobre `catalogos`: los descriptores declaran de DONDE salen las opciones de un select
 * (`opcionesDesde: 'comunidades'`), no cuales son, porque varias listas salen de la base de
 * datos. Quien tiene esos datos -la pantalla o su hook- los inyecta aqui. Un catalogo que
 * todavia no cargo deja el select vacio y deshabilitado, en vez de reventar o de mostrar un
 * desplegable que no hace nada.
 *
 * Un filtro de rango se representa como { min, max }; cualquiera de los dos extremos puede
 * ser null, que significa "sin limite por ese lado". Hay rangos numericos (rangoEdad) y de
 * fecha (rangoFecha, fechaVencimiento): se distinguen por `subtipo: 'fecha'` si el
 * descriptor lo declara, y si no por si trae limites numericos. Lo correcto seria que el
 * descriptor siempre lo dijera; mientras tanto esta heuristica acierta con los que existen.
 */
export default function FilterBar({ campos = [], valores = {}, onChange, catalogos = {} }) {
  const cambiar = (id, valor) => onChange?.(id, valor);

  return (
    <div className="d-flex flex-wrap align-items-start gap-3 mb-3">
      {campos.map((campo) => {
        const valor = valores[campo.id];

        if (campo.tipo === TIPOS_DE_FILTRO.BUSQUEDA) {
          return (
            <TextField
              key={campo.id}
              label={campo.label}
              placeholder={campo.placeholder}
              value={valor ?? ''}
              onChange={(evento) => cambiar(campo.id, evento.target.value)}
              style={{ flex: '1 1 260px', marginBottom: 0 }}
            />
          );
        }

        if (campo.tipo === TIPOS_DE_FILTRO.SELECT) {
          // Un descriptor puede traer sus opciones ya escritas (las de un enum cerrado, como
          // presentacion o estado) o decir de que catalogo salen (las que vienen de la base
          // de datos). Selector normaliza la forma de cada opcion.
          const opciones = campo.opciones ?? catalogos[campo.opcionesDesde] ?? [];
          return (
            <Selector
              key={campo.id}
              label={campo.label}
              value={valor ?? null}
              options={opciones}
              onSelect={(elegido) => cambiar(campo.id, elegido)}
              placeholder={campo.placeholder ?? 'Todos'}
              disabled={opciones.length === 0}
              style={{ flex: '0 1 200px', marginBottom: 0 }}
            />
          );
        }

        if (campo.tipo === TIPOS_DE_FILTRO.RANGO) {
          const rango = valor ?? {};
          const esFecha =
            campo.subtipo === 'fecha' ||
            (typeof campo.min !== 'number' && typeof campo.max !== 'number');

          if (esFecha) {
            // Sin `label` en cada DateField a proposito: con label, cada campo agrega su propia
            // fila ("Desde"/"Hasta") ademas de la del legend ("Fecha"), y el bloque completo
            // termina una fila mas abajo que un filtro de un solo control (Estado, Comunidad).
            // "Desde"/"Hasta" se pintan en linea, junto al control, para que este filtro quede en
            // las mismas dos filas -etiqueta y control- que cualquier otro.
            return (
              <fieldset key={campo.id} className="border-0 p-0 m-0" style={{ flex: '0 1 320px' }}>
                <legend className="form-label fs-6">{campo.label}</legend>
                <div className="d-flex align-items-center gap-2">
                  <span className="small" style={{ color: 'var(--color-text-muted)' }}>
                    Desde
                  </span>
                  <DateField
                    aria-label="Desde"
                    value={rango.min ?? null}
                    maxDate={rango.max ?? undefined}
                    onChange={(nuevo) => cambiar(campo.id, { ...rango, min: nuevo })}
                    style={{ marginBottom: 0 }}
                  />
                  <span className="small" style={{ color: 'var(--color-text-muted)' }}>
                    Hasta
                  </span>
                  <DateField
                    aria-label="Hasta"
                    value={rango.max ?? null}
                    minDate={rango.min ?? undefined}
                    onChange={(nuevo) => cambiar(campo.id, { ...rango, max: nuevo })}
                    style={{ marginBottom: 0 }}
                  />
                </div>
              </fieldset>
            );
          }

          return (
            <fieldset key={campo.id} className="border-0 p-0 m-0" style={{ flex: '0 1 240px' }}>
              <legend className="form-label fs-6">{campo.label}</legend>
              <div className="d-flex align-items-start gap-2">
                <NumberField
                  label="Desde"
                  value={rango.min ?? null}
                  min={campo.min}
                  max={rango.max ?? campo.max}
                  onChange={(nuevo) => cambiar(campo.id, { ...rango, min: nuevo })}
                  style={{ marginBottom: 0 }}
                />
                <NumberField
                  label="Hasta"
                  value={rango.max ?? null}
                  min={rango.min ?? campo.min}
                  max={campo.max}
                  onChange={(nuevo) => cambiar(campo.id, { ...rango, max: nuevo })}
                  style={{ marginBottom: 0 }}
                />
              </div>
            </fieldset>
          );
        }

        // Un tipo que este componente todavia no sabe dibujar se omite en silencio en vez de
        // tumbar la pantalla entera: el resto de los filtros sigue siendo util.
        return null;
      })}
    </div>
  );
}
