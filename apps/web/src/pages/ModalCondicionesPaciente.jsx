import {
  COLUMNAS_CONDICION_DEL_PACIENTE,
  ESTADOS_CONDICION_CRONICA,
  TIPOS_DE_CAMPO,
  useCondicionesPaciente,
} from "@ecopac/shared";

import DataList from "../components/DataList";
import DateField from "../components/DateField";
import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import Selector from "../components/Selector";
import TextField from "../components/TextField";

export default function ModalCondicionesPaciente({ pacienteId, rol, onClose, onCambio }) {
  const {
    condiciones,
    campos,
    valores,
    errores,
    error,
    errorDeAlta,
    enviando,
    cargando,
    permisos,
    setCampo,
    agregar,
    marcarResuelta,
    borrar,
    catalogos,
  } = useCondicionesPaciente(pacienteId, { rol });

  const guardar = async () => {
    const resultado = await agregar();
    if (resultado.ok) onCambio?.();
  };

  const resolver = async (id) => {
    const resultado = await marcarResuelta(id);
    if (resultado.ok) onCambio?.();
  };

  const eliminar = async (id) => {
    const resultado = await borrar(id);
    if (resultado.ok) onCambio?.();
  };

  return (
    <Modal visible onClose={onClose} title="Condiciones cronicas">
      {(error || errorDeAlta) && (
        <div className="alert alert-danger" role="alert">
          {(errorDeAlta ?? error).mensaje}
        </div>
      )}

      <DataList
        columnas={COLUMNAS_CONDICION_DEL_PACIENTE}
        datos={condiciones}
        cargando={cargando}
        catalogos={catalogos}
        vacio="Este paciente no tiene condiciones cronicas registradas."
      />

      {permisos.puedeEditar && condiciones.length > 0 && (
        <div className="d-flex flex-column gap-2 mt-2">
          {condiciones
            .filter((condicion) => condicion.estado !== ESTADOS_CONDICION_CRONICA.RESUELTA)
            .map((condicion) => (
              <div key={condicion.id} className="d-flex align-items-center gap-2">
                <span className="small text-body-secondary">
                  {condicion.condicion?.nombre ?? condicion.condicion}
                </span>
                <SecondaryButton
                  title="Marcar resuelta"
                  onClick={() => resolver(condicion.id)}
                  disabled={enviando}
                />
                {permisos.puedeQuitar && (
                  <SecondaryButton
                    title="Borrar"
                    onClick={() => eliminar(condicion.id)}
                    disabled={enviando}
                  />
                )}
              </div>
            ))}
        </div>
      )}

      {permisos.puedeRegistrar && (
        <>
          <hr />
          <h3 className="h6">Agregar una condicion</h3>

          {campos.map((campo) => {
            if (campo.tipo === TIPOS_DE_CAMPO.SELECT) {
              const opciones = campo.opciones ?? catalogos[campo.opcionesDesde] ?? [];
              return (
                <Selector
                  key={campo.id}
                  label={campo.label}
                  value={valores[campo.id] || null}
                  options={opciones}
                  onSelect={(valor) => setCampo(campo.id, valor)}
                  error={errores[campo.id]}
                  disabled={enviando || opciones.length === 0}
                />
              );
            }

            if (campo.tipo === TIPOS_DE_CAMPO.FECHA) {
              return (
                <DateField
                  key={campo.id}
                  label={campo.label}
                  value={valores[campo.id] || null}
                  onChange={(valor) => setCampo(campo.id, valor)}
                  error={errores[campo.id]}
                  disabled={enviando}
                />
              );
            }

            return (
              <TextField
                key={campo.id}
                label={campo.label}
                as={campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO ? "textarea" : undefined}
                value={valores[campo.id] ?? ""}
                onChange={(evento) => setCampo(campo.id, evento.target.value)}
                error={errores[campo.id]}
                disabled={enviando}
              />
            );
          })}

          <div className="d-flex justify-content-end gap-2 mt-3">
            <SecondaryButton title="Cerrar" onClick={onClose} disabled={enviando} />
            <PrimaryButton title="Agregar condicion" onClick={guardar} loading={enviando} />
          </div>
        </>
      )}

      {!permisos.puedeRegistrar && (
        <div className="d-flex justify-content-end mt-3">
          <SecondaryButton title="Cerrar" onClick={onClose} />
        </div>
      )}
    </Modal>
  );
}
