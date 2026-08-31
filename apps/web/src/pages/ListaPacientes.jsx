import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";

function claseDeAvatar(sexo) {
  const normalizado = String(sexo ?? "")
    .trim()
    .toLowerCase();
  if (normalizado === "femenino") return " pac-avatar--femenino";
  if (normalizado === "masculino") return " pac-avatar--masculino";
  return "";
}

function resumen(fila) {
  return [fila.edad ? `${fila.edad}a` : null, fila.sexo, fila.comunidad]
    .filter(Boolean)
    .join(" · ");
}

export default function ListaPacientes({ filas, total, cargando, activoId, onSeleccionar, vacio }) {
  return (
    <div className="pac-columna">
      <p className="pac-rotulo mb-2">
        {total === 1 ? "1 paciente encontrado" : `${total} pacientes encontrados`}
      </p>

      {cargando && filas.length === 0 && <LoadingState />}

      {!cargando && filas.length === 0 && (vacio ?? <EmptyState />)}

      <ul className="pac-lista list-unstyled mb-0">
        {filas.map((fila) => (
          <li key={fila.id}>
            <button
              type="button"
              className={`pac-tarjeta-paciente${fila.id === activoId ? " pac-tarjeta-paciente--activa" : ""}`}
              onClick={() => onSeleccionar(fila)}
              aria-current={fila.id === activoId ? "true" : undefined}
            >
              <span className={`pac-avatar${claseDeAvatar(fila.sexo)}`} aria-hidden="true">
                {(fila.nombreCompleto ?? "?").charAt(0)}
              </span>

              <span className="pac-tarjeta-datos">
                <span className="pac-tarjeta-nombre">{fila.nombreCompleto}</span>
                <span className="pac-dato-mono">{resumen(fila)}</span>

                {fila.condiciones?.length > 0 && (
                  <span className="pac-tarjeta-chips">
                    {fila.condiciones.map((condicion) => (
                      <span className="badge" key={`${fila.id}-${condicion}`}>
                        {condicion}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
