import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  COLUMNAS_HISTORIAL_JORNADA,
  COLUMNAS_JORNADA,
  COLUMNAS_PACIENTES_ATENDIDOS_JORNADA,
  COLUMNAS_PERSONAL_JORNADA,
  contarPersonalPorRol,
  ESTADOS_JORNADA,
  formatearFechaConHora,
  formatearFechaCorta,
  puedeVerRosterCompleto,
  useDetalleJornada,
} from '@ecopac/shared';

import {
  Card,
  DataList,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  StatusChip,
  Tabs,
} from '../components';
import { useSesionCompartida } from '../contexto/SesionProvider';
import ModalAsignarPersonal from './ModalAsignarPersonal';
import ModalConfirmarDesasignacion from './ModalConfirmarDesasignacion';
import NotFoundPage from './NotFoundPage';

// Detalle de una jornada (issue #181): sus datos, el personal asignado, los pacientes
// atendidos con su diagnostico principal y el historial de cambios de estado. Todo lo que se
// dibuja aca sale de useDetalleJornada() (packages/shared/jornadas/); esta pantalla solo
// arma las pestañas y traduce los datos ya resueltos a lo que DataList/Card saben pintar.
//
// Ruta propia, no modal (PLAN.md, decision del 2026-08-28): a diferencia de ModalJornada.jsx
// (un formulario), esto es una pantalla con cuatro secciones, historial y una lista de
// pacientes -- meterla en un modal habria significado anidar el futuro formulario de #182
// (asignar personal) DENTRO de este modal, fragil con react-bootstrap. Una URL por jornada
// ademas es util de verdad para un equipo que se pasa un enlace. La ruta vive en App.jsx con
// el mismo guard de roles que ya protege /jornadas; no se toco navegacion.js (una ruta puede
// existir sin entrada en MODULOS, como ya hace /perfil).
const PESTANIAS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'equipo', label: 'Equipo' },
  { id: 'pacientes', label: 'Pacientes atendidos' },
  { id: 'historial', label: 'Historial' },
];

/** Etiquetas de COLUMNAS_JORNADA, igual que JornadasPage.jsx, para no repetir texto suelto. */
const ETIQUETAS = Object.fromEntries(
  COLUMNAS_JORNADA.map((columna) => [columna.id, columna.label]),
);

/** Nombre completo de un perfil embebido ({ nombres, apellidos }), o `null` si no llego. */
function nombreDePerfil(perfil) {
  const nombre = [perfil?.nombres, perfil?.apellidos].filter(Boolean).join(' ').trim();
  return nombre || null;
}

