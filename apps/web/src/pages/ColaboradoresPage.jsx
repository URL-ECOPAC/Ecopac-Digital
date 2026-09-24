import { useEffect, useState } from "react";
import { Badge } from "react-bootstrap";
import { labels, typography } from "@ecopac/ui-tokens";
import {
  CAMPOS_FICHA_COLABORADOR,
  ETIQUETAS_ESTADO_JORNADA,
  filasDeHistorial,
  FILTROS_USUARIO,
  formatearFechaCorta,
  permisosDeUsuarios,
  PESTANIA_FICHA_COLABORADOR_POR_DEFECTO,
  PESTANIAS_FICHA_COLABORADOR,
  TIPOS_DE_FILTRO,
  TIPOS_DE_PRESENTACION,
  useHistorialDePersona,
  useUsuariosListado,
} from "@ecopac/shared";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import SecondaryButton from "../components/SecondaryButton";
import StatusChip from "../components/StatusChip";
import Tabs from "../components/Tabs";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalAltaUsuario from "./ModalAltaUsuario";
import ModalEdicionUsuario from "./ModalEdicionUsuario";
import ModalPermisosUsuario from "./ModalPermisosUsuario";

export default function ColaboradoresPage() {
  const { rol, perfil: perfilDeSesion } = useSesionCompartida();
  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [avisoAlta, setAvisoAlta] = useState(null);
  const [seleccionadoId, setSeleccionadoId] = useState(null);
  const {
    filas,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros,
    cargando,
    error,
    recargar,
    pagina,
    paginas,
    total,
    hayPaginaAnterior,
    hayPaginaSiguiente,
    irAPaginaAnterior,
    irAPaginaSiguiente,
    catalogos,
  } = useUsuariosListado({ rol });

  useEffect(() => {
    setSeleccionadoId(null);
  }, [filtros, pagina]);

  const permisos = permisosDeUsuarios(rol);
  const puedeCrear = permisos.puedeCrearUsuario ?? permisos.puedeCrear ?? false;
  const filaSeleccionada = filas.find((fila) => fila.id === seleccionadoId) ?? null;

  if (error) {
    return (
      <ScreenContainer>
        <PageHeader title="Colaboradores" />
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <style>{`
        .fila-colaborador {
          border-color: var(--color-border) !important;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .fila-colaborador.seleccionada,
        .fila-colaborador:focus-visible {
          border-color: var(--color-primary) !important;
          box-shadow: 0 0 0 1px var(--color-primary);
        }
        .pildora-filtro {
          transition: background-color .15s ease, border-color .15s ease;
        }
        .lista-colaboradores {
          flex: 1 1 380px;
          max-width: 420px;
          min-width: 340px;
        }
        .panel-detalle {
          flex: 1 1 640px;
          max-width: 960px;
          min-width: 0;
          align-self: flex-start;
          position: sticky;
          top: 16px;
        }
        .panel-detalle-contenido {
          animation: aparecer-panel .15s ease;
        }
        @keyframes aparecer-panel {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .panel-detalle-contenido { animation: none; }
        }
        @media (max-width: 900px) {
          .contenedor-colaboradores { flex-direction: column; }
          .lista-colaboradores { flex: 1 1 auto; max-width: 100%; min-width: 0; }
          .panel-detalle { flex: 1 1 auto; max-width: 100%; position: static; }
        }
      `}</style>

      {avisoAlta && (
        <div
          className={`alert alert-dismissible ${
            avisoAlta.tono === "exito" ? "alert-success" : "alert-warning"
          }`}
          role="alert"
        >
          {avisoAlta.mensaje}
          <button
            type="button"
            className="btn-close"
            aria-label="Cerrar"
            onClick={() => setAvisoAlta(null)}
          />
        </div>
      )}

      <PageHeader
        title="Colaboradores"
        actions={
          puedeCrear ? [{ label: "Nuevo colaborador", onClick: () => setMostrarAlta(true) }] : []
        }
      />

      <BarraDeFiltros
        campos={FILTROS_USUARIO}
        valores={filtros}
        onChange={setFiltro}
        catalogos={catalogos}
        onLimpiar={limpiarFiltros}
        hayFiltros={hayFiltros}
      />

      <div
        className="text-uppercase fw-semibold mb-3"
        style={{
          fontSize: typography.sizes.xs,
          letterSpacing: "0.08em",
          color: "var(--color-text-muted)",
        }}
      >
        {total === 1 ? "1 persona encontrada" : `${total} personas encontradas`}
      </div>

      <div className="contenedor-colaboradores d-flex gap-3 align-items-start">
        <div className="lista-colaboradores">
          {cargando ? (
            <LoadingState />
          ) : filas.length === 0 ? (
            <EmptyState
              message="No hay personal que coincida con los filtros."
              actionLabel={hayFiltros ? "Limpiar filtros" : undefined}
              onAction={hayFiltros ? limpiarFiltros : undefined}
            />
          ) : (
            <div className="d-flex flex-column gap-2">
              {filas.map((fila) => (
                <FilaColaborador
                  key={fila.id}
                  fila={fila}
                  catalogos={catalogos}
                  seleccionada={seleccionadoId === fila.id}
                  onClick={() => setSeleccionadoId(fila.id)}
                />
              ))}
            </div>
          )}

          {paginas > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <SecondaryButton
                title="Anterior"
                onClick={irAPaginaAnterior}
                disabled={!hayPaginaAnterior}
              />
              <span style={{ color: "var(--color-text-muted)" }}>
                Página {pagina} de {paginas}
              </span>
              <SecondaryButton
                title="Siguiente"
                onClick={irAPaginaSiguiente}
                disabled={!hayPaginaSiguiente}
              />
            </div>
          )}
        </div>

        <div className="panel-detalle">
          {!filaSeleccionada ? (
            <div
              className="bg-white rounded-3 border d-flex align-items-center justify-content-center text-center p-5"
              style={{ minHeight: "560px" }}
            >
              <p
                className="mb-0"
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: typography.sizes.lg,
                  maxWidth: "480px",
                }}
              >
                Selecciona un colaborador para ver su ficha completa e historial de jornadas.
              </p>
            </div>
          ) : (
            <PanelDetalleColaborador
              key={filaSeleccionada.id}
              fila={filaSeleccionada}
              catalogos={catalogos}
              permisos={permisos}
              rol={rol}
              idSesionActual={perfilDeSesion?.id}
              onCambio={recargar}
            />
          )}
        </div>
      </div>

      <ModalAltaUsuario
        visible={mostrarAlta}
        onClose={() => setMostrarAlta(false)}
        onUsuarioCreado={(_usuario, aviso) => {
          setAvisoAlta(aviso ?? null);
          recargar();
        }}
      />
    </ScreenContainer>
  );
}

