import { useId, useState } from "react";
import { Form } from "react-bootstrap";
import { Check, X } from "lucide-react";
import { buscarOpcionPorEtiqueta } from "@ecopac/shared";

import SecondaryButton from "./SecondaryButton";

/**
 * Seleccion multiple sobre un catalogo, con alta de valores nuevos en el mismo lugar.
 *
 * Lo elegido se muestra como chips que se quitan con un click, y el desplegable de abajo agrega:
 * es el patron de la receta para los medicamentos, y evita el <select multiple> nativo.
 *
 * `onChange` entrega el ARREGLO COMPLETO de valores, no el que cambio. Se llama igual en las dos
 * plataformas.
 *
 * DOS FORMAS DE AGREGAR ALGO QUE NO ESTA EN LA LISTA
 *
 *   - `permiteLibre`: el texto escrito ES el valor. Lo necesita `perfil_especialidad`, que es un
 *     VARCHAR(100) libre y no una FK (00002).
 *   - `onCrear(texto)`: el texto se da de alta en su catalogo y se elige lo que devuelva (el id).
 *     Lo usa la consulta para crear un diagnostico sin salir de ella. Debe devolver el valor de la
 *     opcion nueva, o null si no se pudo crear (el error lo pinta quien la llama).
 *
 * EL FALLO QUE HABIA. Escribir el nombre de algo que YA estaba en el catalogo -"Cirujano"- no lo
 * elegia: lo agregaba como texto nuevo, o no hacia nada si el desplegable estaba vacio. Y el
 * desplegable decia "No quedan opciones por elegir" tanto cuando todas estaban elegidas como
 * cuando el catalogo no tenia nada, asi que no se entendia por que no se podia escoger. Ahora, si
 * lo escrito coincide con una opcion (sin importar mayusculas ni acentos), se elige esa opcion;
 * al salir del campo con texto escrito tambien se agrega, para que "Guardar" no ignore lo que se
 * acaba de escribir.
 *
 * Espejo de apps/mobile/src/components/MultiSelector.js.
 */
export default function MultiSelector({
  label,
  value = [],
  options = [],
  onChange,
  placeholder = "Agregar...",
  placeholderLibre = "Escribe y pulsa Agregar",
  permiteLibre = false,
  onCrear,
  error,
  disabled = false,
  style,
}) {
  const id = useId();
  const seleccionados = Array.isArray(value) ? value : [];
  const [textoLibre, setTextoLibre] = useState("");
  const [creando, setCreando] = useState(false);
  // ISSUE #838: una especialidad escrita a mano quedaba solo como chip. Si se quitaba, o si se
  // abria el desplegable para ver que hay, no estaba: `options` es el catalogo que vino del
  // servidor y no se entera de lo que se acaba de escribir. Quien acababa de crear "Nutricion"
  // no la volvia a encontrar hasta recargar la pantalla. Se recuerdan aqui, en la sesion del
  // control, y se mezclan con el catalogo.
  const [agregadasEnSesion, setAgregadasEnSesion] = useState([]);

  const admiteTexto = permiteLibre || typeof onCrear === "function";
  const opciones = [
    ...options,
    ...agregadasEnSesion.filter((nueva) => !options.some((opcion) => opcion.value === nueva.value)),
  ];
  const disponibles = opciones.filter((opcion) => !seleccionados.includes(opcion.value));

  const etiquetaDe = (valor) =>
    opciones.find((opcion) => opcion.value === valor)?.label ?? String(valor);

  const recordar = (valor, etiqueta) => {
    setAgregadasEnSesion((anteriores) =>
      anteriores.some((opcion) => opcion.value === valor)
        ? anteriores
        : [...anteriores, { value: valor, label: etiqueta }],
    );
  };

  const agregar = (valor) => {
    if (valor === null || valor === undefined || valor === "" || seleccionados.includes(valor)) {
      return;
    }
    onChange?.([...seleccionados, valor]);
  };

  const quitar = (valor) => {
    onChange?.(seleccionados.filter((elegido) => elegido !== valor));
  };

  const agregarTexto = async () => {
    const limpio = textoLibre.trim();
    if (!limpio || creando) return;

    const existente = buscarOpcionPorEtiqueta(opciones, limpio);
    if (existente) {
      agregar(existente.value);
      setTextoLibre("");
      return;
    }

    if (typeof onCrear === "function") {
      setCreando(true);
      const nuevo = await onCrear(limpio);
      setCreando(false);
      if (nuevo !== null && nuevo !== undefined) {
        recordar(nuevo, limpio);
        agregar(nuevo);
        setTextoLibre("");
      }
      return;
    }

    // En modo libre el texto ES el valor, asi que la opcion nueva se llama igual que su valor.
    recordar(limpio, limpio);
    agregar(limpio);
    setTextoLibre("");
  };

  const textoDelDesplegable =
    opciones.length === 0
      ? admiteTexto
        ? "Todavia no hay ninguna: escribe una nueva abajo"
        : "No hay opciones disponibles"
      : disponibles.length === 0
        ? "Ya elegiste todas las opciones"
        : placeholder;

  return (
    <Form.Group className="mb-3" style={style}>
      {label && <Form.Label htmlFor={id}>{label}</Form.Label>}

      {seleccionados.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-2">
          {seleccionados.map((valor) => (
            <span className="ec-chip" key={String(valor)}>
              <Check size={12} aria-hidden="true" />
              {etiquetaDe(valor)}
              {!disabled && (
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 border-0"
                  style={{ color: "inherit", lineHeight: 1 }}
                  onClick={() => quitar(valor)}
                  aria-label={`Quitar ${etiquetaDe(valor)}`}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <Form.Select
        id={id}
        value=""
        onChange={(evento) => {
          const crudo = evento.target.value;
          if (crudo === "") return;
          const elegida = opciones.find((opcion) => String(opcion.value) === crudo);
          agregar(elegida ? elegida.value : crudo);
        }}
        isInvalid={Boolean(error)}
        disabled={disabled || disponibles.length === 0}
      >
        <option value="">{textoDelDesplegable}</option>
        {disponibles.map((opcion) => (
          <option key={String(opcion.value)} value={String(opcion.value)}>
            {opcion.label}
          </option>
        ))}
      </Form.Select>

      {admiteTexto && (
        <div className="d-flex gap-2 mt-2">
          <Form.Control
            aria-label={placeholderLibre}
            value={textoLibre}
            placeholder={placeholderLibre}
            disabled={disabled || creando}
            onChange={(evento) => setTextoLibre(evento.target.value)}
            onBlur={() => {
              // Al salir con texto escrito se agrega igual que con el boton. Crear en el catalogo
              // si pide el boton explicito: dar de alta un diagnostico no puede pasar por un roce.
              if (typeof onCrear !== "function") agregarTexto();
            }}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") {
                evento.preventDefault();
                agregarTexto();
              }
            }}
          />
          <SecondaryButton
            title={typeof onCrear === "function" ? "Crear" : "Agregar"}
            size="sm"
            className="flex-shrink-0"
            onClick={agregarTexto}
            loading={creando}
            disabled={disabled || textoLibre.trim() === ""}
          />
        </div>
      )}

      {error && <div className="invalid-feedback d-block">{error}</div>}
    </Form.Group>
  );
}
