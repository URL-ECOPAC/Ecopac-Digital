import { useEffect, useState } from "react";
import { Form } from "react-bootstrap";

import { useFormularioComunidad } from "@ecopac/shared";

import MapaUbicacionComunidad from "../components/MapaUbicacionComunidad";
import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import Selector from "../components/Selector";
import TextField from "../components/TextField";

function valoresDe(comunidad) {
  return {
    nombre: comunidad?.nombre ?? "",
    referenciaAcceso: comunidad?.referenciaAcceso ?? "",
    esVigente: comunidad?.esVigente ?? true,
    latitud: comunidad?.latitud ?? null,
    longitud: comunidad?.longitud ?? null,
  };
}

/**
 * Modal de alta y edicion del catalogo de comunidades (issue #756), mismo patron que
 * ModalPrincipioActivo.jsx: estado de formulario local, guardado y validacion via el hook de
 * la pantalla (onGuardar). Solo la cascada departamento/municipio pide su propio hook
 * compartido (useFormularioComunidad), porque necesita resolver el departamento de una
 * comunidad ya existente contra el servidor -no es un binding simple de un input.
 */
export default function ModalComunidad({ visible, comunidad, onClose, onGuardar, erroresForm }) {
  const editando = Boolean(comunidad?.id);
  const [valores, setValores] = useState(() => valoresDe(comunidad));
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const {
    departamentos,
    municipios,
    departamentoId,
    elegirDepartamento,
    municipioId,
    setMunicipioId,
    cargando: cargandoCascada,
  } = useFormularioComunidad(comunidad?.id ?? null);

  useEffect(() => {
    setValores(valoresDe(comunidad));
    setError(null);
  }, [comunidad]);

  const cambiar = (campo, valor) => setValores((anteriores) => ({ ...anteriores, [campo]: valor }));

  const guardar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    const resultado = await onGuardar(comunidad?.id ?? null, {
      nombre: valores.nombre,
      municipioId,
      referenciaAcceso: valores.referenciaAcceso || null,
      latitud: valores.latitud,
      longitud: valores.longitud,
      ...(editando ? { esVigente: valores.esVigente } : {}),
    });

    setEnviando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={editando ? "Editar comunidad" : "Nueva comunidad"}
      size="lg"
    >
      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}
      {erroresForm?.ubicacion && (
        <div className="alert alert-warning" role="alert">
          {erroresForm.ubicacion}
        </div>
      )}

      <form onSubmit={guardar}>
        <TextField
          label="Nombre"
          value={valores.nombre}
          onChange={(evento) => cambiar("nombre", evento.target.value)}
          maxLength={100}
          error={erroresForm?.nombre}
        />

        <div className="row">
          <div className="col-md-6">
            <Selector
              label="Departamento"
              value={departamentoId}
              options={departamentos}
              onSelect={elegirDepartamento}
              disabled={cargandoCascada}
            />
          </div>
          <div className="col-md-6">
            <Selector
              label="Municipio"
              value={municipioId}
              options={municipios}
              onSelect={setMunicipioId}
              disabled={!departamentoId || cargandoCascada}
              error={erroresForm?.municipio_id}
            />
          </div>
        </div>

        <TextField
          label="Referencia de acceso"
          as="textarea"
          rows={2}
          placeholder="Como llegar cuando no hay direccion formal (ej. desvio, punto de referencia)"
          value={valores.referenciaAcceso}
          onChange={(evento) => cambiar("referenciaAcceso", evento.target.value)}
        />

        <Form.Group className="mb-3">
          <Form.Label>Ubicacion en el mapa</Form.Label>
          <MapaUbicacionComunidad
            latitud={valores.latitud}
            longitud={valores.longitud}
            onCambiarUbicacion={(latitud, longitud) => {
              cambiar("latitud", latitud);
              cambiar("longitud", longitud);
            }}
          />
        </Form.Group>

        {editando && (
          <Form.Check
            type="checkbox"
            id="comunidad-es-vigente"
            label="Comunidad vigente"
            checked={valores.esVigente}
            onChange={(evento) => cambiar("esVigente", evento.target.checked)}
            className="mb-3"
          />
        )}

        <div className="d-flex justify-content-end gap-2 mt-3">
          <SecondaryButton title="Cancelar" onClick={onClose} disabled={enviando} />
          <PrimaryButton
            title={editando ? "Guardar cambios" : "Crear comunidad"}
            onClick={guardar}
            loading={enviando}
            disabled={!municipioId || !valores.nombre}
          />
        </div>
      </form>
    </Modal>
  );
}
