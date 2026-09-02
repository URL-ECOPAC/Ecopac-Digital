import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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
  useCuadroTurnos,
  useDetalleJornada,
  useResumenCierreJornada,
} from "@ecopac/shared";

import {
  Card,
  DataList,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  StatusChip,
  Tabs,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import CuadroTurnosImprimible from "./CuadroTurnosImprimible";
import ModalAsignarPersonal from "./ModalAsignarPersonal";
import ModalEdicionTurno from "./ModalEdicionTurno";
import NotFoundPage from "./NotFoundPage";

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
//
// Pestaña "Cierre" (issue #183, excepcion de alcance autorizada: pestaña nueva, mismo
// tratamiento que "Equipo" de #185): unica dueña de la transicion en curso -> finalizada. El
// boton "Avanzar" de la pestaña "Resumen" (mas abajo) NO llama a cambiarEstado() para ese
// destino -- cambia pestaniaActiva a "cierre" en su lugar. Sirve para el resumen previo (criterios
// 1-3, con useResumenCierreJornada()) y para consultarlo despues (criterio 5): es la misma
// pestaña, no dos -- lo que cambia es si se ofrece el boton "Confirmar cierre" (solo con la
// jornada en curso y permiso), no el contenido que se calcula.
const PESTANIAS = [
  { id: "resumen", label: "Resumen" },
  { id: "equipo", label: "Equipo" },
  { id: "pacientes", label: "Pacientes atendidos" },
  { id: "historial", label: "Historial" },
  { id: "cierre", label: "Cierre" },
];

/** Etiquetas de COLUMNAS_JORNADA, igual que JornadasPage.jsx, para no repetir texto suelto. */
const ETIQUETAS = Object.fromEntries(
  COLUMNAS_JORNADA.map((columna) => [columna.id, columna.label]),
);

/** Nombre completo de un perfil embebido ({ nombres, apellidos }), o `null` si no llego. */
function nombreDePerfil(perfil) {
  const nombre = [perfil?.nombres, perfil?.apellidos].filter(Boolean).join(" ").trim();
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
  } = useDetalleJornada({ jornadaId: id, rol });

  // Issue #185: advertencias de horario del cuadro de turnos (choque de dia completo de #182 +
  // traslape real de horas, las dos conviven). Se llama incondicionalmente, antes de los early
  // return de mas abajo, porque `jornada` todavia puede ser null en el primer render (reglas de
  // hooks) -- el propio hook ya sabe esperar a que llegue jornadaFecha.
  const { advertencias, asignacionesDelDia, errorAdvertencias } = useCuadroTurnos({
    jornadaId: id,
    jornadaFecha: jornada?.fecha,
    personal: jornada?.personal,
  });

  // Issue #183: resumen y confirmacion de la pestaña "Cierre". `onCerrada: recargar` es lo que
  // hace que, al confirmar, esta pantalla vuelva a leer la jornada (useDetalleJornada.recargar) y
  // se refleje el nuevo estado ("finalizada") en el resto de la pantalla -- mismo patron que
  // onGuardado/onAsignado ya usan con recargarPersonal() en la pestaña Equipo.
  const {
    resumen: resumenCierre,
    cargando: cargandoResumenCierre,
    hayAdvertencias: hayAdvertenciasDeCierre,
    confirmarCierre,
    confirmando: confirmandoCierre,
    errorCierre,
  } = useResumenCierreJornada({ jornada, rol, onCerrada: recargar });

  const [pestaniaActiva, setPestaniaActiva] = useState("resumen");
  // Issue #182: modal de buscar/asignar, gateado por permisos.puedeEditar mas abajo (espejo de
  // la politica RLS de INSERT de jornada_personal, 00039:71-73, ver useAsignacionPersonal.js).
  const [mostrarAsignar, setMostrarAsignar] = useState(false);
  // Issue #185: click en una fila abre la edicion de horario/responsabilidad; Desasignar (#182,
  // 00044:24-26) vive ahora adentro de ese modal (ModalEdicionTurno.jsx), no en la fila.
  const [filaEnEdicion, setFilaEnEdicion] = useState(null);
  // Issue #185, criterio 4: version imprimible, montada en un portal fuera de esta pantalla
  // mientras `aImprimir` es true (CuadroTurnosImprimible.jsx). Mismo patron que
  // PestaniaRecetasPaciente.jsx (#131): requestAnimationFrame para esperar al primer pintado del
  // portal antes de llamar a window.print(), y "afterprint" para desmontarlo despues.
  const [aImprimir, setAImprimir] = useState(false);

  useEffect(() => {
    if (!aImprimir) return undefined;

    const limpiar = () => setAImprimir(false);
    window.addEventListener("afterprint", limpiar);
    const cuadro = window.requestAnimationFrame(() => window.print());

    return () => {
      window.removeEventListener("afterprint", limpiar);
      window.cancelAnimationFrame(cuadro);
    };
  }, [aImprimir]);

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
          actions={[
            { label: "Volver", onClick: () => navigate("/jornadas"), variant: "secondary" },
          ]}
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
  const puedeMover =
    (esReapertura ? permisos.puedeReabrir : permisos.puedeEditar) && Boolean(destino);

  const pestaniasVisibles = PESTANIAS.filter((pestania) => {
    // Ocultar, no mostrar vacio (PLAN.md seccion 4 / decision del 2026-08-28): quien no puede
    // ver datos clinicos o el historial de estados nunca llega a pedirlos (useDetalleJornada.js
    // ya no los trae para ese rol), asi que la pestaña tampoco se ofrece.
    if (pestania.id === "pacientes") return permisos.puedeVerDatosClinicos;
    if (pestania.id === "historial") return permisos.puedeVerHistorial;
    return true;
  });

  // perfilId viaja ademas de lo que pinta COLUMNAS_PERSONAL_JORNADA: lo necesita
  // ModalConfirmarDesasignacion (issue #182, ahora anidado en ModalEdicionTurno.jsx de #185) para
  // llamar a desasignarPersonal(jornadaId, perfilId) -- fila.id es el id de la fila de
  // jornada_personal, no el del perfil, y desasignarPersonal() pide el segundo.
  const puedeVerEquipoCompleto = puedeVerRosterCompleto(rol);
  const conteoPorRol = contarPersonalPorRol(jornada.personal);
  const filasPersonal = (jornada.personal ?? []).map((fila) => ({
    id: fila.id,
    perfilId: fila.perfilId,
    perfil: nombreDePerfil(fila.perfil) ?? "—",
    rolEnJornada: fila.rolEnJornada,
    horaInicio: fila.horaInicio,
    horaFin: fila.horaFin,
    responsabilidad: fila.responsabilidad,
    asistio: fila.asistio,
  }));

  // Issue #185, criterio 3: filas con alguna advertencia de horario activa (choque de dia
  // completo y/o traslape real), para las alertas debajo del boton de asignar. `advertencias` ya
  // viene indexado por perfilId (useCuadroTurnos.js).
  const filasConAdvertencia = filasPersonal.filter((fila) => {
    const advertencia = advertencias[fila.perfilId];
    return Boolean(advertencia?.choque || advertencia?.traslape);
  });

  const filasPacientes = pacientesAtendidos.map((fila) => ({
    id: fila.consultaId,
    paciente: fila.paciente,
    diagnosticoPrincipal: fila.diagnosticoPrincipal?.nombre ?? null,
  }));

  const filasHistorial = historial.map((fila) => ({
    id: fila.id,
    estadoAnterior: fila.estadoAnterior,
    estadoNuevo: fila.estadoNuevo,
    cambiadoPor: nombreDePerfil(fila.cambiadoPor) ?? "Sistema",
    cuando: formatearFechaConHora(fila.createdAt),
  }));

  return (
    <ScreenContainer>
      <PageHeader
        title={jornada.nombre}
        subtitle={`${formatearFechaCorta(jornada.fecha)} · ${jornada.comunidad?.nombre ?? "—"}`}
        actions={[{ label: "Volver", onClick: () => navigate("/jornadas"), variant: "secondary" }]}
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
          {pestaniaActiva === "resumen" && (
            <Card>
              <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                <StatusChip status={jornada.estado} />
                {/* Cambiar estado: "Atras" (reapertura) sigue llamando a cambiarEstado()
                  directamente, sin cambios. "Avanzar", cuando el destino es 'finalizada' (issue
                  #183), YA NO llama a cambiarEstado(): cambia a la pestaña "Cierre", que es la
                  unica dueña de esa transicion (resumen completo + confirmacion explicita, ver
                  el comentario de PESTANIAS). Antes (issue #171) este boton finalizaba
                  directamente, con un aviso aislado de atenciones incompletas.
                  `disabled={moviendo}` evita un segundo click mientras la llamada esta en curso;
                  por eso este control vive aca y no en PageHeader, cuyo contrato de `actions`
                  (label/onClick/variant) no tiene forma de deshabilitar un boton. */}
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
                    onClick={() =>
                      destino === ESTADOS_JORNADA.FINALIZADA
                        ? setPestaniaActiva("cierre")
                        : cambiarEstado(destino)
                    }
                    loading={moviendo}
                  />
                )}
              </div>
              <dl className="row mb-0">
                <dt className="col-sm-4">{ETIQUETAS.codigo}</dt>
                <dd className="col-sm-8">{jornada.codigo || "—"}</dd>

                <dt className="col-sm-4">{ETIQUETAS.responsable}</dt>
                <dd className="col-sm-8">{nombreDePerfil(jornada.responsable) ?? "—"}</dd>

                <dt className="col-sm-4">{ETIQUETAS.cupoEstimado}</dt>
                <dd className="col-sm-8">{jornada.cupoEstimado ?? "—"}</dd>
              </dl>

              <hr />

              {/* Indicadores del dia (criterio 1): vienen de vista_reporte_impacto (00027), via
                obtenerJornada(). `contadores` llega null cuando RLS no le da SELECT sobre esa
                vista a este rol (medico y voluntario, 00064) -- ver useDetalleJornada.js. Un
                guion en vez de 0 evita afirmar una atencion nula que no se puede confirmar,
                mismo criterio que pacientesAtendidos en la tarjeta del kanban (#178). */}
              <div className="row text-center">
                <div className="col-6 col-md-3 mb-3">
                  <div className="h4 mb-0">{jornada.contadores?.pacientesAtendidos ?? "—"}</div>
                  <div className="small text-muted">Pacientes atendidos</div>
                </div>
                <div className="col-6 col-md-3 mb-3">
                  <div className="h4 mb-0">{jornada.contadores?.consultasRealizadas ?? "—"}</div>
                  <div className="small text-muted">Consultas realizadas</div>
                </div>
                <div className="col-6 col-md-3 mb-3">
                  <div className="h4 mb-0">{jornada.contadores?.tratamientosEntregados ?? "—"}</div>
                  <div className="small text-muted">Tratamientos entregados</div>
                </div>
                <div className="col-6 col-md-3 mb-3">
                  <div className="h4 mb-0">{jornada.contadores?.medicamentosUtilizados ?? "—"}</div>
                  <div className="small text-muted">Medicamentos utilizados</div>
                </div>
              </div>
            </Card>
          )}

          {pestaniaActiva === "equipo" && (
            <>
              {/* Asignar personal (issue #182). El gate es permisos.puedeEditar
                (puedeAdministrarJornadas(rol), jornadas/permisos.js), espejo exacto de las
                politicas de INSERT y UPDATE de jornada_personal (00039:71-78): las dos exigen
                unicamente es_administrador(), sin la excepcion de permiso fino que si tiene la
                tabla jornadas. Guardar/desasignar llama a recargarPersonal(), no a recargar():
                relee solo jornada_personal, sin releer historial ni contadores. */}
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

                <div className="d-flex gap-2">
                  {/* Imprimir (issue #185, criterio 4) se gatea por puedeVerRosterCompleto(rol),
                    no por permisos.puedeEditar: es una accion de lectura, y solo tiene sentido
                    para quien ve el cuadro COMPLETO. Un medico o voluntario que solo ve su propia
                    fila (RLS de jornada_personal, 00039:63-69) no ve este boton -- imprimir un
                    cuadro de una sola fila y pegarlo como si fuera el completo seria peor que no
                    ofrecer el boton. */}
                  {puedeVerEquipoCompleto && (
                    <SecondaryButton title="Imprimir" onClick={() => setAImprimir(true)} />
                  )}
                  {permisos.puedeEditar && (
                    <PrimaryButton
                      title="Asignar personal"
                      onClick={() => setMostrarAsignar(true)}
                    />
                  )}
                </div>
              </div>

              {/* Advertencias de horario (issue #185, criterio 3): el choque de dia completo de
                #182 y el traslape real de horas de esta issue conviven como señales
                independientes -- ver useCuadroTurnos.js. alert-danger para el traslape porque es
                la señal mas fuerte. */}
              {errorAdvertencias && (
                <div className="alert alert-warning" role="alert">
                  No se pudo comprobar si hay traslapes de horario con otras jornadas. Revisa
                  manualmente antes de confiar en que no hay ninguno.
                </div>
              )}
              {!errorAdvertencias &&
                filasConAdvertencia.map((fila) => {
                  const advertencia = advertencias[fila.perfilId];
                  return (
                    <div
                      key={fila.id}
                      className={`alert ${advertencia.traslape ? "alert-danger" : "alert-warning"} py-2`}
                      role="alert"
                    >
                      <strong>{fila.perfil}:</strong>{" "}
                      {[advertencia.traslape, advertencia.choque].filter(Boolean).join(" ")}
                    </div>
                  );
                })}

              <DataList
                columnas={COLUMNAS_PERSONAL_JORNADA}
                datos={filasPersonal}
                vacio="Todavia no hay personal asignado a esta jornada."
                onRowPress={permisos.puedeEditar ? (fila) => setFilaEnEdicion(fila) : undefined}
              />
            </>
          )}

          {pestaniaActiva === "pacientes" && (
            <DataList
              columnas={COLUMNAS_PACIENTES_ATENDIDOS_JORNADA}
              datos={filasPacientes}
              vacio="Todavia no hay pacientes atendidos en esta jornada."
            />
          )}

          {pestaniaActiva === "historial" && (
            <DataList
              columnas={COLUMNAS_HISTORIAL_JORNADA}
              datos={filasHistorial}
              vacio="Esta jornada todavia no tiene cambios de estado registrados."
            />
          )}

          {/* Pestaña "Cierre" (issue #183). Misma pestaña antes y despues de finalizar
              (criterio 5): lo unico que cambia es si mas abajo se ofrece "Confirmar cierre"
              (jornada en curso + permiso), no el contenido -- ver el comentario de PESTANIAS mas
              arriba. Los indicadores NO salen de vista_reporte_impacto (a diferencia de la
              pestaña "Resumen"): salen de useResumenCierreJornada(), que reusa las mismas
              funciones que el panel de la jornada en curso movil (issue #187) -- ver
              resumenCierre.js.

              Visible para los 5 roles (igual que "Resumen"), no solo administrador: quien puede
              tocar "Confirmar cierre" es unicamente permisos.puedeEditar (administrador), pero
              cualquiera que vea el detalle de la jornada puede consultar el resumen. pacientesAtendidos
              y atencionesIncompletas pueden llegar en `null` para junta directiva/socio fundador (sin
              SELECT sobre atenciones/consultas, 00033): se pintan como guion o como un aviso aparte,
              NUNCA como 0 -- un 0 ahi diria "todo completo" cuando en realidad es "no se pudo saber",
              justo lo que esta pantalla existe para evitar (ver resumenCierre.js). Como
              administrador siempre tiene esas dos tablas visibles, quien de verdad puede confirmar el
              cierre nunca ve un guion. */}
          {pestaniaActiva === "cierre" && (
            <Card>
              {cargandoResumenCierre ? (
                <LoadingState />
              ) : (
                <>
                  <div className="row text-center mb-3">
                    <div className="col-6 col-md-4 mb-3">
                      <div className="h4 mb-0">
                        {resumenCierre.indicadores.pacientesAtendidos ?? "—"}
                      </div>
                      <div className="small text-muted">Pacientes atendidos</div>
                    </div>
                    <div className="col-6 col-md-4 mb-3">
                      <div className="h4 mb-0">
                        {resumenCierre.indicadores.consultasRealizadas ?? "—"}
                      </div>
                      <div className="small text-muted">Consultas registradas</div>
                    </div>
                    <div className="col-6 col-md-4 mb-3">
                      <div className="h4 mb-0">
                        {resumenCierre.indicadores.tratamientosEntregados ?? "—"}
                      </div>
                      <div className="small text-muted">Medicamentos entregados</div>
                    </div>
                  </div>

                  {/* Advertencias (criterio 2): informan, nunca deshabilitan "Confirmar cierre"
                      (criterio 8 -- se advierte, no se impide, mismo criterio que el excedente de
                      presupuesto en #303). `atencionesIncompletas` en null (rol sin acceso a datos
                      clinicos) se avisa aparte, con un mensaje distinto: no es lo mismo "no hay
                      atenciones sin consulta" que "no pude verificarlo". */}
                  {resumenCierre.atencionesIncompletas === null && (
                    <div className="alert alert-secondary" role="alert">
                      No se pudo comprobar si hay atenciones sin consulta: tu rol no tiene acceso a
                      esa informacion clinica.
                    </div>
                  )}
                  {resumenCierre.atencionesIncompletas !== null &&
                    resumenCierre.atencionesIncompletas > 0 && (
                      <div className="alert alert-warning" role="alert">
                        {resumenCierre.atencionesIncompletas === 1
                          ? "Hay 1 atencion registrada sin consulta todavia."
                          : `Hay ${resumenCierre.atencionesIncompletas} atenciones registradas sin consulta todavia.`}
                      </div>
                    )}
                  {resumenCierre.movimientosPendientes > 0 && (
                    <div className="alert alert-warning" role="alert">
                      {resumenCierre.movimientosPendientes === 1
                        ? "Hay 1 movimiento de inventario del botiquin de esta jornada pendiente de validar."
                        : `Hay ${resumenCierre.movimientosPendientes} movimientos de inventario del botiquin de esta jornada pendientes de validar.`}
                    </div>
                  )}
                  {!hayAdvertenciasDeCierre &&
                    resumenCierre.atencionesIncompletas !== null &&
                    jornada.estado === ESTADOS_JORNADA.EN_CURSO && (
                      <div className="alert alert-success" role="alert">
                        No hay atenciones sin consulta ni movimientos pendientes de validar.
                      </div>
                    )}

                  {errorCierre && (
                    <div className="alert alert-danger" role="alert">
                      {errorCierre}
                    </div>
                  )}

                  {/* Confirmar cierre (criterio 3): solo con la jornada en curso y el mismo
                      permiso que ya gatea "Avanzar" en la pestaña "Resumen" (permisos.puedeEditar,
                      espejo de puedeAdministrarJornadas()). Finalizada, esta pestaña se queda solo
                      con los numeros de arriba (criterio 5). */}
                  {jornada.estado === ESTADOS_JORNADA.EN_CURSO && permisos.puedeEditar && (
                    <div className="d-flex justify-content-end mt-3">
                      <PrimaryButton
                        title="Confirmar cierre"
                        onClick={confirmarCierre}
                        loading={confirmandoCierre}
                      />
                    </div>
                  )}
                </>
              )}
            </Card>
          )}
        </Tabs>
      )}

      {/* Issue #182. onAsignado llama a recargarPersonal() (useDetalleJornada.js), no a
          recargar(): ver el comentario de la pestaña Equipo mas arriba. */}
      <ModalAsignarPersonal
        visible={mostrarAsignar}
        jornadaId={id}
        jornadaFecha={jornada.fecha}
        personal={jornada.personal}
        onClose={() => setMostrarAsignar(false)}
        onAsignado={recargarPersonal}
      />

      {/* Issue #185. key={filaEnEdicion.id}: useEdicionTurno() precarga sus valores desde `fila`
          una sola vez (mismo criterio que useEdicionUsuario.js, #107), asi que cada fila que se
          edite necesita una instancia nueva del componente. onGuardado/onDesasignado llaman a
          recargarPersonal(), igual que el modal de alta. */}
      {filaEnEdicion && (
        <ModalEdicionTurno
          key={filaEnEdicion.id}
          jornadaId={id}
          fila={filaEnEdicion}
          asignacionesDelDia={asignacionesDelDia}
          onClose={() => setFilaEnEdicion(null)}
          onGuardado={() => {
            setFilaEnEdicion(null);
            recargarPersonal();
          }}
          onDesasignado={() => {
            setFilaEnEdicion(null);
            recargarPersonal();
          }}
        />
      )}

      {aImprimir && <CuadroTurnosImprimible jornada={jornada} />}
    </ScreenContainer>
  );
}
