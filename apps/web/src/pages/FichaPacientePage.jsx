import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import {
  cabeceraDePaciente,
  CAMPOS_FICHA_PACIENTE,
  formatearFechaCorta,
  permisosDeFicha,
  pestaniasDeFicha,
  resolverPestaniaDeFicha,
  TIPOS_DE_PRESENTACION,
  usePaciente,
  valoresDeFichaPaciente,
} from '@ecopac/shared';

import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  ScreenContainer,
  StatusChip,
  Tabs,
} from '../components';
import { useSesionCompartida } from '../contexto/SesionProvider';
import ModalCondicionesPaciente from './ModalCondicionesPaciente';
import ModalEdicionPaciente from './ModalEdicionPaciente';
import NotFoundPage from './NotFoundPage';
import PestaniaHistorialPaciente from './PestaniaHistorialPaciente';
import PestaniaRecetasPaciente from './PestaniaRecetasPaciente';
import PestaniaSignosPaciente from './PestaniaSignosPaciente';

const PARAMETRO_PESTANIA = 'pestania';

function valorDeCampo(campo, valores) {
  const valor = valores[campo.id];
  if (valor === null || valor === undefined || valor === '') return '—';
  if (campo.tipo === TIPOS_DE_PRESENTACION.FECHA) return formatearFechaCorta(valor);
  return valor;
}

export default function FichaPacientePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const { rol } = useSesionCompartida();
  const { paciente, cargando, error, recargar } = usePaciente(id, { rol });
  const [editando, setEditando] = useState(false);
  const [gestionandoCondiciones, setGestionandoCondiciones] = useState(false);

  const pestanias = pestaniasDeFicha(rol);
  const permisos = permisosDeFicha(rol);
  const pestaniaActiva = resolverPestaniaDeFicha(parametros.get(PARAMETRO_PESTANIA), rol);

  const cambiarPestania = (siguiente) => {
    const proximos = new URLSearchParams(parametros);
    proximos.set(PARAMETRO_PESTANIA, siguiente);
    setParametros(proximos, { replace: true });
  };

  if (cargando && !paciente) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (error && !paciente) {
    return (
      <ScreenContainer>
        <PageHeader
          title="Ficha del paciente"
          actions={[
            { label: 'Volver', onClick: () => navigate('/pacientes'), variant: 'secondary' },
          ]}
        />
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  if (!paciente) {
    return <NotFoundPage />;
  }

  const cabecera = cabeceraDePaciente(paciente);
  const valores = valoresDeFichaPaciente(paciente);

  const acciones = [
    { label: 'Volver', onClick: () => navigate('/pacientes'), variant: 'secondary' },
  ];

  if (permisos.puedeEditar) {
    acciones.push({ label: 'Editar datos', onClick: () => setEditando(true) });
    acciones.push({
      label: 'Condiciones cronicas',
      onClick: () => setGestionandoCondiciones(true),
      variant: 'secondary',
    });
  }

  const alGuardar = async () => {
    setEditando(false);
    await recargar();
  };

  return (
    <ScreenContainer>
      <PageHeader
        title={cabecera.nombreCompleto ?? 'Paciente sin nombre'}
        subtitle={[
          cabecera.numeroFicha ? `Ficha ${cabecera.numeroFicha}` : null,
          cabecera.edad,
          cabecera.comunidad,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={acciones}
      />

      {cabecera.condiciones.length > 0 && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <span className="text-body-secondary">Condiciones cronicas:</span>
          {cabecera.condiciones.map((condicion) => (
            <StatusChip
              key={condicion.id}
              status={condicion.estado}
              label={`${condicion.nombre} · ${condicion.etiquetaEstado}`}
            />
          ))}
        </div>
      )}

      <Tabs tabs={pestanias} activo={pestaniaActiva} onChange={cambiarPestania}>
        {pestaniaActiva === 'generales' && (
          <Card>
            <dl className="row mb-0">
              {CAMPOS_FICHA_PACIENTE.map((campo) => (
                <div className="col-sm-6 mb-2" key={campo.id}>
                  <dt className="text-body-secondary fw-normal">{campo.label}</dt>
                  <dd className="mb-0">{valorDeCampo(campo, valores)}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}

        {pestaniaActiva === 'historial' && (
          <PestaniaHistorialPaciente pacienteId={paciente.id} rol={rol} />
        )}

        {pestaniaActiva === 'signos' && (
          <PestaniaSignosPaciente pacienteId={paciente.id} rol={rol} />
        )}

        {pestaniaActiva === 'recetas' && (
          <PestaniaRecetasPaciente paciente={paciente} rol={rol} />
        )}
      </Tabs>

      {editando && (
        <ModalEdicionPaciente
          paciente={paciente}
          onClose={() => setEditando(false)}
          onGuardado={alGuardar}
        />
      )}

      {gestionandoCondiciones && (
        <ModalCondicionesPaciente
          pacienteId={paciente.id}
          rol={rol}
          onClose={() => setGestionandoCondiciones(false)}
          onCambio={recargar}
        />
      )}
    </ScreenContainer>
  );
}
