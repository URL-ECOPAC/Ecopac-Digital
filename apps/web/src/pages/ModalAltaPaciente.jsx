import { TIPOS_DE_CAMPO, useRegistroPaciente } from '@ecopac/shared';

import DateField from '../components/DateField';
import Modal from '../components/Modal';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import Selector from '../components/Selector';
import TextField from '../components/TextField';

const TIPO_DE_INPUT = {
  [TIPOS_DE_CAMPO.TEXTO]: 'text',
  [TIPOS_DE_CAMPO.TELEFONO]: 'tel',
};

export default function ModalAltaPaciente({ onClose, onRegistrado }) {
  const {
    campos,
    valores,
    errores,
    error,
    enviando,
    edad,
    advertenciaDuplicado,
    registrado,
    departamentoId,
    municipioId,
    setCampo,
    setDepartamento,
    setMunicipio,
    registrar,
    reiniciar,
    catalogos,
  } = useRegistroPaciente();

  const cerrar = () => {
    if (registrado) onRegistrado?.(registrado);
    onClose?.();
  };

  const registrarOtro = () => {
    onRegistrado?.(registrado);
    reiniciar();
  };

  if (registrado) {
    return (
      <Modal visible onClose={cerrar} title="Paciente registrado">
        <p className="mb-1">Anota este numero en la ficha de papel:</p>
        <p className="fs-3 fw-bold mb-3">{registrado.expediente?.numeroFicha ?? '—'}</p>
        <p className="text-body-secondary">
          {[registrado.nombres, registrado.apellidos].filter(Boolean).join(' ')}
        </p>
        <div className="d-flex justify-content-end gap-2 mt-3">
          <SecondaryButton title="Registrar otro" onClick={registrarOtro} />
          <PrimaryButton title="Listo" onClick={cerrar} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal visible onClose={cerrar} title="Nuevo paciente">
      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      {advertenciaDuplicado && (
        <div className="alert alert-warning" role="alert">
          {advertenciaDuplicado}
        </div>
      )}

      {campos.map((campo) => {
        if (campo.id === 'comunidad') {
          return (
            <div key="comunidad-cascada">
              <Selector
                label="Departamento"
                value={departamentoId}
                options={catalogos.departamentos}
                onSelect={setDepartamento}
                placeholder="Selecciona un departamento"
                disabled={enviando || catalogos.departamentos.length === 0}
              />
              <Selector
                label="Municipio"
                value={municipioId}
                options={catalogos.municipios}
                onSelect={setMunicipio}
                placeholder="Selecciona un municipio"
                disabled={enviando || !departamentoId || catalogos.municipios.length === 0}
              />
              <Selector
                label={campo.label}
                value={valores.comunidad || null}
                options={catalogos.comunidades}
                onSelect={(valor) => setCampo('comunidad', valor)}
                placeholder="Selecciona una comunidad"
                error={errores.comunidad}
                disabled={enviando || !municipioId || catalogos.comunidades.length === 0}
              />
            </div>
          );
        }

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
            <div key={campo.id}>
              <DateField
                label={campo.label}
                value={valores[campo.id] || null}
                onChange={(valor) => setCampo(campo.id, valor)}
                error={errores[campo.id]}
                disabled={enviando}
              />
              {edad && <p className="text-body-secondary small mt-1 mb-0">Edad: {edad}</p>}
            </div>
          );
        }

        return (
          <TextField
            key={campo.id}
            label={campo.label}
            type={TIPO_DE_INPUT[campo.tipo] ?? 'text'}
            maxLength={campo.validacion?.maxLongitud}
            value={valores[campo.id] ?? ''}
            onChange={(evento) => setCampo(campo.id, evento.target.value)}
            error={errores[campo.id]}
            disabled={enviando}
          />
        );
      })}

      <div className="d-flex justify-content-end gap-2 mt-3">
        <SecondaryButton title="Cancelar" onClick={cerrar} disabled={enviando} />
        <PrimaryButton title="Registrar paciente" onClick={registrar} loading={enviando} />
      </div>
    </Modal>
  );
}
