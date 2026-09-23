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
  formatearMoneda,
  permisosDeOrigenDePresupuesto,
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
  StatCard,
  StatusChip,
  Tabs,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import CuadroTurnosImprimible from "./CuadroTurnosImprimible";
import ModalAsignarPersonal from "./ModalAsignarPersonal";
import ModalEdicionTurno from "./ModalEdicionTurno";
import ModalJornada from "./ModalJornada";
import NotFoundPage from "./NotFoundPage";
import OrigenesDePresupuesto from "./OrigenesDePresupuesto";

const PESTANIAS = [
  { id: "resumen", label: "Resumen" },
  { id: "equipo", label: "Equipo" },
  { id: "pacientes", label: "Pacientes atendidos" },
  { id: "historial", label: "Historial" },
  { id: "presupuesto", label: "Presupuesto" },
  { id: "cierre", label: "Cierre" },
];

/** Etiquetas de COLUMNAS_JORNADA */
const ETIQUETAS = Object.fromEntries(
  COLUMNAS_JORNADA.map((columna) => [columna.id, columna.label]),
);

/** Convierte cadenas de texto a formato con Mayúscula Inicial (Title Case) */
function capitalizar(texto) {
  if (!texto) return "—";
  return texto
    .toString()
    .split(" ")
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase())
    .join(" ");
}

/** Nombre completo de un perfil embebido ({ nombres, apellidos }), o `null` si no llegó */
function nombreDePerfil(perfil) {
  const nombre = [perfil?.nombres, perfil?.apellidos].filter(Boolean).join(" ").trim();
  return nombre || null;
}

/** Los indicadores del día de la jornada */
const INDICADORES_DEL_DIA = [
  { clave: "pacientesAtendidos", etiqueta: "Pacientes atendidos" },
  { clave: "consultasRealizadas", etiqueta: "Consultas realizadas" },
  { clave: "tratamientosEntregados", etiqueta: "Tratamientos entregados" },
  { clave: "medicamentosUtilizados", etiqueta: "Medicamentos utilizados" },
];

/** Los indicadores resumidos en la pestaña de cierre */
const INDICADORES_DEL_CIERRE = [
  { clave: "pacientesAtendidos", etiqueta: "Pacientes atendidos" },
  { clave: "consultasRealizadas", etiqueta: "Consultas registradas" },
  { clave: "tratamientosEntregados", etiqueta: "Medicamentos entregados" },
];

