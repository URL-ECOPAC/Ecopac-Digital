import { useState } from "react";

import {
  COLUMNAS_CONDICION_DEL_PACIENTE,
  ESTADOS_CONDICION_CRONICA,
  useCondicionesPaciente,
  valoresDeCorreccionDeCondicion,
} from "@ecopac/shared";

import CampoDeFormulario from "../components/CampoDeFormulario";
import DataList from "../components/DataList";
import Modal from "../components/Modal";
import { Plus, Save } from "lucide-react";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import SelectorConAlta from "../components/SelectorConAlta";

/** El campo que elige del catalogo, y el unico que se dibuja distinto (issue #850). */
const CAMPO_CONDICION = "condicion";

export default function ModalCondicionesPaciente({ pacienteId, rol, onClose, onCambio }) {
  const {
    condiciones,
    campos,
    camposCorreccion,
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
    corregir,
    catalogos,
    puedeCrearCondicion,
    registrarCondicion,
    erroresCondicionNueva,
    creandoCondicion,
  } = useCondicionesPaciente(pacienteId, { rol });

  const [idEnCorreccion, setIdEnCorreccion] = useState(null);
  const [valoresCorreccion, setValoresCorreccion] = useState({});
  const [erroresCorreccion, setErroresCorreccion] = useState({});

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

  const abrirCorreccion = (condicion) => {
    setIdEnCorreccion(condicion.id);
    setValoresCorreccion(valoresDeCorreccionDeCondicion(condicion));
    setErroresCorreccion({});
  };

  const guardarCorreccion = async () => {
    const resultado = await corregir(idEnCorreccion, valoresCorreccion);
    if (!resultado.ok) {
      setErroresCorreccion(resultado.errores ?? {});
      return;
    }
    setIdEnCorreccion(null);
    onCambio?.();
  };

  return (
    <Modal visible onClose={onClose} title="Condiciones crónicas">
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
              <div key={condicion.id} className="d-flex flex-column gap-2">
                <div className="d-flex align-items-center gap-2">
                  <span className="small text-body-secondary">
                    {condicion.condicion?.nombre ?? condicion.condicion}
                  </span>
                  <SecondaryButton
                    title="Editar"
                    onClick={() => abrirCorreccion(condicion)}
                    disabled={enviando}
                  />
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

                {idEnCorreccion === condicion.id && (
                  <div className="border rounded p-2 ms-3">
                    {/* Los campos del alta, con la condicion y el estado de solo lectura
                        (issue #840, B1). */}
                    {camposCorreccion.map((campo) => (
                      <CampoDeFormulario
                        key={campo.id}
                        campo={campo}
                        valor={valoresCorreccion[campo.id]}
                        onChange={(valor) =>
                          setValoresCorreccion((anteriores) => ({
                            ...anteriores,
                            [campo.id]: valor,
                          }))
                        }
                        error={erroresCorreccion[campo.id]}
                        catalogos={catalogos}
                        disabled={enviando}
                      />
                    ))}
                    <div className="d-flex justify-content-end gap-2">
                      <SecondaryButton
                        title="Cancelar"
                        onClick={() => setIdEnCorreccion(null)}
                        disabled={enviando}
                      />
                      <PrimaryButton
                        title="Guardar cambios"
                        onClick={guardarCorreccion}
                        loading={enviando}
                        icon={<Save size={16} aria-hidden="true" />}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {permisos.puedeRegistrar && (
        <>
          <hr />
          <h3 className="h6">Agregar una condicion</h3>

          {campos.map((campo) =>
            /* La condicion se dibuja con SelectorConAlta, no con CampoDeFormulario: en jornada
               aparece una condicion que el catalogo no trae, y salir a la pantalla de catalogo
               pierde lo que ya se llevaba escrito (issue #850). Mismo trato especial que
               ModalAltaPaciente.jsx le da a la comunidad con CascadaDeComunidad. */
            campo.id === CAMPO_CONDICION ? (
              <SelectorConAlta
                key={campo.id}
                label={campo.label}
                value={valores[campo.id]}
                options={catalogos.condicionesCronicas}
                onSelect={(valor) => setCampo(campo.id, valor)}
                error={errores[campo.id]}
                disabled={enviando}
                puedeCrear={puedeCrearCondicion}
                etiquetaAlta="Crear una condición"
                labelNuevo="Nombre de la condición"
                onCrear={registrarCondicion}
                erroresAlta={erroresCondicionNueva}
                creando={creandoCondicion}
              />
            ) : (
              <CampoDeFormulario
                key={campo.id}
                campo={campo}
                valor={valores[campo.id]}
                onChange={(valor) => setCampo(campo.id, valor)}
                error={errores[campo.id]}
                catalogos={catalogos}
                disabled={enviando}
              />
            ),
          )}

          <div className="d-flex justify-content-end gap-2 mt-3">
            <SecondaryButton title="Cerrar" onClick={onClose} disabled={enviando} />
            <PrimaryButton
              title="Agregar condición"
              onClick={guardar}
              loading={enviando}
              icon={<Plus size={16} aria-hidden="true" />}
            />
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
