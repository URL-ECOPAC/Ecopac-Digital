import { useState } from "react";

import { grupoDeEdadDe, SUBTIPOS_DE_RANGO, TIPOS_DE_FILTRO } from "@ecopac/shared";
import DateField from "./DateField";
import NumberField from "./NumberField";
import Selector from "./Selector";
import TextField from "./TextField";

/** Valor del desplegable cuando se quiere escribir un rango exacto. */
const PERSONALIZADO = "personalizado";

/** Los dos extremos de un rango numerico, en un solo marco. */
function RangoNumerico({ campo, rango, onChange }) {
  return (
    <div className="ec-rango">
      <NumberField
        aria-label={`${campo.label}: desde`}
        placeholder="min"
        value={rango.min ?? null}
        min={campo.min}
        max={rango.max ?? campo.max}
        onChange={(nuevo) => onChange({ ...rango, min: nuevo })}
        style={{ marginBottom: 0, flex: "1 1 0" }}
      />
      <span className="ec-rango-separador" aria-hidden="true">
        —
      </span>
      <NumberField
        aria-label={`${campo.label}: hasta`}
        placeholder="max"
        value={rango.max ?? null}
        min={rango.min ?? campo.min}
        max={campo.max}
        onChange={(nuevo) => onChange({ ...rango, max: nuevo })}
        style={{ marginBottom: 0, flex: "1 1 0" }}
      />
      {campo.sufijo && <span className="ec-rango-sufijo">{campo.sufijo}</span>}
    </div>
  );
}

/**
 * Rango numerico elegido por grupos, con salida a un rango exacto.
 *
 * El grupo activo se deriva del rango (grupoDeEdadDe), no se guarda: asi "Limpiar filtros" -que
 * pone el rango en null desde fuera- devuelve el desplegable a "Todas" sin que este componente
 * tenga que enterarse. Lo unico que si es estado propio es haber PEDIDO el modo personalizado,
 * porque en ese momento todavia no hay ningun rango del que derivarlo.
 */
function RangoPorGrupos({ campo, rango, onChange }) {
  const [personalizando, setPersonalizando] = useState(false);

  const hayRango = rango.min !== undefined && rango.min !== null;
  const grupoActivo = grupoDeEdadDe(rango);
  const enPersonalizado = personalizando || (hayRango && !grupoActivo);

  const opciones = [
    ...campo.presets.map((grupo) => ({ value: grupo.id, label: grupo.label })),
    { value: PERSONALIZADO, label: "Personalizado..." },
  ];

  const elegir = (valor) => {
    if (valor === PERSONALIZADO) {
      setPersonalizando(true);
      return;
    }

    setPersonalizando(false);

    if (valor === null) {
      onChange(null);
      return;
    }

    const grupo = campo.presets.find((preset) => preset.id === valor);
    if (grupo) onChange({ min: grupo.min, max: grupo.max });
  };

  return (
    <fieldset
      className="border-0 p-0 m-0"
      style={{ flex: enPersonalizado ? "0 1 300px" : "0 1 220px" }}
    >
      <legend className="form-label">{campo.label}</legend>
      <Selector
        aria-label={campo.label}
        value={enPersonalizado ? PERSONALIZADO : grupoActivo}
        options={opciones}
        onSelect={elegir}
        placeholder="Todas las edades"
        style={{ marginBottom: enPersonalizado ? "var(--spacing-sm)" : 0 }}
      />
      {enPersonalizado && <RangoNumerico campo={campo} rango={rango} onChange={onChange} />}
    </fieldset>
  );
}

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
 * ser null, que significa "sin limite por ese lado". De que es el rango lo dice el descriptor
 * en `subtipo` (issue #386), y aqui no se adivina: antes, si no lo declaraba, se miraba si
 * traia limites numericos, y un rango numerico sin limites -legitimo- habria dibujado
 * selectores de fecha sin que nadie lo notara hasta usarlo.
 *
 * Un rango sin `subtipo` cae en NumberField. Es a proposito y no al reves: siete de los ocho
 * rangos son de fecha, asi que el defecto contrario taparia el olvido. Que no llegue a pasar
 * lo comprueba packages/shared/filtros.test.js.
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
              value={valor ?? ""}
              onChange={(evento) => cambiar(campo.id, evento.target.value)}
              style={{ flex: "1 1 260px", marginBottom: 0 }}
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
              placeholder={campo.placeholder ?? "Todos"}
              disabled={opciones.length === 0}
              style={{ flex: "0 1 200px", marginBottom: 0 }}
            />
          );
        }

        if (campo.tipo === TIPOS_DE_FILTRO.RANGO) {
          const rango = valor ?? {};
          const esFecha = campo.subtipo === SUBTIPOS_DE_RANGO.FECHA;

          // Los dos extremos dentro de un solo marco, separados por un guion.
          //
          // Antes eran dos campos con su propia etiqueta ("Desde", "Hasta") debajo del legend
          // del filtro: tres filas de alto contra las dos de cualquier otro filtro, lo que
          // desalineaba la barra entera, y dos recuadros sueltos que no se leian como un solo
          // control. Ahora el marco es del contenedor (.ec-rango en ui.css), los campos van sin
          // borde por dentro y el "hasta" es el guion.
          //
          // Las etiquetas no se pierden: pasan a aria-label, que es lo que necesita un lector de
          // pantalla, mientras que visualmente el patron "12 — 65" ya se entiende solo.
          if (esFecha) {
            return (
              <fieldset key={campo.id} className="border-0 p-0 m-0" style={{ flex: "0 1 300px" }}>
                <legend className="form-label">{campo.label}</legend>
                <div className="ec-rango">
                  <DateField
                    aria-label={`${campo.label}: desde`}
                    value={rango.min ?? null}
                    maxDate={rango.max ?? undefined}
                    onChange={(nuevo) => cambiar(campo.id, { ...rango, min: nuevo })}
                    style={{ marginBottom: 0, flex: "1 1 0" }}
                  />
                  <span className="ec-rango-separador" aria-hidden="true">
                    —
                  </span>
                  <DateField
                    aria-label={`${campo.label}: hasta`}
                    value={rango.max ?? null}
                    minDate={rango.min ?? undefined}
                    onChange={(nuevo) => cambiar(campo.id, { ...rango, max: nuevo })}
                    style={{ marginBottom: 0, flex: "1 1 0" }}
                  />
                </div>
              </fieldset>
            );
          }

          // Un rango numerico que declara `presets` se elige por grupo, no escribiendo dos
          // numeros. Ver GRUPOS_DE_EDAD en packages/shared/pacientes/filtros.js: en jornada
          // nadie busca "de 13 a 17", busca "adolescentes", y donde esta el corte entre un
          // grupo y el siguiente es una decision clinica, no de quien filtra. "Personalizado"
          // devuelve los dos campos de siempre para el caso raro.
          if (campo.presets) {
            return (
              <RangoPorGrupos
                key={campo.id}
                campo={campo}
                rango={rango}
                onChange={(nuevo) => cambiar(campo.id, nuevo)}
              />
            );
          }

          return (
            <fieldset key={campo.id} className="border-0 p-0 m-0" style={{ flex: "0 1 200px" }}>
              <legend className="form-label">{campo.label}</legend>
              <RangoNumerico campo={campo} rango={rango} onChange={(n) => cambiar(campo.id, n)} />
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
