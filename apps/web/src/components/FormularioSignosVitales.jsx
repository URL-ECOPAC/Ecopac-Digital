import { NIVELES_DE_AVISO } from "@ecopac/shared";

import NumberField from "./NumberField";

/**
 * Los signos vitales de una consulta (issue #840, bloques B1, F y G2).
 *
 * Un solo formulario para tomarlos y para corregirlos: antes el alta los dibujaba en rejilla, con
 * decimales y con el IMC, y la correccion en una columna, sin decimales -36.5 grados no se podia
 * escribir- y sin el IMC. Espejo de apps/mobile/src/components/FormularioSignosVitales.js, con las
 * mismas props.
 *
 * Una sola capa visible por campo (G2): el error al guardar, o si no lo hay, el aviso de
 * useConsulta() -imposible en rojo, alarma en ambar-. Nunca las dos a la vez.
 *
 * A proposito NO se le pasa min/max al control: el NumberField de movil recorta al minimo al salir
 * del campo, y con una sistolica de 35 eso guardaba un 40 que nadie midio. Los limites los dice el
 * aviso, que es lo que la persona lee.
 */
export default function FormularioSignosVitales({
  campos,
  valores,
  onChange,
  errores = {},
  avisos = {},
  imc = null,
  disabled = false,
}) {
  return (
    <>
      <div className="ec-form-grid">
        {campos.map((campo) => {
          const aviso = avisos[campo.id];
          const error =
            errores[campo.id] ??
            (aviso?.nivel === NIVELES_DE_AVISO.IMPOSIBLE ? aviso.mensaje : undefined);
          return (
            <div key={campo.id}>
              <NumberField
                label={campo.label}
                suffix={campo.sufijo}
                step={campo.paso ?? 1}
                value={valores[campo.id] === "" ? null : Number(valores[campo.id])}
                onChange={(valor) => onChange(campo.id, valor === null ? "" : valor)}
                error={error}
                disabled={disabled}
              />
              {!error && aviso?.nivel === NIVELES_DE_AVISO.ALARMA && (
                <p className="ec-aviso-alarma" role="status">
                  {aviso.mensaje}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {errores.signos && (
        <div className="alert alert-danger py-2" role="alert">
          {errores.signos}
        </div>
      )}
      {/* El IMC no es un campo: lo calcula la columna generada de la 00013. Se adelanta con la
          misma formula para verlo antes de guardar. */}
      {imc !== null && (
        <p className="ec-rotulo mb-0">
          IMC calculado <span className="text-body">{imc}</span>
        </p>
      )}
    </>
  );
}
