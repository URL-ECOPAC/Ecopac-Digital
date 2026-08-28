import { useState } from 'react';

import {
  COLUMNAS_JORNADA,
  FILTROS_JORNADA,
  formatearFechaCorta,
  puedeEditarJornada,
  useJornadasKanban,
} from '@ecopac/shared';

import {
  Card,
  ErrorState,
  FilterBar,
  KanbanBoard,
  LoadingState,
  PageHeader,
  ScreenContainer,
  StatusChip,
} from '../components';
import { useSesionCompartida } from '../contexto/SesionProvider';
import ModalJornada from './ModalJornada';

// Pantalla de jornadas (issue #178): el tablero kanban de tres etapas que ya nombraba el
// placeholder que reemplaza ("Kanban de jornadas", issues #178 a #183) y que
// docs/ARQUITECTURA-FRONTEND.md:19-21 describe como la unica pantalla de /jornadas. #178
// construye la parte de mostrar y filtrar: los datos, la agrupacion por estado y los permisos
// salen de useJornadasKanban(), en packages/shared/jornadas/. Esta pantalla solo dibuja.
//
// Lo que #178 NO incluye, a proposito:
// - Arrastrar tarjetas entre columnas: KanbanBoard recibe onMover, pero aqui no se pasa, asi que
//   las tarjetas quedan de solo lectura. Conectarlo a cambiarEstadoJornada() (ya construida,
//   #171) es trabajo del rango de issues #179-#183.
// - Una barra de progreso de cupo: ningun criterio de #178 la pide y `cupoEstimado` no se pinta
//   en esta pantalla (ver COLUMNAS_JORNADA en columnas.js).
//
// El formulario de alta y edicion (issue #179) reusa el mismo patron que el alta de personal
// (#106, ModalAltaUsuario): un modal montado desde aca con estado local, sin ruta propia. El
// boton "Nueva jornada" abre ModalJornada sin `jornada` (alta); hacer click en una tarjeta la
// abre con la jornada de esa tarjeta (edicion), solo si puedeEditarJornada(rol, tarjeta.estado)
// lo permite -esa funcion ya encapsula la regla de #170 de que una jornada finalizada no se
// edita salvo la administradora, ver jornadas/permisos.js-. No se toca KanbanBoard.jsx para
// esto: el onClick vive en el <Card> que TarjetaJornada ya envuelve, dentro del renderTarjeta
// que esta pagina controla.
//
// La version movil de esta misma pantalla es la #186 y deberia consumir el mismo hook. No hay
// un issue de movil identificado para el formulario de #179 (ver PLAN.md, punto 8).
export default function JornadasPage() {
  const { rol } = useSesionCompartida();
  const { columnas, filtros, setFiltro, cargando, error, recargar, total, catalogos, puedeCrear } =
    useJornadasKanban(rol);
  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [jornadaEnEdicion, setJornadaEnEdicion] = useState(null);

  // El criterio 2 solo pide filtrar por estado, comunidad y rango de fechas. FILTROS_JORNADA
  // (filtros.js) tambien declara 'busqueda', pero listarJornadas() (#170, ya cerrada) no acepta
  // ningun parametro de busqueda de texto: se omite aqui en vez de pasarlo a un filtro que no
  // hace nada. El descriptor no se toca (lo seguiria necesitando cualquier listado futuro que si
  // busque por texto).
  const filtrosDelTablero = FILTROS_JORNADA.filter((campo) => campo.id !== 'busqueda');

  if (error) {
    return (
      <ScreenContainer>
        <PageHeader title="Jornadas" />
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      <PageHeader
        title="Jornadas"
        subtitle={total === 1 ? '1 jornada' : `${total} jornadas`}
        actions={puedeCrear ? [{ label: 'Nueva jornada', onClick: () => setMostrarAlta(true) }] : []}
      />

      <FilterBar
        campos={filtrosDelTablero}
        valores={filtros}
        onChange={setFiltro}
        catalogos={catalogos}
      />

      {cargando ? (
        <LoadingState />
      ) : (
        <KanbanBoard
          columnas={columnas}
          renderTarjeta={(tarjeta) => (
            <TarjetaJornada
              jornada={tarjeta}
              onEditar={
                puedeEditarJornada(rol, tarjeta.estado) ? () => setJornadaEnEdicion(tarjeta) : null
              }
            />
          )}
        />
      )}

      {mostrarAlta && (
        <ModalJornada
          rol={rol}
          onClose={() => setMostrarAlta(false)}
          onGuardado={() => {
            setMostrarAlta(false);
            recargar();
          }}
        />
      )}

      {jornadaEnEdicion && (
        <ModalJornada
          key={jornadaEnEdicion.id}
          jornada={jornadaEnEdicion}
          rol={rol}
          onClose={() => setJornadaEnEdicion(null)}
          onGuardado={() => {
            setJornadaEnEdicion(null);
            recargar();
          }}
        />
      )}
    </ScreenContainer>
  );
}

/** Etiquetas de COLUMNAS_JORNADA, para no escribirlas sueltas en la tarjeta. */
const ETIQUETAS = Object.fromEntries(
  COLUMNAS_JORNADA.map((columna) => [columna.id, columna.label]),
);

/**
 * Misma variable CSS que StatusChip.jsx usa para el color de fondo del chip
 * (`--estado-<valor-con-guiones>`, publicada por theme.js a partir de statusColors de
 * @ecopac/ui-tokens). Se reutiliza aqui, en vez de declarar un color nuevo, para que el borde de
 * la tarjeta y el chip de su propio encabezado sean siempre el mismo color por construccion.
 */
function colorDeEstado(estado) {
  return `var(--estado-${String(estado).replace(/ /g, '-')}, var(--color-secondary))`;
}

/**
 * Tarjeta del kanban: exactamente los seis datos del criterio 1 (nombre, fecha, comunidad,
 * responsable, estado, pacientes atendidos). `codigo` y `cupoEstimado` existen en
 * COLUMNAS_JORNADA pero no se pintan aqui (ver columnas.js).
 *
 * `pacientesAtendidos` puede venir ausente: medico y voluntario no tienen permiso de lectura
 * sobre vista_reporte_impacto (00064), y useJornadasKanban() no inventa un 0 para ese caso. Un
 * guion distingue "sin permiso para verlo" de "cero pacientes reales".
 *
 * El borde izquierdo repite el color de StatusChip (colorDeEstado): con cuatro columnas ya
 * separadas por titulo, la tarjeta no necesitaba el color para saber en que columna esta, pero
 * si ayuda a distinguir el estado de un vistazo dentro de una columna larga y, sobre todo, si
 * esta pantalla alguna vez deja de agrupar por columna (por ejemplo en una vista movil futura,
 * #186, que apile las tarjetas en una lista).
 *
 * `onEditar` (issue #179) abre el modal de edicion. Card ya se vuelve interactiva y responde al
 * teclado en cuanto recibe un `onClick` (ver components/Card.jsx); sin `onEditar` la tarjeta
 * sigue siendo de solo lectura, que es lo que pasa cuando puedeEditarJornada(rol, jornada.estado)
 * es falso (JornadasPage.jsx decide eso, no este componente).
 */
function TarjetaJornada({ jornada, onEditar }) {
  const tienePacientes = Object.prototype.hasOwnProperty.call(jornada, 'pacientesAtendidos');

  return (
    <Card
      onClick={onEditar ?? undefined}
      style={{ borderLeft: `4px solid ${colorDeEstado(jornada.estado)}` }}
    >
      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
        <span className="fw-semibold">{jornada.nombre}</span>
        <StatusChip status={jornada.estado} />
      </div>
      <div className="small" style={{ color: 'var(--color-text-muted)' }}>
        <div>{formatearFechaCorta(jornada.fecha)}</div>
        <div>{jornada.comunidad || '—'}</div>
        <div>
          {ETIQUETAS.responsable}: {jornada.responsable || '—'}
        </div>
        <div>
          {ETIQUETAS.pacientesAtendidos}: {tienePacientes ? jornada.pacientesAtendidos : '—'}
        </div>
      </div>
    </Card>
  );
}
