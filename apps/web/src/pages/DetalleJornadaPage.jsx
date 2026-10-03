import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  COLUMNAS_HISTORIAL_JORNADA,
  COLUMNAS_JORNADA,
  COLUMNAS_PACIENTES_ATENDIDOS_JORNADA,
  COLUMNAS_PERSONAL_JORNADA,
  contarPersonalPorRol,
  equipoDeJornada,
  ESTADOS_JORNADA,
  formatearFechaConHora,
  formatearFechaCorta,
  formatearMoneda,
  permisosDeOrigenDePresupuesto,
  puedeVerModulo,
  puedeVerReporteJornada,
  puedeVerRosterCompleto,
  puedeVerTodosLosGastos,
  seccionesDeDetalleJornada,
  mayusculaInicial,
  puedeVerInsumosDeJornada,
  jornadaUsaBodegaPrincipal,
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
import BotonImprimir from "../components/BotonImprimir";
import { useSesionCompartida } from "../contexto/SesionProvider";
import CuadroTurnosImprimible from "./CuadroTurnosImprimible";
import ModalAsignarPersonal from "./ModalAsignarPersonal";
import ModalEdicionTurno from "./ModalEdicionTurno";
import ModalJornada from "./ModalJornada";
import NotFoundPage from "./NotFoundPage";
import GastosDeJornada from "./GastosDeJornada";
import ConsumoDeJornada from "./ConsumoDeJornada";
import InsumosDeJornada from "./InsumosDeJornada";
import OrigenesDePresupuesto from "./OrigenesDePresupuesto";
import SobranteDeJornada from "./SobranteDeJornada";
import { imprimirCuandoEsteListo } from "../impresion";

