import Selector from "../components/Selector";

/**
 * Aviso y selector de la jornada en la que se va a registrar informacion clinica.
 *
 * Los tres modales de captura (triaje, consulta, receta) empiezan igual: hay que saber en que
 * jornada se esta atendiendo antes de poder guardar nada, porque un triaje o una consulta
 * cuelgan de una atencion y una atencion cuelga de una jornada. Esta pieza dibuja los tres
 * estados posibles que resuelve useCapturaClinica():
 *
 *   - ninguna jornada en curso: se explica por que no se puede registrar y no se pinta selector;
 *   - varias: se pide elegir;
 *   - una sola: el hook ya la eligio, y solo se recuerda cual es.
 *
 * El texto del aviso viene del hook (`motivo`), no de aqui: es una regla de negocio.
 */
export default function SelectorDeJornada({ captura }) {
  const { opcionesDeJornada, jornadaId, elegirJornada, jornada, motivo, cargando } = captura;

  if (cargando) return null;

  return (
    <div className="mb-3">
      {motivo && (
        <div className="alert alert-warning" role="status">
          {motivo}
        </div>
      )}

      {opcionesDeJornada.length > 1 && (
        <Selector
          label="Jornada"
          value={jornadaId}
          options={opcionesDeJornada}
          onSelect={elegirJornada}
          placeholder="Elige la jornada"
        />
      )}

      {opcionesDeJornada.length === 1 && jornada && (
        <p className="ec-rotulo mb-0">
          Jornada: <span className="text-body">{jornada.nombre}</span>
        </p>
      )}
    </div>
  );
}
