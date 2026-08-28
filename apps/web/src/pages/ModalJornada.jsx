import { CAMPOS_FORMULARIO_JORNADA, TIPOS_DE_CAMPO, useFormularioJornada } from '@ecopac/shared';

import DateField from '../components/DateField';
import Modal from '../components/Modal';
import PrimaryButton from '../components/PrimaryButton';
import Selector from '../components/Selector';
import SecondaryButton from '../components/SecondaryButton';
import TextField from '../components/TextField';

// Modal de alta y edicion de jornada (issue #179), montado desde JornadasPage.jsx con estado
// local: no tiene ruta propia, mismo patron que ModalAltaUsuario.jsx/ModalEdicionUsuario.jsx
// (#106/#107). A diferencia de esas dos, aca es un solo componente para las dos operaciones
// (revision del plan, PLAN.md seccion 7, decision 4): `jornada` ausente es alta, `jornada` con
// datos es edicion. El estado, la validacion, la cascada de comunidad y la llamada al servidor
// van en useFormularioJornada(), no aca: este componente solo dibuja lo que el hook le entrega.
//
// Etiquetas, tipos y orden de los campos salen de CAMPOS_FORMULARIO_JORNADA (los cinco campos
// que #179 confirmo: nombre, fecha, comunidad, responsable, proyecto), no de literales propios.
//
// El campo `comunidad` es especial: en vez de un solo Selector, son tres en cascada
// (departamento -> municipio -> comunidad, criterio 2). Los dos primeros no son campos del
// formulario -- jornadas no guarda departamento ni municipio -- asi que no aparecen en
// CAMPOS_FORMULARIO_JORNADA; solo acotan las opciones del Selector real de comunidad.
const TIPO_DE_INPUT = {
  texto: 'text',
};

export default function ModalJornada({ visible = true, jornada, rol, onClose, onGuardado }) {
  const {
    valores,
    errores,
    error,
    enviando,
    cargando,
    esEdicion,
    catalogos,
    departamentoId,
    municipioId,
    setDepartamento,
    setMunicipio,
    setCampo,
    advertenciaDuplicado,
    enviar,
    cancelar,
  } = useFormularioJornada({ jornada, rol });

  // Deshabilita el formulario mientras se envia Y mientras se carga la jornada completa para
  // editar (obtenerJornada(), ver useFormularioJornada.js). En el alta `cargando` siempre es
  // false, no hay nada que pedir antes de mostrar el formulario vacio.
  const bloqueado = enviando || cargando;

  const cerrar = () => {
    cancelar();
    onClose?.();
  };

  const guardar = async () => {
    const resultado = await enviar();
    if (resultado.ok) {
      onGuardado?.(resultado.jornada);
      onClose?.();
    }
  };

  return (
    <Modal visible={visible} onClose={cerrar} title={esEdicion ? 'Editar jornada' : 'Nueva jornada'}>
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

      {CAMPOS_FORMULARIO_JORNADA.map((campo) => {
        if (campo.id === 'comunidad') {
          return (
            <div key="comunidad-cascada">
              <Selector
                label="Departamento"
                value={departamentoId}
                options={catalogos.departamentos}
                onSelect={setDepartamento}
                placeholder="Selecciona un departamento"
                disabled={bloqueado}
              />
              <Selector
                label="Municipio"
                value={municipioId}
                options={catalogos.municipios}
                onSelect={setMunicipio}
                placeholder="Selecciona un municipio"
                disabled={bloqueado || !departamentoId || catalogos.municipios.length === 0}
              />
              <Selector
                label={campo.label}
                value={valores.comunidad || null}
                options={catalogos.comunidades}
                onSelect={(valor) => setCampo('comunidad', valor)}
                placeholder="Selecciona una comunidad"
                disabled={bloqueado || !municipioId || catalogos.comunidades.length === 0}
                error={errores.comunidad}
              />
            </div>
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
              disabled={bloqueado}
            />
          );
        }

        if (campo.tipo === TIPOS_DE_CAMPO.SELECT) {
          const opciones = catalogos[campo.opcionesDesde] ?? [];
          return (
            <Selector
              key={campo.id}
              label={campo.label}
              value={valores[campo.id] || null}
              options={opciones}
              onSelect={(valor) => setCampo(campo.id, valor)}
              placeholder={opciones.length === 0 ? 'Cargando...' : 'Seleccionar'}
              disabled={bloqueado || opciones.length === 0}
              error={errores[campo.id]}
            />
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
            disabled={bloqueado}
          />
        );
      })}

      <div className="d-flex justify-content-end gap-2 mt-3">
        <SecondaryButton title="Cancelar" onClick={cerrar} disabled={enviando} />
        <PrimaryButton
          title={esEdicion ? 'Guardar' : 'Crear'}
          onClick={guardar}
          disabled={cargando}
          loading={enviando}
        />
      </div>
    </Modal>
  );
}