export default function DetalleJornadaPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { rol } = useSesionCompartida();
  const {
    jornada,
    historial,
    pacientesAtendidos,
    cargando,
    error,
    recargar,
    recargarPersonal,
    permisos,
    destinos,
    cambiarEstado,
    moviendo,
    errorMovimiento,
    descartarErrorMovimiento,
    confirmacionFinalizar,
    confirmarFinalizacion,
    cancelarFinalizacion,
  } = useDetalleJornada({ jornadaId: id, rol });

  const [pestaniaActiva, setPestaniaActiva] = useState('resumen');
  // Issue #182: modal de buscar/asignar y confirmacion de desasignar, ambos gateados por
  // permisos.puedeEditar mas abajo (espejo de la politica RLS de INSERT/DELETE de
  // jornada_personal, 00039:71-73 y 00044:24-26, ver useAsignacionPersonal.js).
  const [mostrarAsignar, setMostrarAsignar] = useState(false);
  const [personaADesasignar, setPersonaADesasignar] = useState(null);

  // Primera carga (o al navegar a otro id): todavia no hay nada que mostrar en el encabezado
  // (el titulo sale de jornada.nombre), asi que la pantalla completa es un spinner.
  if (cargando && !jornada) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  // Mismo caso, pero la primera carga fallo (red, servidor): sin jornada todavia no hay
  // encabezado que pintar.
  if (error && !jornada) {
    return (
      <ScreenContainer>
        <PageHeader
          title="Detalle de la jornada"
          actions={[{ label: 'Volver', onClick: () => navigate('/jornadas'), variant: 'secondary' }]}
        />
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  // jornada llega en null sin error cuando la fila no existe o cuando RLS no la deja ver
  // (obtenerJornada(), jornadas/api.js:220-222): son casos distintos para la base de datos
  // pero el mismo para quien mira la pantalla, y confirmarle a alguien sin permiso que la fila
  // SI existe (solo que no la puede ver) seria filtrar mas de lo que ya filtra el 404 comun.
  // NotFoundPage ya dice exactamente eso ("no existe, no esta disponible o no tienes permisos
  // para verla"), asi que se reusa tal cual en vez de escribir un mensaje nuevo.
  if (!jornada) {
    return <NotFoundPage />;
  }

  const esReapertura = jornada.estado === ESTADOS_JORNADA.FINALIZADA;
  const [destino] = destinos;
  const puedeMover = (esReapertura ? permisos.puedeReabrir : permisos.puedeEditar) && Boolean(destino);

  const pestaniasVisibles = PESTANIAS.filter((pestania) => {
    // Ocultar, no mostrar vacio (PLAN.md seccion 4 / decision del 2026-08-28): quien no puede
    // ver datos clinicos o el historial de estados nunca llega a pedirlos (useDetalleJornada.js
    // ya no los trae para ese rol), asi que la pestaña tampoco se ofrece.
    if (pestania.id === 'pacientes') return permisos.puedeVerDatosClinicos;
    if (pestania.id === 'historial') return permisos.puedeVerHistorial;
    return true;
  });

  // perfilId viaja ademas de lo que pinta COLUMNAS_PERSONAL_JORNADA: lo necesita
  // ModalConfirmarDesasignacion (issue #182) para llamar a desasignarPersonal(jornadaId,
  // perfilId) -- fila.id es el id de la fila de jornada_personal, no el del perfil, y
  // desasignarPersonal() pide el segundo.
  const puedeVerEquipoCompleto = puedeVerRosterCompleto(rol);
  const conteoPorRol = contarPersonalPorRol(jornada.personal);
  const filasPersonal = (jornada.personal ?? []).map((fila) => ({
    id: fila.id,
    perfilId: fila.perfilId,
    perfil: nombreDePerfil(fila.perfil) ?? '—',
    rolEnJornada: fila.rolEnJornada,
    horaInicio: fila.horaInicio,
    horaFin: fila.horaFin,
    asistio: fila.asistio,
  }));

  const filasPacientes = pacientesAtendidos.map((fila) => ({
    id: fila.consultaId,
    paciente: fila.paciente,
    diagnosticoPrincipal: fila.diagnosticoPrincipal?.nombre ?? null,
  }));

  const filasHistorial = historial.map((fila) => ({
    id: fila.id,
    estadoAnterior: fila.estadoAnterior,
    estadoNuevo: fila.estadoNuevo,
    cambiadoPor: nombreDePerfil(fila.cambiadoPor) ?? 'Sistema',
    cuando: formatearFechaConHora(fila.createdAt),
  }));

  return (
    <ScreenContainer>
      <PageHeader
        title={jornada.nombre}
        subtitle={`${formatearFechaCorta(jornada.fecha)} · ${jornada.comunidad?.nombre ?? '—'}`}
        actions={[{ label: 'Volver', onClick: () => navigate('/jornadas'), variant: 'secondary' }]}
      />

      {errorMovimiento && (
        <div
          className="alert alert-danger d-flex justify-content-between align-items-start gap-2"
          role="alert"
        >
          <span>{errorMovimiento}</span>
          <button
            type="button"
            className="btn-close"
            aria-label="Cerrar"
            onClick={descartarErrorMovimiento}
          />
        </div>
      )}

      {/* Una recarga posterior a la primera (por ejemplo, la que dispara cambiarEstado() al
          terminar) vuelve a poner cargando en true sin borrar la jornada ya conocida
          (useDetalleJornada.js): el encabezado de arriba no parpadea, solo el contenido de la
          pestaña activa se reemplaza por el mismo LoadingState/ErrorState que ya usa
          JornadasPage.jsx para el tablero. */}
      {cargando ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error.mensaje} onRetry={recargar} />
      ) : (
      <Tabs tabs={pestaniasVisibles} activo={pestaniaActiva} onChange={setPestaniaActiva}>
        {pestaniaActiva === 'resumen' && (
          <Card>
            <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
              <StatusChip status={jornada.estado} />
              {/* Cambiar estado (criterio 4): mismas piezas que el tablero (issue #180) --
                  cambiarEstado() ya decide si hace falta la advertencia de atenciones
                  incompletas antes de finalizar (useDetalleJornada.js). `disabled={moviendo}`
                  evita un segundo click mientras la llamada esta en curso; por eso este control
                  vive aca y no en PageHeader, cuyo contrato de `actions` (label/onClick/variant)
                  no tiene forma de deshabilitar un boton. */}
              {puedeMover && esReapertura && (
                <SecondaryButton
                  title="← Atras"
                  onClick={() => cambiarEstado(destino)}
                  disabled={moviendo}
                />
              )}
              {puedeMover && !esReapertura && (
                <PrimaryButton
                  title="Avanzar →"
                  onClick={() => cambiarEstado(destino)}
                  loading={moviendo}
                />
              )}
            </div>
            <dl className="row mb-0">
              <dt className="col-sm-4">{ETIQUETAS.codigo}</dt>
              <dd className="col-sm-8">{jornada.codigo || '—'}</dd>

              <dt className="col-sm-4">{ETIQUETAS.responsable}</dt>
              <dd className="col-sm-8">{nombreDePerfil(jornada.responsable) ?? '—'}</dd>

              <dt className="col-sm-4">{ETIQUETAS.cupoEstimado}</dt>
              <dd className="col-sm-8">{jornada.cupoEstimado ?? '—'}</dd>
            </dl>

            <hr />

            {/* Indicadores del dia (criterio 1): vienen de vista_reporte_impacto (00027), via
                obtenerJornada(). `contadores` llega null cuando RLS no le da SELECT sobre esa
                vista a este rol (medico y voluntario, 00064) -- ver useDetalleJornada.js. Un
                guion en vez de 0 evita afirmar una atencion nula que no se puede confirmar,
                mismo criterio que pacientesAtendidos en la tarjeta del kanban (#178). */}
            <div className="row text-center">
              <div className="col-6 col-md-3 mb-3">
                <div className="h4 mb-0">{jornada.contadores?.pacientesAtendidos ?? '—'}</div>
                <div className="small text-muted">Pacientes atendidos</div>
              </div>
              <div className="col-6 col-md-3 mb-3">
                <div className="h4 mb-0">{jornada.contadores?.consultasRealizadas ?? '—'}</div>
                <div className="small text-muted">Consultas realizadas</div>
              </div>
              <div className="col-6 col-md-3 mb-3">
                <div className="h4 mb-0">{jornada.contadores?.tratamientosEntregados ?? '—'}</div>
                <div className="small text-muted">Tratamientos entregados</div>
              </div>
              <div className="col-6 col-md-3 mb-3">
                <div className="h4 mb-0">{jornada.contadores?.medicamentosUtilizados ?? '—'}</div>
                <div className="small text-muted">Medicamentos utilizados</div>
              </div>
            </div>
          </Card>
        )}

        {pestaniaActiva === 'equipo' && (
          <>
            {/* Asignar/desasignar personal (issue #182). El gate es permisos.puedeEditar
                (puedeAdministrarJornadas(rol), jornadas/permisos.js), espejo exacto de las
                politicas de INSERT y DELETE de jornada_personal (00039:71-73, 00044:24-26): las
                dos exigen unicamente es_administrador(), sin la excepcion de permiso fino que si
                tiene la tabla jornadas. Guardar/desasignar llama a recargarPersonal(), no a
                recargar(): relee solo jornada_personal, sin releer historial ni contadores. */}
            <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
              {/* Conteo por rol (criterio 5): jornada.personal ya viene filtrado por la politica
                  de SELECT de jornada_personal (00039:63-69) antes de llegar aca -- administrador
                  y junta directiva ven todas las filas, cualquier otro rol solo la suya, sin
                  error. Un conteo sobre una lista parcial se veria identico a uno completo, asi
                  que puedeVerRosterCompleto() (jornadas/permisos.js) decide cual de los dos
                  se muestra; nunca un numero sin marca de que puede estar incompleto. */}
              {puedeVerEquipoCompleto ? (
                <div className="d-flex flex-wrap gap-2">
                  {conteoPorRol.length === 0 ? (
                    <span className="text-muted small">Todavia no hay personal asignado.</span>
                  ) : (
                    conteoPorRol.map((fila) => (
                      <span key={fila.rol} className="badge text-bg-light border">
                        {fila.etiqueta}: {fila.cantidad}
                      </span>
                    ))
                  )}
                </div>
              ) : (
                <span className="text-muted small">
                  Esta vista solo muestra tu propia asignacion, si tienes una: el conteo por rol
                  no esta disponible para tu rol.
                </span>
              )}

              {permisos.puedeEditar && (
                <PrimaryButton title="Asignar personal" onClick={() => setMostrarAsignar(true)} />
              )}
            </div>

            <DataList
              columnas={COLUMNAS_PERSONAL_JORNADA}
              datos={filasPersonal}
              vacio="Todavia no hay personal asignado a esta jornada."
              onRowPress={permisos.puedeEditar ? (fila) => setPersonaADesasignar(fila) : undefined}
            />
          </>
        )}

        {pestaniaActiva === 'pacientes' && (
          <DataList
            columnas={COLUMNAS_PACIENTES_ATENDIDOS_JORNADA}
            datos={filasPacientes}
            vacio="Todavia no hay pacientes atendidos en esta jornada."
          />
        )}

        {pestaniaActiva === 'historial' && (
          <DataList
            columnas={COLUMNAS_HISTORIAL_JORNADA}
            datos={filasHistorial}
            vacio="Esta jornada todavia no tiene cambios de estado registrados."
          />
        )}
      </Tabs>
      )}

      {confirmacionFinalizar && (
        <Modal visible onClose={cancelarFinalizacion} title="Finalizar jornada">
          <div className="alert alert-warning" role="alert">
            {confirmacionFinalizar.cantidad === 1
              ? 'Esta jornada tiene 1 atencion registrada sin consulta todavia.'
              : `Esta jornada tiene ${confirmacionFinalizar.cantidad} atenciones registradas sin consulta todavia.`}{' '}
            ¿Confirmas finalizarla de todas formas?
          </div>
          <div className="d-flex justify-content-end gap-2 mt-3">
            <SecondaryButton title="Cancelar" onClick={cancelarFinalizacion} disabled={moviendo} />
            <PrimaryButton
              title="Finalizar de todas formas"
              onClick={confirmarFinalizacion}
              loading={moviendo}
            />
          </div>
        </Modal>
      )}

      {/* Issue #182. onAsignado/onDesasignado llaman a recargarPersonal() (useDetalleJornada.js),
          no a recargar(): ver el comentario de la pestaña Equipo mas arriba. */}
      <ModalAsignarPersonal
        visible={mostrarAsignar}
        jornadaId={id}
        jornadaFecha={jornada.fecha}
        personal={jornada.personal}
        onClose={() => setMostrarAsignar(false)}
        onAsignado={recargarPersonal}
      />

      {personaADesasignar && (
        <ModalConfirmarDesasignacion
          visible
          jornadaId={id}
          persona={personaADesasignar}
          onClose={() => setPersonaADesasignar(null)}
          onDesasignado={() => {
            setPersonaADesasignar(null);
            recargarPersonal();
          }}
        />
      )}
    </ScreenContainer>
  );
}
