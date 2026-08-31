import { useState } from "react";
import { ProgressBar } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

import { typography } from "@ecopac/ui-tokens";

import {
  COLUMNAS_JORNADA,
  ESTADOS_JORNADA,
  FILTROS_JORNADA,
  formatearFechaCorta,
  puedeEditarJornada,
  transicionesDeJornadaDesde,
  useJornadasKanban,
} from "@ecopac/shared";

import {
  Card,
  ErrorState,
  FilterBar,
  KanbanBoard,
  LoadingState,
  Modal,
  PageHeader,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  StatusChip,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalJornada from "./ModalJornada";

// Pantalla de jornadas: el tablero kanban de tres etapas que ya nombraba el placeholder que
// reemplaza ("Kanban de jornadas", issues #178 a #183) y que docs/ARQUITECTURA-FRONTEND.md:19-21
// describe como la unica pantalla de /jornadas. #178 construyo mostrar y filtrar; #180 conecta
// el movimiento de tarjetas. Los datos, la agrupacion por estado, los permisos y el movimiento
// salen de useJornadasKanban(), en packages/shared/jornadas/. Esta pantalla solo dibuja.
//
// Movimiento de tarjetas (issue #180): un solo handler, moverJornada() del hook, atiende tanto
// `onMover` de KanbanBoard (arrastre y flechas de teclado, que ya comparten un solo camino
// dentro de ese componente) como los botones "Atras"/"Avanzar" de cada tarjeta (PLAN.md seccion
// 2, decision 2: si divergieran, una ruta permitiria algo que la otra no). `onMover` se pasa sin
// condicion de permisos: KanbanBoard.jsx (que no se toca) deja `draggable` siempre activo, asi
// que moverJornada() -> cambiarEstadoJornada() es quien de verdad explica por que un movimiento
// no procede (criterio 3), incluso cuando la razon es no tener permiso.
//
// Botones de la tarjeta (issue #180, criterio 5 -alternativa accesible al arrastre-, PLAN.md
// seccion 2 decision 3): "Editar", "Atras" y "Avanzar" reemplazan el onClick que el Card de
// #179 le ponia a toda la tarjeta. Un Card con onClick es un elemento interactivo (role="button")
// con otros elementos interactivos anidados si se le agregan botones adentro -HTML invalido y
// semantica rota para lector de pantalla-, asi que el Card deja de ser clicable: los botones
// son ahora los unicos elementos interactivos, cada uno con su propio nombre accesible.
// Esto cambia el gesto que entrego #179 (antes, click en cualquier parte de la tarjeta abria la
// edicion); es deliberado, ver PLAN.md seccion 2, decision 3.
//
// "Ver detalle" (issue #181) se suma a ese mismo grupo de botones, sin condicion de permiso: es
// la unica ruta hacia /jornadas/:id (DetalleJornadaPage.jsx), que despues decide seccion por
// seccion que ve cada rol. No reemplaza a los otros tres ni cambia sus reglas.
//
// Cada uno de los otros botones se muestra solo si el rol lo permite (nunca se ve un boton que
// va a fallar): "Editar" con puedeEditarJornada(rol, tarjeta.estado) (regla de #170, sin
// cambios); "Avanzar" y "Atras" con `puedeEditar` del hook, y el destino finalizada -> en curso
// ademas con `puedeReabrir` (regla de reapertura de #171, solo administrador).
//
// Advertencia de atenciones incompletas al finalizar (issue #171, criterio 4; issue #180,
// PLAN.md seccion 2 decision 4, alcance añadido sobre los criterios textuales de #180): la unica
// pantalla que ejecuta en curso -> finalizada es esta, asi que el aviso -advierte, no impide- se
// construye aca con el mismo patron de Modal + alert-warning + confirmar/cancelar que ya usa
// ModalConfirmarDesactivacion.jsx (#107). Un fallo al consultar el conteo no bloquea finalizar
// (useJornadasKanban.js, moverJornada).
//
// El tablero muestra cuatro columnas, no tres (issue #180, criterio 1 -"tres columnas"-: es una
// imprecision del issue frente al modelo real, estado_jornada tiene cuatro valores, 00001).
// agruparJornadasPorEstado() (useJornadasKanban.js) sigue agrupando por las cuatro entradas de
// OPCIONES_ESTADO_JORNADA (filtros.js), sin cambios: filtrar la columna 'cancelada' segun
// TRANSICIONES_JORNADA convertiria una regla de movimiento en una regla de visibilidad, le
// esconderia esa columna a medico y voluntario -que solo miran el tablero, nunca mueven nada- y
// dejaria el filtro de estado (que si ofrece 'cancelada') mostrando columnas vacias sin
// explicacion. Documentado como hallazgo en el PR, no corregido en el codigo.
//
// Una barra de progreso de cupo sigue sin pintarse (`cupoEstimado` no esta en el criterio 1 de
// #178, ver COLUMNAS_JORNADA en columnas.js).
//
// El formulario de alta y edicion (issue #179) reusa el mismo patron que el alta de personal
// (#106, ModalAltaUsuario): un modal montado desde aca con estado local, sin ruta propia.
//
// La version movil de esta misma pantalla es la #186/#187 y deberia consumir el mismo hook:
// moverJornada() ya tiene la firma que espera el KanbanBoard movil (misma que el web,
// apps/mobile/src/components/KanbanBoard.js). No hay un issue de movil identificado para el
// formulario de #179 (ver PLAN.md, punto 8).
export default function JornadasPage() {
  const navigate = useNavigate();
  const { rol } = useSesionCompartida();
  const {
    columnas,
    filtros,
    setFiltro,
    cargando,
    error,
    recargar,
    total,
    catalogos,
    puedeCrear,
    puedeEditar,
    puedeReabrir,
    moverJornada,
    moviendo,
    errorMovimiento,
    descartarErrorMovimiento,
    confirmacionFinalizar,
    confirmarFinalizacion,
    cancelarFinalizacion,
  } = useJornadasKanban(rol);
  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [jornadaEnEdicion, setJornadaEnEdicion] = useState(null);

  // El criterio 2 solo pide filtrar por estado, comunidad y rango de fechas. FILTROS_JORNADA
  // (filtros.js) tambien declara 'busqueda', pero listarJornadas() (#170, ya cerrada) no acepta
  // ningun parametro de busqueda de texto: se omite aqui en vez de pasarlo a un filtro que no
  // hace nada. El descriptor no se toca (lo seguiria necesitando cualquier listado futuro que si
  // busque por texto).
  const filtrosDelTablero = FILTROS_JORNADA.filter((campo) => campo.id !== "busqueda");

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
        subtitle={total === 1 ? "1 jornada" : `${total} jornadas`}
        actions={
          puedeCrear ? [{ label: "Nueva jornada", onClick: () => setMostrarAlta(true) }] : []
        }
      />

      <FilterBar
        campos={filtrosDelTablero}
        valores={filtros}
        onChange={setFiltro}
        catalogos={catalogos}
      />

      {errorMovimiento && (
        <div
          className="alert alert-danger d-flex justify-content-between align-items-start gap-2"
          role="alert"
        >
          <span>{errorMovimiento.mensaje}</span>
          <button
            type="button"
            className="btn-close"
            aria-label="Cerrar"
            onClick={descartarErrorMovimiento}
          />
        </div>
      )}

      {cargando ? (
        <LoadingState />
      ) : (
        <KanbanBoard
          columnas={columnas}
          onMover={moverJornada}
          mensajeVacio="Sin jornadas"
          columnaAtenuada={(id) => id === ESTADOS_JORNADA.CANCELADA}
          renderTarjeta={(tarjeta) => (
            <TarjetaJornada
              jornada={tarjeta}
              puedeEditar={puedeEditar}
              puedeReabrir={puedeReabrir}
              moviendo={moviendo}
              onEditar={
                puedeEditarJornada(rol, tarjeta.estado) ? () => setJornadaEnEdicion(tarjeta) : null
              }
              onMover={moverJornada}
              onVerDetalle={() => navigate(`/jornadas/${tarjeta.id}`)}
            />
          )}
        />
      )}

      {confirmacionFinalizar && (
        <Modal visible onClose={cancelarFinalizacion} title="Finalizar jornada">
          <div className="alert alert-warning" role="alert">
            {confirmacionFinalizar.cantidad === 1
              ? "Esta jornada tiene 1 atencion registrada sin consulta todavia."
              : `Esta jornada tiene ${confirmacionFinalizar.cantidad} atenciones registradas sin consulta todavia.`}{" "}
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
  return `var(--estado-${String(estado).replace(/ /g, "-")}, var(--color-secondary))`;
}

/**
 * Tarjeta del kanban: los seis datos del criterio 1 de #178 (nombre, fecha, comunidad,
 * responsable, estado, pacientes atendidos), mas los botones de accion de #180 y la barra de
 * progreso de pacientes atendidos sobre `cupoEstimado` (arreglo de diseno del tablero). `codigo`
 * existe en COLUMNAS_JORNADA pero no se pinta aqui (ver columnas.js).
 *
 * `pacientesAtendidos` puede venir ausente: medico y voluntario no tienen permiso de lectura
 * sobre vista_reporte_impacto (00064), y useJornadasKanban() no inventa un 0 para ese caso. Un
 * guion distingue "sin permiso para verlo" de "cero pacientes reales". Sin ese permiso no hay
 * numerador para la barra, asi que tampoco se pinta (ver `tienePacientes` abajo).
 *
 * `cupoEstimado` puede venir `null` (columna opcional, 00036): sin un total la barra no tiene
 * contra que medirse, asi que la tarjeta cae al mismo texto numerico que ya mostraba antes de
 * este arreglo de diseno, sin inventar un cupo.
 *
 * El borde izquierdo repite el color de StatusChip (colorDeEstado): con cuatro columnas ya
 * separadas por titulo, la tarjeta no necesitaba el color para saber en que columna esta, pero
 * si ayuda a distinguir el estado de un vistazo dentro de una columna larga y, sobre todo, si
 * esta pantalla alguna vez deja de agrupar por columna (por ejemplo en una vista movil futura,
 * #186, que apile las tarjetas en una lista).
 *
 * El Card ya NO recibe onClick (issue #180, PLAN.md seccion 2 decision 3): antes (#179) toda la
 * tarjeta era clicable para editar, con Card poniendose role="button" por su cuenta
 * (components/Card.jsx). Agregarle botones adentro a un Card asi habria anidado un elemento
 * interactivo dentro de otro -HTML invalido, semantica rota para lector de pantalla-, y
 * ademas duplicaba el punto de foco que ya pone KanbanBoard.jsx en el div que envuelve cada
 * tarjeta (arrastre + flechas). Los botones de aqui abajo son ahora los unicos elementos
 * interactivos de la tarjeta.
 *
 * Cada boton se muestra solo si el rol puede usarlo -nunca un boton que va a fallar-, con la
 * unica excepcion de "Ver detalle" (issue #181): va siempre, sin condicion, porque no cambia
 * nada -es la ruta hacia /jornadas/:id (DetalleJornadaPage.jsx), que decide seccion por seccion
 * que ve cada rol- y cualquier rol que ve el tablero puede ver el detalle de una jornada.
 * - "Editar" (issue #179): con puedeEditarJornada(rol, jornada.estado), sin cambios de regla.
 * - "Avanzar" / "Atras" (issue #180, criterio 5): con `destino`, el unico siguiente estado que
 *   transicionesDeJornadaDesde() (validaciones.js, via @ecopac/shared) declara para el estado
 *   actual -nunca un estado escrito a mano aca-. `esReapertura` (estado actual finalizada, unico
 *   caso con "Atras" en vez de "Avanzar") ademas exige `puedeReabrir`, no solo `puedeEditar`
 *   (regla de #171: solo administrador reabre).
 * - Los dos llaman al mismo `onMover` que recibe KanbanBoard como `onMover` (PLAN.md seccion 2
 *   decision 2: un solo handler, para que arrastre y botones nunca diverjan).
 */
function TarjetaJornada({
  jornada,
  puedeEditar,
  puedeReabrir,
  moviendo,
  onEditar,
  onMover,
  onVerDetalle,
}) {
  const tienePacientes = Object.prototype.hasOwnProperty.call(jornada, "pacientesAtendidos");
  const tieneCupo = typeof jornada.cupoEstimado === "number" && jornada.cupoEstimado > 0;
  const tieneProgreso = tienePacientes && tieneCupo;
  const porcentajeAtendido = tieneProgreso
    ? Math.min(100, Math.round((jornada.pacientesAtendidos / jornada.cupoEstimado) * 100))
    : 0;

  const esReapertura = jornada.estado === ESTADOS_JORNADA.FINALIZADA;
  const [destino] = transicionesDeJornadaDesde(jornada.estado);
  const puedeMover = (esReapertura ? puedeReabrir : puedeEditar) && Boolean(destino);

  return (
    <Card style={{ borderLeft: `4px solid ${colorDeEstado(jornada.estado)}` }}>
      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
        <span className="fw-bold">{jornada.nombre}</span>
        <StatusChip status={jornada.estado} />
      </div>
      <div className="small" style={{ color: "var(--color-text-muted)" }}>
        {jornada.comunidad || "—"} · {formatearFechaCorta(jornada.fecha)}
      </div>
      <div
        className="mb-2"
        style={{ color: "var(--color-text-muted)", fontSize: typography.sizes.xs }}
      >
        {ETIQUETAS.responsable}: {jornada.responsable || "—"}
      </div>

      <div className="mb-2">
        {tieneProgreso ? (
          <div className="d-flex align-items-center gap-2">
            <ProgressBar
              now={porcentajeAtendido}
              variant="primary"
              style={{ height: "6px", flex: "1 1 auto" }}
            />
            <span className="small" style={{ color: "var(--color-text-muted)" }}>
              {jornada.pacientesAtendidos}/{jornada.cupoEstimado}
            </span>
          </div>
        ) : (
          <div className="small" style={{ color: "var(--color-text-muted)" }}>
            {ETIQUETAS.pacientesAtendidos}: {tienePacientes ? jornada.pacientesAtendidos : "—"}
          </div>
        )}
      </div>

      {/* "Ver detalle" (issue #181) es el unico boton sin condicion de permiso: la pantalla de
          destino (/jornadas/:id) es la que decide, seccion por seccion, que ve cada rol -- lo
          mismo que ya hace esta tarjeta con `puedeVer` en el guard de la ruta /jornadas. Va
          siempre a la izquierda, separado de "Editar"/"Atras"/"Avanzar" (issue #180, que no se
          tocan), para no confundir "ver" con las acciones que si cambian algo. */}
      <div className="d-flex justify-content-between align-items-center gap-2 mt-2">
        <div className="d-flex gap-2">
          <SecondaryButton title="Ver detalle" onClick={onVerDetalle} disabled={moviendo} />
          {puedeMover && esReapertura && (
            <SecondaryButton
              title="← Atras"
              onClick={() => onMover(jornada.id, jornada.estado, destino)}
              disabled={moviendo}
            />
          )}
        </div>
        <div className="d-flex gap-2">
          {onEditar && <SecondaryButton title="Editar" onClick={onEditar} disabled={moviendo} />}
          {puedeMover && !esReapertura && (
            <PrimaryButton
              title="Avanzar →"
              onClick={() => onMover(jornada.id, jornada.estado, destino)}
              disabled={moviendo}
            />
          )}
        </div>
      </div>
    </Card>
  );
}
