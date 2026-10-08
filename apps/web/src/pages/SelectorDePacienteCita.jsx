import { Search, UserPlus, X } from "lucide-react";

import { useBusquedaPacientes } from "@ecopac/shared";

import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import SecondaryButton from "../components/SecondaryButton";
import TextField from "../components/TextField";
import "./citas.css";

// El paciente de una cita (issue #927): el buscador de pacientes de siempre (useBusquedaPacientes,
// el de la lista de pacientes) y, si no esta registrado, el alta en linea. Quien lo monta decide
// que hacer con el alta: el formulario de cita abre ModalAltaPaciente y vuelve con el elegido.

export default function SelectorDePacienteCita({
  paciente,
  onElegir,
  fijo = false,
  error,
  disabled = false,
  puedeRegistrar = false,
  onRegistrar,
}) {
  const busqueda = useBusquedaPacientes({ porPagina: 8 });

  if (paciente) {
    return (
      <div className="cit-paciente-elegido">
        <div>
          <p className="pac-rotulo mb-0">Paciente</p>
          <strong>{paciente.nombre ?? "Paciente"}</strong>
          {paciente.numeroFicha && (
            <span className="pac-dato-mono ms-2">{paciente.numeroFicha}</span>
          )}
        </div>
        {!fijo && (
          <SecondaryButton
            title="Cambiar"
            size="sm"
            variant="neutra"
            icon={<X size={14} aria-hidden="true" />}
            onClick={() => onElegir(null)}
            disabled={disabled}
          />
        )}
      </div>
    );
  }

  const conTermino = busqueda.termino.trim().length > 0;

  return (
    <div className="mb-3">
      <TextField
        label="Paciente"
        requerido
        placeholder="Nombre, número de ficha o DPI"
        value={busqueda.termino}
        onChange={(evento) => busqueda.setTermino(evento.target.value)}
        error={error}
        disabled={disabled}
        aria-describedby="cit-ayuda-paciente"
      />
      <p id="cit-ayuda-paciente" className="ec-campo-nota d-flex align-items-center gap-1">
        <Search size={14} aria-hidden="true" /> Busca al paciente y elígelo de la lista.
      </p>

      {busqueda.cargando && <LoadingState message="Buscando pacientes..." />}
      {busqueda.error && (
        <div className="alert alert-danger py-2" role="alert">
          {busqueda.error.mensaje}
        </div>
      )}
      {busqueda.terminoDemasiadoCorto && (
        <p className="ec-campo-nota">Escribe al menos tres letras del nombre.</p>
      )}

      {busqueda.resultados.length > 0 && (
        <ul className="cit-resultados" aria-label="Pacientes encontrados">
          {busqueda.resultados.map((resultado) => {
            const nombre = [resultado.nombres, resultado.apellidos].filter(Boolean).join(" ");
            return (
              <li key={resultado.id}>
                <button
                  type="button"
                  className="cit-resultado"
                  onClick={() =>
                    onElegir({ id: resultado.id, nombre, numeroFicha: resultado.numeroFicha })
                  }
                >
                  <strong>{nombre}</strong>
                  <span className="text-body-secondary small ms-2">
                    {[resultado.numeroFicha, resultado.comunidad?.nombre]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {conTermino &&
        !busqueda.cargando &&
        !busqueda.terminoDemasiadoCorto &&
        busqueda.resultados.length === 0 &&
        !busqueda.error && <EmptyState message="Ningún paciente coincide con la búsqueda." />}

      {puedeRegistrar && (
        <SecondaryButton
          title="Registrar un paciente nuevo"
          size="sm"
          icon={<UserPlus size={16} aria-hidden="true" />}
          onClick={onRegistrar}
          disabled={disabled}
        />
      )}
    </div>
  );
}