function IconoLupa() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ color: "var(--color-text-muted)" }}
    >
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
      <line
        x1="11"
        y1="11"
        x2="14.5"
        y2="14.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EtiquetaDeFiltro({ children }) {
  return (
    <div
      className="text-uppercase fw-semibold mb-2"
      style={{
        fontSize: typography.sizes.xs,
        letterSpacing: "0.06em",
        color: "var(--color-text-muted)",
      }}
    >
      {children}
    </div>
  );
}

function PildoraFiltro({ label, active, onClick }) {
  return (
    <button
      type="button"
      className="pildora-filtro btn btn-sm rounded-pill"
      onClick={onClick}
      style={{
        backgroundColor: active
          ? "color-mix(in srgb, var(--color-primary) 12%, var(--color-surface))"
          : "var(--color-surface)",
        borderColor: active ? "var(--color-primary)" : "var(--color-border)",
        borderWidth: "1px",
        borderStyle: "solid",
        color: active ? "var(--color-primary)" : "var(--color-text)",
        fontWeight: active ? typography.weights.semibold : typography.weights.regular,
      }}
    >
      {label}
    </button>
  );
}

function BarraDeFiltros({
  campos = [],
  valores = {},
  onChange,
  catalogos = {},
  onLimpiar,
  hayFiltros = true,
}) {
  const campoBusqueda = campos.find((campo) => campo.tipo === TIPOS_DE_FILTRO.BUSQUEDA);
  const camposDeSeleccion = campos.filter((campo) => campo.tipo === TIPOS_DE_FILTRO.SELECT);

  return (
    <div className="mb-4">
      {campoBusqueda && (
        <div className="position-relative mb-3" style={{ maxWidth: "360px" }}>
          <span
            className="position-absolute top-50 translate-middle-y"
            style={{ left: "12px", pointerEvents: "none" }}
          >
            <IconoLupa />
          </span>
          <input
            type="search"
            className="form-control"
            style={{ paddingLeft: "36px" }}
            placeholder={campoBusqueda.placeholder}
            aria-label={campoBusqueda.label}
            value={valores[campoBusqueda.id] ?? ""}
            onChange={(evento) => onChange(campoBusqueda.id, evento.target.value)}
          />
        </div>
      )}

      <div className="d-flex flex-wrap align-items-end gap-4">
        {camposDeSeleccion.map((campo) => {
          const opciones = campo.opciones ?? catalogos[campo.opcionesDesde] ?? [];
          const valor = valores[campo.id];
          const sinElegir = valor === null || valor === undefined || valor === "";

          return (
            <div key={campo.id}>
              <EtiquetaDeFiltro>Filtrar por {campo.label.toLowerCase()}</EtiquetaDeFiltro>
              <div className="d-flex flex-wrap gap-2">
                <PildoraFiltro
                  label="Todos"
                  active={sinElegir}
                  onClick={() => onChange(campo.id, null)}
                />
                {opciones.map((opcion) => (
                  <PildoraFiltro
                    key={String(opcion.value)}
                    label={opcion.label}
                    active={valor === opcion.value}
                    onClick={() => onChange(campo.id, opcion.value)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {onLimpiar && (
          <div className="ec-filtros-limpiar">
            <SecondaryButton
              title="Limpiar filtros"
              variant="neutra"
              onClick={onLimpiar}
              disabled={!hayFiltros}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function iniciales(texto) {
  return String(texto ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra[0] ?? "")
    .join("")
    .toUpperCase();
}

function Avatar({ texto, activo, tamano = 40 }) {
  return (
    <span
      className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
      style={{
        width: `${tamano}px`,
        height: `${tamano}px`,
        backgroundColor: activo ? "var(--color-primary)" : "var(--color-secondary)",
        color: "var(--color-surface)",
        fontSize: `${Math.round(tamano * 0.4)}px`,
        fontWeight: typography.weights.semibold,
        opacity: activo ? 1 : 0.6,
      }}
      aria-hidden="true"
    >
      {iniciales(texto)}
    </span>
  );
}

function PastillaRol({ texto }) {
  return (
    <span
      className="badge rounded-pill"
      style={{ backgroundColor: "var(--color-border)", color: "var(--color-text)" }}
    >
      {texto}
    </span>
  );
}

function EtiquetaDeCampo({ children }) {
  return (
    <div
      className="text-uppercase"
      style={{
        fontSize: typography.sizes.xs,
        letterSpacing: "0.06em",
        color: "var(--color-text-muted)",
        marginBottom: "4px",
      }}
    >
      {children}
    </div>
  );
}

function etiquetaDe(catalogo, valor) {
  const opcion = (catalogo ?? []).find((entrada) => entrada.value === valor);
  return opcion?.label ?? valor;
}

function valorDeCampo(campo, valores, catalogos) {
  const valor = valores[campo.desde ?? campo.id];

  if (campo.tipo === TIPOS_DE_PRESENTACION.ESTADO) {
    const opcion = (catalogos[campo.etiquetasDesde] ?? []).find(
      (entrada) => entrada.value === valor,
    );
    return <StatusChip status={opcion?.clave ?? valor} label={opcion?.label} />;
  }

  if (campo.tipo === TIPOS_DE_PRESENTACION.CHIPS) {
    const elementos = Array.isArray(valor) ? valor : [];
    if (elementos.length === 0) return "—";
    return (
      <span className="d-inline-flex flex-wrap gap-1">
        {elementos.map((elemento) => (
          <Badge key={String(elemento)} bg="light" text="dark">
            {elemento}
          </Badge>
        ))}
      </span>
    );
  }

  if (campo.etiquetasDesde) {
    return valor === null || valor === undefined
      ? "—"
      : etiquetaDe(catalogos[campo.etiquetasDesde], valor);
  }

  if (campo.tipo === TIPOS_DE_PRESENTACION.FECHA) {
    return valor ? formatearFechaCorta(valor) : "—";
  }

  return valor === null || valor === undefined || valor === "" ? "—" : valor;
}

function colorDeEstado(estado) {
  return `var(--estado-${String(estado).replace(/ /g, "-")}, var(--color-secondary))`;
}

function FilaColaborador({ fila, catalogos, seleccionada, onClick }) {
  const rolLabel = etiquetaDe(catalogos.roles, fila.rol);
  const especialidad =
    Array.isArray(fila.especialidades) && fila.especialidades.length > 0
      ? fila.especialidades.join(", ")
      : "Sin especialidad";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={seleccionada}
      className={`fila-colaborador d-flex flex-column gap-2 w-100 p-3 border-0 bg-white rounded-3 border text-start${
        seleccionada ? " seleccionada" : ""
      }`}
      style={{ cursor: "pointer" }}
    >
      <span className="d-flex align-items-center gap-3">
        <Avatar texto={fila.nombreCompleto} activo={fila.activo} />
        <span className="flex-grow-1" style={{ minWidth: 0 }}>
          <span className="fw-bold text-truncate d-block">
            {fila.nombreCompleto || "Sin nombre"}
          </span>
          <span
            className="text-truncate d-block"
            style={{ fontSize: typography.sizes.xs, color: "var(--color-text-muted)" }}
          >
            {especialidad}
          </span>
        </span>
      </span>
      <span className="d-flex align-items-center flex-wrap gap-2" style={{ paddingLeft: "52px" }}>
        <PastillaRol texto={rolLabel} />
        {!fila.activo && <StatusChip status="inactivo" label={labels.usuarioInactivo} />}
        <span
          className="ms-auto"
          style={{ fontSize: typography.sizes.xs, color: "var(--color-text-muted)" }}
        >
          {fila.jornadas} {fila.jornadas === 1 ? "jornada" : "jornadas"}
        </span>
      </span>
    </button>
  );
}

function PanelDetalleColaborador({ fila, catalogos, permisos, rol, idSesionActual, onCambio }) {
  const [pestaniaActiva, setPestaniaActiva] = useState(PESTANIA_FICHA_COLABORADOR_POR_DEFECTO);
  const [editando, setEditando] = useState(false);
  const [gestionandoPermisos, setGestionandoPermisos] = useState(false);
  const {
    historial,
    cargando: cargandoHistorial,
    error: errorHistorial,
    recargar: recargarHistorial,
  } = useHistorialDePersona(fila.id);

  const rolLabel = etiquetaDe(catalogos.roles, fila.rol);
  const especialidad =
    Array.isArray(fila.especialidades) && fila.especialidades.length > 0
      ? fila.especialidades.join(", ")
      : "Sin especialidad";
  const filasHistorial = filasDeHistorial(historial);

  return (
    <div className="panel-detalle-contenido bg-white rounded-3 border" style={{ padding: "2rem" }}>
      <div className="d-flex align-items-center gap-3 mb-2">
        <Avatar texto={fila.nombreCompleto} activo={fila.activo} tamano={112} />
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="fw-bold text-truncate" style={{ fontSize: typography.sizes.lg }}>
            {fila.nombreCompleto || "Sin nombre"}
          </div>
          <div
            className="text-truncate"
            style={{ fontSize: typography.sizes.xs, color: "var(--color-text-muted)" }}
          >
            {especialidad}
          </div>
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <PastillaRol texto={rolLabel} />
        <StatusChip
          status={fila.activo ? "activo" : "inactivo"}
          label={fila.activo ? labels.usuarioActivo : labels.usuarioInactivo}
        />
      </div>

      {(permisos.puedeEditarOtro || permisos.puedeGestionarPermisosFinos) && (
        <div className="d-flex gap-2 mb-3">
          {permisos.puedeEditarOtro && (
            <SecondaryButton title="Editar" onClick={() => setEditando(true)} />
          )}
          {permisos.puedeGestionarPermisosFinos && (
            <SecondaryButton title="Permisos" onClick={() => setGestionandoPermisos(true)} />
          )}
        </div>
      )}

      <Tabs tabs={PESTANIAS_FICHA_COLABORADOR} activo={pestaniaActiva} onChange={setPestaniaActiva}>
        {pestaniaActiva === "datos" && (
          <>
            <div className="row g-4 mb-4">
              {CAMPOS_FICHA_COLABORADOR.map((campo) => (
                <div className="col-12 col-sm-6" key={campo.id}>
                  <EtiquetaDeCampo>{campo.label}</EtiquetaDeCampo>
                  <div className="fw-bold">{valorDeCampo(campo, fila, catalogos)}</div>
                </div>
              ))}
            </div>
            <div
              className="rounded-3"
              style={{
                padding: "1.5rem",
                backgroundColor: "var(--color-background)",
                borderLeft: "6px solid var(--color-primary)",
              }}
            >
              <EtiquetaDeCampo>Notas</EtiquetaDeCampo>
              <p className="mb-0" style={{ fontSize: typography.sizes.sm }}>
                {fila.notas || "—"}
              </p>
            </div>
          </>
        )}

        {pestaniaActiva === "historial" &&
          (errorHistorial ? (
            <ErrorState message={errorHistorial.mensaje} onRetry={recargarHistorial} />
          ) : cargandoHistorial ? (
            <LoadingState />
          ) : (
            <div>
              <div className="d-flex align-items-center gap-2 mb-3">
                <span className="fw-bold">Historial de jornadas</span>
                <span
                  className="badge rounded-pill"
                  style={{ backgroundColor: "var(--color-border)", color: "var(--color-text)" }}
                >
                  {filasHistorial.length}{" "}
                  {filasHistorial.length === 1 ? "participación" : "participaciones"}
                </span>
              </div>

              {filasHistorial.length === 0 ? (
                <EmptyState message="Esta persona todavía no participó en ninguna jornada." />
              ) : (
                <div className="d-flex flex-column gap-2">
                  {filasHistorial.map((jornada) => (
                    <div
                      key={jornada.id}
                      className="d-flex align-items-center gap-3 p-3 rounded-3 border"
                      style={{ backgroundColor: "var(--color-background)" }}
                    >
                      <span
                        className="rounded-circle flex-shrink-0"
                        style={{
                          width: "10px",
                          height: "10px",
                          backgroundColor: colorDeEstado(jornada.estado),
                        }}
                        aria-hidden="true"
                      />
                      <div className="flex-grow-1" style={{ minWidth: 0 }}>
                        <div className="fw-bold text-truncate">{jornada.nombre}</div>
                        <div
                          className="text-truncate"
                          style={{
                            fontSize: typography.sizes.xs,
                            color: "var(--color-text-muted)",
                          }}
                        >
                          {formatearFechaCorta(jornada.fecha)}
                          {jornada.responsabilidad !== "—" ? ` · ${jornada.responsabilidad}` : ""}
                        </div>
                      </div>
                      {/*  AQUÍ ESTÁ EL CAMBIO — etiqueta en mayúsculas */}
                      <StatusChip
                        status={jornada.estado}
                        label={
                          ETIQUETAS_ESTADO_JORNADA[jornada.estado]
                            ? String(ETIQUETAS_ESTADO_JORNADA[jornada.estado]).toUpperCase()
                            : String(jornada.estado).toUpperCase()
                        }
                        uppercase
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
      </Tabs>

      {editando && (
        <ModalEdicionUsuario
          perfil={fila}
          rol={rol}
          idSesionActual={idSesionActual}
          onClose={() => setEditando(false)}
          onGuardado={() => {
            setEditando(false);
            onCambio();
          }}
          onEspecialidadesGuardadas={onCambio}
        />
      )}

      {gestionandoPermisos && (
        <ModalPermisosUsuario perfil={fila} onClose={() => setGestionandoPermisos(false)} />
      )}
    </div>
  );
}