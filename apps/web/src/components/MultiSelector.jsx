import { useId, useState } from "react";
import { Form } from "react-bootstrap";
import { Check, X } from "lucide-react";

/**
 * Seleccion multiple sobre un catalogo.
 *
 * POR QUE SE AGREGA AL CATALOGO
 *
 * TIPOS_DE_CAMPO.MULTI_SELECT existe en packages/shared/descriptores.js desde el principio y lo
 * declara CAMPOS_CONSULTA (los diagnosticos de una consulta), pero ninguna app tenia un
 * componente que supiera dibujarlo: cualquier formulario que lo usara se quedaba con un campo
 * invisible. Es literalmente la razon por la que los comentarios de ModalAltaUsuario y
 * ModalEdicionUsuario decian que las especialidades "no tienen ningun componente del catalogo
 * que las dibuje editable".
 *
 * Lo elegido se muestra como chips que se quitan con un click, y el desplegable de abajo agrega:
 * es el patron que ya usa la receta para los medicamentos, y evita el <select multiple> nativo,
 * que en la practica nadie sabe usar (hay que mantener Ctrl para elegir dos cosas).
 *
 * `onChange` entrega el ARREGLO COMPLETO de valores, no el que cambio: quien lo usa no tiene que
 * reconstruirlo. Se llama igual en las dos plataformas.
 *
 * `permiteLibre` deja escribir un valor que no esta en el catalogo. Lo necesita
 * `perfil_especialidad`, que es un VARCHAR(100) libre y no una FK a un catalogo (00002).
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
  error,
  disabled = false,
  style,
}) {
  const id = useId();
  const seleccionados = Array.isArray(value) ? value : [];
  const [textoLibre, setTextoLibre] = useState("");

  const disponibles = options.filter((opcion) => !seleccionados.includes(opcion.value));

  const etiquetaDe = (valor) =>
    options.find((opcion) => opcion.value === valor)?.label ?? String(valor);

  const agregar = (valor) => {
    if (valor === null || valor === "" || seleccionados.includes(valor)) return;
    onChange?.([...seleccionados, valor]);
  };

  const quitar = (valor) => {
    onChange?.(seleccionados.filter((elegido) => elegido !== valor));
  };

  const agregarLibre = () => {
    const limpio = textoLibre.trim();
    if (!limpio) return;
    agregar(limpio);
    setTextoLibre("");
  };

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
          const elegida = options.find((opcion) => String(opcion.value) === crudo);
          agregar(elegida ? elegida.value : crudo);
        }}
        isInvalid={Boolean(error)}
        disabled={disabled || disponibles.length === 0}
      >
        <option value="">
          {disponibles.length === 0 ? "No quedan opciones por elegir" : placeholder}
        </option>
        {disponibles.map((opcion) => (
          <option key={String(opcion.value)} value={String(opcion.value)}>
            {opcion.label}
          </option>
        ))}
      </Form.Select>

      {permiteLibre && (
        <div className="d-flex gap-2 mt-2">
          <Form.Control
            value={textoLibre}
            placeholder={placeholderLibre}
            disabled={disabled}
            onChange={(evento) => setTextoLibre(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") {
                evento.preventDefault();
                agregarLibre();
              }
            }}
          />
          <button
            type="button"
            className="btn btn-outline-primary btn-sm flex-shrink-0"
            onClick={agregarLibre}
            disabled={disabled || textoLibre.trim() === ""}
          >
            Agregar
          </button>
        </div>
      )}

      {error && <div className="invalid-feedback d-block">{error}</div>}
    </Form.Group>
  );
}