const PESTANIAS = [
  { id: "resumen", label: "Resumen" },
  { id: "equipo", label: "Equipo" },
  { id: "pacientes", label: "Pacientes atendidos" },
  { id: "historial", label: "Historial" },
  { id: "presupuesto", label: "Presupuesto" },
  { id: "gastos", label: "Gastos" },
  { id: "insumos", label: "Insumos" },
  { id: "consumo", label: "Consumo" },
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
  const { perfil, rol } = useSesionCompartida();

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
    // Espera al logo: impreso un fotograma despues, el papel salia sin el.
    const cancelarImpresion = imprimirCuandoEsteListo();

    return () => {
      window.removeEventListener("afterprint", limpiar);
      cancelarImpresion();
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

  // Una jornada finalizada se consulta: el detalle no ofrece reabrirla (eso queda en el tablero) y
  // deja a la vista, deshabilitado, lo que la modificaria.
  const jornadaFinalizada = jornada.estado === ESTADOS_JORNADA.FINALIZADA;
  const [destino] = destinos;
  const puedeMover = !jornadaFinalizada && permisos.puedeEditar && Boolean(destino);

  // 00148: el personal de campo solo ve Equipo y Pacientes atendidos (seccionesDeDetalleJornada).
  const seccionesDelRol = seccionesDeDetalleJornada(rol);
  const pestaniasVisibles = PESTANIAS.filter((pestania) => {
    if (!seccionesDelRol.includes(pestania.id)) return false;
    if (pestania.id === "pacientes") return permisos.puedeVerDatosClinicos;
    if (pestania.id === "historial") return permisos.puedeVerHistorial;
    if (pestania.id === "presupuesto") return permisosPresupuesto.puedeVer;
    if (pestania.id === "gastos") return puedeVerTodosLosGastos(rol);
    if (pestania.id === "insumos") return puedeVerInsumosDeJornada(rol);
    if (pestania.id === "consumo") return puedeVerInsumosDeJornada(rol);
    // ISSUE #864: "Cierre" no tenia filtro, asi que la veia cualquier rol que llegara al
    // detalle. Finalizar una jornada es puedeAdministrarJornadas() -- solo la administradora --,
    // y la pestaña es justo la que finaliza (useResumenCierreJornada, issue #183).
    if (pestania.id === "cierre") return permisos.puedeEditar;
    return true;
  });
  // La pestana pedida si el rol la ve; si no -el personal de campo no tiene "Resumen"-, la primera.
  const pestaniaMostrada = pestaniasVisibles.some((pestania) => pestania.id === pestaniaActiva)
    ? pestaniaActiva
    : pestaniasVisibles[0]?.id;

  const puedeVerEquipoCompleto = puedeVerRosterCompleto(rol);
  const conteoPorRol = contarPersonalPorRol(jornada.personal);

  // El equipo es el cuadro de turnos mas el responsable de la jornada (equipoDeJornada). Quien no
  // ve el cuadro completo solo ve su propia asignacion, asi que ahi se queda el cuadro tal cual.
  const equipo = puedeVerEquipoCompleto ? equipoDeJornada(jornada) : (jornada.personal ?? []);

  // Mapeo del personal aplicando capitalización al rol en la jornada
  const filasPersonal = equipo.map((fila) => ({
    id: fila.id,
    perfilId: fila.perfilId,
    perfil: nombreDePerfil(fila.perfil) ?? "—",
    rolEnJornada: fila.rolEnJornada ? capitalizar(fila.rolEnJornada) : null,
    horaInicio: fila.horaInicio,
    horaFin: fila.horaFin,
    responsabilidad: mayusculaInicial(fila.responsabilidad) || null,
    asistio: fila.asistio,
    tieneTurno: fila.tieneTurno !== false,
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
          // ISSUE #862: /reportes/jornada/:id existia como ruta y NINGUN enlace del sistema
          // llevaba a ella -- el reporte se podia abrir solo escribiendo la direccion a mano.
          // Es el mismo defecto que la issue #693 corrigio para /reportes/inventario-actual.
          //
          // Se ofrece solo a quien puede leerlo: puedeVerReporteJornada es el espejo de las
          // politicas de la 00033 sobre consultas y recetas, asi que un rol consultivo veria un
          // enlace que lo lleva a un aviso de permisos.
          // Y solo si llega a Reportes: el reporte vive en esa ruta (00148).
          ...(puedeVerReporteJornada(rol) && puedeVerModulo(rol, "reportes")
            ? [
                {
                  label: "Ver reporte",
                  to: `/reportes/jornada/${jornada.id}`,
                  variant: "secondary",
                },
              ]
            : []),
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
        <Tabs tabs={pestaniasVisibles} activo={pestaniaMostrada} onChange={setPestaniaActiva}>
          {pestaniaMostrada === "resumen" && (
            <Card>
              <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                <StatusChip status={capitalizar(jornada.estado)} />
                <div className="d-flex gap-2">
                  {permisos.puedeEditar && (
                    <SecondaryButton
                      title="Editar jornada"
                      onClick={() => setEditandoJornada(true)}
                      disabled={moviendo || jornadaFinalizada}
                    />
                  )}
                  {puedeMover && destino !== ESTADOS_JORNADA.FINALIZADA && (
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
                <Dato etiqueta={ETIQUETAS.proyecto} valor={jornada.proyecto?.nombre} />
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

          {pestaniaMostrada === "resumen" && (
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

          {pestaniaMostrada === "equipo" && (
            <>
              <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                {puedeVerEquipoCompleto ? (
                  <div className="d-flex flex-wrap gap-2">
                    {conteoPorRol.length === 0 ? (
                      <span className="text-muted small">
                        Todavía no hay personal con turno asignado.
                      </span>
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
                  {puedeVerEquipoCompleto && <BotonImprimir onClick={() => setAImprimir(true)} />}
                  {permisos.puedeEditar && (
                    <PrimaryButton
                      title="Asignar personal"
                      onClick={() => setMostrarAsignar(true)}
                      disabled={jornadaFinalizada}
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
                // El responsable sin turno no tiene turno que editar; una jornada finalizada, ninguno.
                onRowPress={
                  permisos.puedeEditar && !jornadaFinalizada
                    ? (fila) => fila.tieneTurno && setFilaEnEdicion(fila)
                    : undefined
                }
              />
            </>
          )}

          {pestaniaMostrada === "pacientes" && (
            <DataList
              columnas={COLUMNAS_PACIENTES_ATENDIDOS_JORNADA}
              datos={filasPacientes}
              vacio="Todavía no hay pacientes atendidos en esta jornada."
            />
          )}

          {pestaniaMostrada === "historial" && (
            <DataList
              columnas={COLUMNAS_HISTORIAL_JORNADA}
              datos={filasHistorial}
              vacio="Esta jornada todavía no tiene cambios de estado registrados."
            />
          )}

          {pestaniaMostrada === "presupuesto" && (
            <OrigenesDePresupuesto
              jornadaId={jornada.id}
              proyectoId={jornada.proyectoId}
              rol={rol}
              alCambiar={recargar}
              soloConsulta={jornadaFinalizada}
            />
          )}

          {pestaniaMostrada === "gastos" && (
            <GastosDeJornada
              jornadaId={jornada.id}
              rol={rol}
              usuarioId={perfil?.id}
              soloConsulta={jornadaFinalizada}
            />
          )}

          {pestaniaMostrada === "insumos" && (
            <InsumosDeJornada
              jornadaId={jornada.id}
              bodega={
                jornada.botiquinBodegaId
                  ? {
                      id: jornada.botiquinBodegaId,
                      nombre: jornada.botiquinBodega?.nombre ?? "",
                      esPrincipal: jornadaUsaBodegaPrincipal(jornada),
                    }
                  : null
              }
              rol={rol}
              soloConsulta={jornadaFinalizada}
            />
          )}

          {pestaniaMostrada === "consumo" && (
            <ConsumoDeJornada
              jornadaId={jornada.id}
              rol={rol}
              usaBodegaPrincipal={jornadaUsaBodegaPrincipal(jornada)}
            />
          )}

          {pestaniaMostrada === "cierre" && (
            <>
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
                        No se pudo comprobar si hay atenciones sin consulta: tu rol no tiene acceso
                        a esa información clínica.
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
              {/* 00160: con la jornada finalizada, lo que sobro de su presupuesto se devuelve o se
                pasa a otra jornada del proyecto. */}
              <SobranteDeJornada jornada={jornada} rol={rol} alLiquidar={recargar} />
            </>
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
