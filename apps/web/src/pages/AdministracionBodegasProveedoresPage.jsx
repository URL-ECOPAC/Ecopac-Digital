import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ErrorState from "../components/ErrorState";
import {
  esProveedorDeDonante,
  useAdministracionBodegasProveedores,
  TIPO_PROVEEDOR,
} from "@ecopac/shared";
import { Nav } from "react-bootstrap";
import ContenidoDeBodega from "../components/ContenidoDeBodega";
import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import { EnFormulario } from "../components/contextoDeFormulario";
import SectionHeader from "../components/SectionHeader";
import { useCerrarAlTocarFuera } from "../hooks/useCerrarAlTocarFuera";

/** Estilo de los botones de accion de cada fila, el mismo para Editar y Ver contenido. */
const ESTILO_BOTON_DE_FILA = {
  padding: "4px 10px",
  fontSize: "var(--texto-xs)",
  border: "none",
  backgroundColor: "var(--color-border)",
  borderRadius: "6px",
  cursor: "pointer",
};

export default function AdministracionBodegasProveedoresPage() {
  const navigate = useNavigate();
  const [pestañaActiva, setPestañaActiva] = useState("bodegas");
  const [modalBodega, setModalBodega] = useState(null);
  const [modalProveedor, setModalProveedor] = useState(null);

  // Un fallo al guardar se muestra dentro del modal, donde esta el formulario que hay que
  // corregir. Antes era un alert() del navegador: bloqueaba la pantalla, no se podia copiar y
  // desaparecia sin dejar rastro de que fue lo que fallo (issue #762).
  const [errorGuardarBodega, setErrorGuardarBodega] = useState(null);
  const [errorGuardarProveedor, setErrorGuardarProveedor] = useState(null);

  const {
    bodegas,
    cargandoBodegas,
    errorBodegas,
    cargarBodegas,
    guardarBodega,
    existenciaPorBodega,
    contenidoBodega,
    verContenidoBodega,
    cerrarContenidoBodega,
    proveedores,
    cargandoProveedores,
    errorProveedores,
    cargarProveedores,
    guardarProveedor,
  } = useAdministracionBodegasProveedores();

  // Cargar datos al entrar
  useEffect(() => {
    cargarBodegas();
    cargarProveedores();
  }, [cargarBodegas, cargarProveedores]);

  // ──────────────────────────────────────────────
  // FORMULARIO BODEGA
  // ──────────────────────────────────────────────
  // `esMovil` y no `es_movil`: es la clave que devuelve listarBodegas() y la que lee
  // guardarBodega(). Con es_movil la tabla decia "Fija" para todas y la casilla de bodega movil
  // nunca se guardaba.
  const [formBodega, setFormBodega] = useState({
    nombre: "",
    ubicacion: "",
    esMovil: false,
  });

  const abrirNuevaBodega = () => {
    setFormBodega({ nombre: "", ubicacion: "", esMovil: false });
    setErrorGuardarBodega(null);
    setModalBodega({ modo: "crear" });
  };

  const abrirEditarBodega = (b) => {
    setFormBodega({
      id: b.id,
      nombre: b.nombre || "",
      ubicacion: b.ubicacion || "",
      esMovil: Boolean(b.esMovil),
    });
    setErrorGuardarBodega(null);
    setModalBodega({ modo: "editar" });
  };

  // guardarBodega() lanza con un mensaje ya apto para pantalla: o es una validacion propia del
  // hook, o es el `mensaje` que escribio normalizarError(). Nunca es el texto crudo del servidor,
  // que es lo que prohibe la regla 1 de packages/shared/api/errores-de-supabase.js.
  const handleGuardarBodega = async (e) => {
    e.preventDefault();
    setErrorGuardarBodega(null);
    try {
      await guardarBodega(formBodega);
      setModalBodega(null);
    } catch (err) {
      setErrorGuardarBodega(err.message || "No se pudo guardar la bodega.");
    }
  };

  // ──────────────────────────────────────────────
  // FORMULARIO PROVEEDOR
  // ──────────────────────────────────────────────
  const [formProveedor, setFormProveedor] = useState({
    nombre: "",
    contacto: "",
    tipo: TIPO_PROVEEDOR.COMERCIAL,
  });

  const abrirNuevoProveedor = () => {
    setFormProveedor({ nombre: "", contacto: "", tipo: TIPO_PROVEEDOR.COMERCIAL });
    setErrorGuardarProveedor(null);
    setModalProveedor({ modo: "crear" });
  };

  const abrirEditarProveedor = (p) => {
    // El proveedor de un donante se edita en Donantes: la base lo mantiene a partir del donante
    // (00175, issue #911).
    if (esProveedorDeDonante(p)) {
      navigate(`/donantes?editar=${p.donanteId}`);
      return;
    }
    setFormProveedor({
      id: p.id,
      nombre: p.nombre || "",
      contacto: p.contacto || "",
      tipo: p.tipo || TIPO_PROVEEDOR.COMERCIAL,
    });
    setErrorGuardarProveedor(null);
    setModalProveedor({ modo: "editar" });
  };

  const handleGuardarProveedor = async (e) => {
    e.preventDefault();
    setErrorGuardarProveedor(null);
    try {
      await guardarProveedor(formProveedor);
      setModalProveedor(null);
    } catch (err) {
      setErrorGuardarProveedor(err.message || "No se pudo guardar el proveedor.");
    }
  };

  const fondoBodega = useCerrarAlTocarFuera(() => setModalBodega(null), {
    activo: Boolean(modalBodega),
  });
  const fondoProveedor = useCerrarAlTocarFuera(() => setModalProveedor(null), {
    activo: Boolean(modalProveedor),
  });

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Cabecera */}
      <SectionHeader
        title="Administración: bodegas y proveedores"
        subtitle="Configuración de ubicaciones y catálogo de origen de medicamentos"
      />

      {/* Pestañas: las pastillas de .nav-tabs, como en el resto de la aplicacion. */}
      <Nav variant="tabs" activeKey={pestañaActiva} onSelect={(clave) => setPestañaActiva(clave)}>
        {[
          { id: "bodegas", etiqueta: "Bodegas" },
          { id: "proveedores", etiqueta: "Proveedores y donantes" },
        ].map((p) => (
          <Nav.Item key={p.id}>
            <Nav.Link eventKey={p.id}>{p.etiqueta}</Nav.Link>
          </Nav.Item>
        ))}
      </Nav>

      {/* ═══════════ BODEGAS ═══════════ */}
      {pestañaActiva === "bodegas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: "var(--texto-xs)", color: "var(--color-text-muted)", margin: 0 }}>
              {errorBodegas
                ? "No se pudo cargar el listado"
                : `${bodegas.length} bodegas registradas`}
            </p>
            <PrimaryButton title="Nueva bodega" size="sm" onClick={abrirNuevaBodega} />
          </div>

          {cargandoBodegas ? (
            <p
              style={{
                fontSize: "var(--texto-xs)",
                color: "var(--color-text-muted)",
                textAlign: "center",
                padding: "20px",
              }}
            >
              Cargando bodegas...
            </p>
          ) : errorBodegas ? (
            <ErrorState message={errorBodegas} onRetry={cargarBodegas} />
          ) : bodegas.length === 0 ? (
            <p
              style={{
                fontSize: "var(--texto-xs)",
                color: "var(--color-text-muted)",
                textAlign: "center",
                padding: "20px",
              }}
            >
              No hay bodegas registradas
            </p>
          ) : (
            <table
              style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--texto-xs)" }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Nombre
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Tipo
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Ubicación
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "10px 12px",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Existencias
                  </th>
                  <th
                    style={{
                      textAlign: "center",
                      padding: "10px 12px",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {bodegas.map((b) => (
                  <tr key={b.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                      {b.nombre}
                      {/* 00176: de ella sale lo que se receta en una jornada sin botiquin. */}
                      {b.esPrincipal && (
                        <span
                          style={{
                            marginLeft: "8px",
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            fontSize: "var(--texto-xxs)",
                            fontWeight: 600,
                            backgroundColor:
                              "color-mix(in srgb, var(--color-primary) 18%, var(--color-surface))",
                            color: "var(--color-primary)",
                          }}
                        >
                          Principal
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          fontSize: "var(--texto-xxs)",
                          fontWeight: 600,
                          backgroundColor: b.esMovil
                            ? "color-mix(in srgb, var(--color-info) 18%, var(--color-surface))"
                            : "color-mix(in srgb, var(--color-success) 18%, var(--color-surface))",
                          color: b.esMovil ? "var(--color-info)" : "var(--color-success)",
                        }}
                      >
                        {b.esMovil ? " Móvil" : " Fija"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--color-text-muted)" }}>
                      {b.ubicacion || (
                        <span style={{ color: "var(--color-text-muted)" }}>— Sin ubicación</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>
                      {existenciaPorBodega[b.id] ?? 0}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap" }}>
                        {/* Issue #911: la tabla solo daba el total; esto dice que hay. */}
                        <button
                          type="button"
                          onClick={() => verContenidoBodega(b)}
                          style={ESTILO_BOTON_DE_FILA}
                        >
                          Ver contenido
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirEditarBodega(b)}
                          style={ESTILO_BOTON_DE_FILA}
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══════════ PROVEEDORES ═══════════ */}
      {pestañaActiva === "proveedores" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: "var(--texto-xs)", color: "var(--color-text-muted)", margin: 0 }}>
              {errorProveedores
                ? "No se pudo cargar el listado"
                : `${proveedores.length} proveedores y donantes. Los donantes se registran en ` +
                  "Donaciones > Donantes y aparecen aquí solos."}
            </p>
            <PrimaryButton title="Nuevo proveedor" size="sm" onClick={abrirNuevoProveedor} />
          </div>

          {cargandoProveedores ? (
            <p
              style={{
                fontSize: "var(--texto-xs)",
                color: "var(--color-text-muted)",
                textAlign: "center",
                padding: "20px",
              }}
            >
              Cargando proveedores...
            </p>
          ) : errorProveedores ? (
            <ErrorState message={errorProveedores} onRetry={cargarProveedores} />
          ) : proveedores.length === 0 ? (
            <p
              style={{
                fontSize: "var(--texto-xs)",
                color: "var(--color-text-muted)",
                textAlign: "center",
                padding: "20px",
              }}
            >
              No hay proveedores registrados
            </p>
          ) : (
            <table
              style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--texto-xs)" }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Nombre
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Tipo
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Contacto
                  </th>
                  <th
                    style={{
                      textAlign: "center",
                      padding: "10px 12px",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {proveedores.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>{p.nombre}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          fontSize: "var(--texto-xxs)",
                          fontWeight: 600,
                          backgroundColor:
                            p.tipo === "donante"
                              ? "color-mix(in srgb, var(--color-warning) 18%, var(--color-surface))"
                              : "color-mix(in srgb, var(--color-info) 18%, var(--color-surface))",
                          color:
                            p.tipo === "donante" ? "var(--color-warning)" : "var(--color-info)",
                        }}
                      >
                        {p.tipo === "donante" ? " Donante" : " Comercial"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--color-text-muted)" }}>
                      {p.contacto || (
                        <span style={{ color: "var(--color-text-muted)" }}>— Sin contacto</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      {/* El de un donante lleva a Donantes (00175, issue #911). */}
                      <button
                        type="button"
                        onClick={() => abrirEditarProveedor(p)}
                        style={ESTILO_BOTON_DE_FILA}
                      >
                        {esProveedorDeDonante(p) ? "Editar en Donantes" : "Editar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══════════ MODAL BODEGA ═══════════ */}
      {modalBodega && (
        <div
          {...fondoBodega}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "color-mix(in srgb, var(--color-text) 45%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <form
            onSubmit={handleGuardarBodega}
            style={{
              backgroundColor: "var(--color-surface)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "420px",
              margin: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <h4 style={{ margin: 0, fontSize: "var(--texto-sm)", fontWeight: 600 }}>
              {modalBodega.modo === "crear" ? "Nueva Bodega" : "Editar Bodega"}
            </h4>

            {errorGuardarBodega && <ErrorState message={errorGuardarBodega} />}

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "var(--texto-xs)",
                  fontWeight: 500,
                  marginBottom: "4px",
                }}
              >
                Nombre <span style={{ color: "var(--color-danger)" }}>*</span>
              </label>
              <input
                type="text"
                value={formBodega.nombre}
                onChange={(e) => setFormBodega((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Bodega Norte"
                maxLength={100}
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border)",
                  fontSize: "var(--texto-xs)",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "var(--texto-xs)",
                  fontWeight: 500,
                  marginBottom: "4px",
                }}
              >
                Ubicación
              </label>
              <input
                type="text"
                value={formBodega.ubicacion}
                onChange={(e) => setFormBodega((f) => ({ ...f, ubicacion: e.target.value }))}
                placeholder="Dirección o referencia (opcional)"
                maxLength={200}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border)",
                  fontSize: "var(--texto-xs)",
                }}
              />
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "var(--texto-xs)",
              }}
            >
              <input
                type="checkbox"
                checked={formBodega.esMovil}
                onChange={(e) => setFormBodega((f) => ({ ...f, esMovil: e.target.checked }))}
              />
              Es bodega móvil (viaja a jornadas)
            </label>

            <div className="ec-form-pie">
              <EnFormulario>
                <SecondaryButton title="Cancelar" onClick={() => setModalBodega(null)} />
                <PrimaryButton
                  type="submit"
                  title={modalBodega.modo === "crear" ? "Crear bodega" : "Guardar cambios"}
                />
              </EnFormulario>
            </div>
          </form>
        </div>
      )}

      {/* ═══════════ MODAL PROVEEDOR ═══════════ */}
      {modalProveedor && (
        <div
          {...fondoProveedor}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "color-mix(in srgb, var(--color-text) 45%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <form
            onSubmit={handleGuardarProveedor}
            style={{
              backgroundColor: "var(--color-surface)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "420px",
              margin: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <h4 style={{ margin: 0, fontSize: "var(--texto-sm)", fontWeight: 600 }}>
              {modalProveedor.modo === "crear" ? "Nuevo Proveedor" : "Editar Proveedor"}
            </h4>

            {errorGuardarProveedor && <ErrorState message={errorGuardarProveedor} />}

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "var(--texto-xs)",
                  fontWeight: 500,
                  marginBottom: "4px",
                }}
              >
                Nombre <span style={{ color: "var(--color-danger)" }}>*</span>
              </label>
              <input
                type="text"
                value={formProveedor.nombre}
                onChange={(e) => setFormProveedor((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre del proveedor o donante"
                maxLength={150}
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border)",
                  fontSize: "var(--texto-xs)",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "var(--texto-xs)",
                  fontWeight: 500,
                  marginBottom: "4px",
                }}
              >
                Contacto
              </label>
              <input
                type="text"
                value={formProveedor.contacto}
                onChange={(e) => setFormProveedor((f) => ({ ...f, contacto: e.target.value }))}
                placeholder="Teléfono, persona, etc. (opcional)"
                maxLength={150}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border)",
                  fontSize: "var(--texto-xs)",
                }}
              />
            </div>

            {/* Sin selector de tipo (issue #911): aqui solo se dan de alta proveedores comerciales.
                Un donante se registra en Donaciones > Donantes y su proveedor lo crea la base
                (00175); crearlo aqui dejaba un "donante" de inventario que no era ningun donante. */}
            <p style={{ fontSize: "var(--texto-xs)", color: "var(--color-text-muted)", margin: 0 }}>
              Proveedor comercial (compra). Los donantes se registran en Donaciones &gt; Donantes.
            </p>

            <div className="ec-form-pie">
              <EnFormulario>
                <SecondaryButton title="Cancelar" onClick={() => setModalProveedor(null)} />
                <PrimaryButton
                  type="submit"
                  title={modalProveedor.modo === "crear" ? "Crear proveedor" : "Guardar cambios"}
                />
              </EnFormulario>
            </div>
          </form>
        </div>
      )}

      {/* ═══════════ CONTENIDO DE UNA BODEGA ═══════════ */}
      <Modal
        visible={Boolean(contenidoBodega.bodega)}
        onClose={cerrarContenidoBodega}
        title={contenidoBodega.bodega ? `Contenido: ${contenidoBodega.bodega.nombre}` : ""}
        size="lg"
      >
        <ContenidoDeBodega
          contenido={contenidoBodega.contenido}
          cargando={contenidoBodega.cargando}
          error={contenidoBodega.error}
        />
      </Modal>
    </div>
  );
}
