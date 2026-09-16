import CampoDeFormulario from "./CampoDeFormulario";

/**
 * Un bloque de campos con su titulo, dibujado en dos columnas.
 *
 * Los formularios largos eran una columna de controles a ancho completo, uno debajo de otro:
 * "Editar datos del paciente" son once campos, asi que habia que desplazar el modal entero para
 * verlo. En dos columnas cabe de una vez, y los campos que se leen juntos -nombres y apellidos,
 * departamento y municipio- quedan uno al lado del otro, que es como estan en la ficha de papel
 * que se sigue usando en jornada.
 *
 * La rejilla es `auto-fit`, no dos columnas fijas: en una laptop pequena o en el modal angosto
 * cae sola a una columna, sin una media query por formulario. Un campo de texto largo o una
 * lista de etiquetas ocupa la fila entera; lo decide el descriptor, no esta pantalla
 * (ocupaFilaCompleta en CampoDeFormulario.jsx).
 *
 * `acento` tine la barra del titulo con el color del modulo. Llega como variable de tokens
 * (`var(--accent-pacientes)`), nunca como un color escrito a mano.
 */
export default function SeccionDeFormulario({
  titulo,
  descripcion,
  acento,
  campos = [],
  valores = {},
  errores = {},
  catalogos = {},
  onChange,
  disabled = false,
  children,
}) {
  return (
    <section className="ec-form-seccion" style={acento ? { "--ec-acento": acento } : undefined}>
      {titulo && (
        <div className="ec-form-seccion-cabecera">
          <h3 className="ec-form-seccion-titulo">{titulo}</h3>
          {descripcion && <p className="ec-form-seccion-descripcion">{descripcion}</p>}
        </div>
      )}

      <div className="ec-form-grid">
        {campos.map((campo) => (
          <CampoDeFormulario
            key={campo.id}
            campo={campo}
            valor={valores[campo.id]}
            error={errores[campo.id]}
            catalogos={catalogos}
            disabled={disabled}
            onChange={(valor) => onChange?.(campo.id, valor)}
          />
        ))}
      </div>

      {children}
    </section>
  );
}