/** Componente auxiliar para datos de ficha */
function Dato({ etiqueta, valor, mono = false }) {
  const vacio = valor === null || valor === undefined || valor === "";
  return (
    <div>
      <dt className="ec-rotulo">{etiqueta}</dt>
      <dd className={mono && !vacio ? "mb-0 ec-mono" : "mb-0"}>{vacio ? "—" : valor}</dd>
    </div>
  );
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

  const permisosPresupuesto = permisosDeOrigenDePresupuesto(rol);

  const { advertencias, asignacionesDelDia, errorAdvertencias } = useCuadroTurnos({
    jornadaId: id,
    jornadaFecha: jornada?.fecha,
    personal: jornada?.personal,
  });

  const {
    resumen: resumenCierre,
    cargando: cargandoResumenCierre,
    hayAdvertencias: hayAdvertenciasDeCierre,
    confirmarCierre,
    confirmando: confirmandoCierre,
    errorCierre,
  } = useResumenCierreJornada({ jornada, rol, onCerrada: recargar });

  const [pestaniaActiva, setPestaniaActiva] = useState("resumen");
  const [mostrarAsignar, setMostrarAsignar] = useState(false);
  const [filaEnEdicion, setFilaEnEdicion] = useState(null);
  const [aImprimir, setAImprimir] = useState(false);
  const [editandoJornada, setEditandoJornada] = useState(false);

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

  if (cargando && !jornada) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (error && !jornada) {
    return (
      <ScreenContainer>
        <PageHeader
          title="Detalle de la jornada"
          actions={[
            {
              label: "Volver",
              onClick: () => navigate("/jornadas"),
              variant: "neutra",
            },
          ]}
        />
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  if (!jornada) {
    return <NotFoundPage />;
  }

  const esReapertura = jornada.estado === ESTADOS_JORNADA.FINALIZADA;
  const [destino] = destinos;
  const puedeMover =
    (esReapertura ? permisos.puedeReabrir : permisos.puedeEditar) && Boolean(destino);

  const pestaniasVisibles = PESTANIAS.filter((pestania) => {
    if (pestania.id === "pacientes") return permisos.puedeVerDatosClinicos;
    if (pestania.id === "historial") return permisos.puedeVerHistorial;
    if (pestania.id === "presupuesto") return permisosPresupuesto.puedeVer;
    // ISSUE #864: "Cierre" no tenia filtro, asi que la veia cualquier rol que llegara al
    // detalle. Finalizar una jornada es puedeAdministrarJornadas() -- solo la administradora --,
    // y la pestaña es justo la que finaliza (useResumenCierreJornada, issue #183).
    if (pestania.id === "cierre") return permisos.puedeEditar;
    return true;
  });

  const puedeVerEquipoCompleto = puedeVerRosterCompleto(rol);
  const conteoPorRol = contarPersonalPorRol(jornada.personal);

  // Mapeo del personal aplicando capitalización al rol en la jornada
  const filasPersonal = (jornada.personal ?? []).map((fila) => ({
    id: fila.id,
    perfilId: fila.perfilId,
    perfil: nombreDePerfil(fila.perfil) ?? "—",
    rolEnJornada: capitalizar(fila.rolEnJornada),
    horaInicio: fila.horaInicio,
    horaFin: fila.horaFin,
    responsabilidad: fila.responsabilidad,
    asistio: fila.asistio,
  }));

  const filasConAdvertencia = filasPersonal.filter((fila) => {
    const advertencia = advertencias[fila.perfilId];
    return Boolean(advertencia?.choque || advertencia?.traslape);
  });

  const filasPacientes = pacientesAtendidos.map((fila) => ({
    id: fila.consultaId,
    paciente: fila.paciente,
    diagnosticoPrincipal: fila.diagnosticoPrincipal?.nombre ?? null,
  }));

  // Mapeo del historial aplicando capitalización a los estados
  const filasHistorial = historial.map((fila) => ({
    id: fila.id,
    estadoAnterior: capitalizar(fila.estadoAnterior),
    estadoNuevo: capitalizar(fila.estadoNuevo),
    cambiadoPor: nombreDePerfil(fila.cambiadoPor) ?? "Sistema",
    cuando: formatearFechaConHora(fila.createdAt),
  }));

  return (
    <ScreenContainer>
      <PageHeader
        title={jornada.nombre}
        subtitle={`${formatearFechaCorta(jornada.fecha)} · ${jornada.comunidad?.nombre ?? "—"}`}
        actions={[
          {
            label: "Volver",
            onClick: () => navigate("/jornadas"),
            variant: "neutra",
          },
        ]}
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

      {cargando ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error.mensaje} onRetry={recargar} />
      ) : (
        <Tabs tabs={pestaniasVisibles} activo={pestaniaActiva} onChange={setPestaniaActiva}>
          {pestaniaActiva === "resumen" && (
            <Card>
              <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                <StatusChip status={capitalizar(jornada.estado)} />
                {puedeMover && esReapertura && (
                  <SecondaryButton
                    title="← Atrás"
                    onClick={() => cambiarEstado(destino)}
                    disabled={moviendo}
                  />
                )}
                <div className="d-flex gap-2">
                  {permisos.puedeEditar && (
                    <SecondaryButton
                      title="Editar jornada"
                      onClick={() => setEditandoJornada(true)}
                      disabled={moviendo}
                    />
                  )}
                  {puedeMover && !esReapertura && destino !== ESTADOS_JORNADA.FINALIZADA && (
                    <PrimaryButton
                      title={destino === ESTADOS_JORNADA.EN_CURSO ? "Iniciar jornada" : "Avanzar →"}
                      onClick={() => cambiarEstado(destino)}
                      loading={moviendo}
                    />
                  )}
                </div>
              </div>

              <dl className="ec-ficha-datos">
                <Dato etiqueta={ETIQUETAS.codigo} valor={jornada.codigo} mono />
                <Dato
                  etiqueta={ETIQUETAS.responsable}
                  valor={nombreDePerfil(jornada.responsable)}
                />
                <Dato etiqueta={ETIQUETAS.cupoEstimado} valor={jornada.cupoEstimado} />
                <Dato etiqueta={ETIQUETAS.botiquinBodega} valor={jornada.botiquinBodega?.nombre} />
                <Dato
                  etiqueta={ETIQUETAS.fechaInicioReal}
                  valor={jornada.fechaInicioReal && formatearFechaConHora(jornada.fechaInicioReal)}
                />
                <Dato
                  etiqueta={ETIQUETAS.fechaFinReal}
                  valor={jornada.fechaFinReal && formatearFechaConHora(jornada.fechaFinReal)}
                />
                <div>
                  <dt className="ec-rotulo">Presupuesto asignado</dt>
                  <dd className="mb-0 d-flex flex-wrap align-items-center gap-2">
                    {formatearMoneda(jornada.presupuestoAsignado) ?? "—"}
                    {permisosPresupuesto.puedeVer && (
                      <SecondaryButton
                        title="Ver de dónde viene"
                        size="sm"
                        onClick={() => setPestaniaActiva("presupuesto")}
                      />
                    )}
                  </dd>
                </div>
              </dl>
            </Card>
          )}

          {pestaniaActiva === "resumen" && (
            <div className="ec-kpis mt-3">
              {INDICADORES_DEL_DIA.map(({ clave, etiqueta }) => (
                <StatCard
                  key={clave}
                  label={etiqueta}
                  value={jornada.contadores?.[clave] ?? "—"}
                  accent="var(--accent-jornadas)"
                />
              ))}
            </div>
          )}

          {pestaniaActiva === "equipo" && (
            <>
              <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                {puedeVerEquipoCompleto ? (
                  <div className="d-flex flex-wrap gap-2">
                    {conteoPorRol.length === 0 ? (
                      <span className="text-muted small">Todavía no hay personal asignado.</span>
                    ) : (
                      conteoPorRol.map((fila) => (
                        <span key={fila.rol} className="badge text-bg-light border">
                          {capitalizar(fila.etiqueta)}: {fila.cantidad}
                        </span>
                      ))
                    )}
                  </div>
                ) : (
                  <span className="text-muted small">
                    Esta vista solo muestra tu propia asignación.
                  </span>
                )}

                <div className="d-flex gap-2">
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

              {errorAdvertencias && (
                <div className="alert alert-warning" role="alert">
                  No se pudo comprobar si hay traslapes de horario con otras jornadas.
                </div>
              )}
              {!errorAdvertencias &&
                filasConAdvertencia.map((fila) => {
                  const advertencia = advertencias[fila.perfilId];
                  return (
                    <div
                      key={fila.id}
                      className={`alert ${
                        advertencia.traslape ? "alert-danger" : "alert-warning"
                      } py-2`}
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
                vacio="Todavía no hay personal asignado a esta jornada."
                onRowPress={permisos.puedeEditar ? (fila) => setFilaEnEdicion(fila) : undefined}
              />
            </>
          )}

          {pestaniaActiva === "pacientes" && (
            <DataList
              columnas={COLUMNAS_PACIENTES_ATENDIDOS_JORNADA}
              datos={filasPacientes}
              vacio="Todavía no hay pacientes atendidos en esta jornada."
            />
          )}

          {pestaniaActiva === "historial" && (
            <DataList
              columnas={COLUMNAS_HISTORIAL_JORNADA}
              datos={filasHistorial}
              vacio="Esta jornada todavía no tiene cambios de estado registrados."
            />
          )}

          {pestaniaActiva === "presupuesto" && (
            <OrigenesDePresupuesto
              jornadaId={jornada.id}
              proyectoId={jornada.proyectoId}
              rol={rol}
              alCambiar={recargar}
            />
          )}

          {pestaniaActiva === "cierre" && (
            <Card>
              {cargandoResumenCierre ? (
                <LoadingState />
              ) : (
                <>
                  <div className="ec-kpis mb-3">
                    {INDICADORES_DEL_CIERRE.map(({ clave, etiqueta }) => (
                      <StatCard
                        key={clave}
                        label={etiqueta}
                        value={resumenCierre.indicadores?.[clave] ?? "—"}
                        accent="var(--accent-jornadas)"
                      />
                    ))}
                  </div>

                  {resumenCierre.atencionesIncompletas === null && (
                    <div className="alert alert-secondary" role="alert">
                      No se pudo comprobar si hay atenciones sin consulta: tu rol no tiene acceso a
                      esa información clínica.
                    </div>
                  )}
                  {resumenCierre.atencionesIncompletas !== null &&
                    resumenCierre.atencionesIncompletas > 0 && (
                      <div className="alert alert-warning" role="alert">
                        {resumenCierre.atencionesIncompletas === 1
                          ? "Hay 1 atención registrada sin consulta todavía."
                          : `Hay ${resumenCierre.atencionesIncompletas} atenciones registradas sin consulta todavía.`}
                      </div>
                    )}
                  {resumenCierre.movimientosPendientes > 0 && (
                    <div className="alert alert-warning" role="alert">
                      {resumenCierre.movimientosPendientes === 1
                        ? "Hay 1 movimiento de inventario del botiquín de esta jornada pendiente de validar."
                        : `Hay ${resumenCierre.movimientosPendientes} movimientos de inventario del botiquín de esta jornada pendientes de validar.`}
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

      <ModalAsignarPersonal
        visible={mostrarAsignar}
        jornadaId={id}
        jornadaFecha={jornada.fecha}
        personal={jornada.personal}
        onClose={() => setMostrarAsignar(false)}
        onAsignado={recargarPersonal}
      />

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

      {editandoJornada && (
        <ModalJornada
          visible
          jornada={jornada}
          rol={rol}
          onClose={() => setEditandoJornada(false)}
          onGuardado={() => {
            setEditandoJornada(false);
            recargar();
          }}
        />
      )}

      {aImprimir && <CuadroTurnosImprimible jornada={jornada} />}
    </ScreenContainer>
  );
}
