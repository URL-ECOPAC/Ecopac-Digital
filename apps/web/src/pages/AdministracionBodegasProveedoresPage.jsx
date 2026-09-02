import { useState, useEffect } from "react";
import {
  useAdministracionBodegasProveedores,
  TIPO_BODEGA,
  TIPO_PROVEEDOR,
} from "../../../../packages/shared/inventario/useAdministracionBodegasProveedores.js";

export default function AdministracionBodegasProveedoresPage() {
  const [pestañaActiva, setPestañaActiva] = useState("bodegas");
  const [modalBodega, setModalBodega] = useState(null);
  const [modalProveedor, setModalProveedor] = useState(null);

  const {
    bodegas,
    cargandoBodegas,
    cargarBodegas,
    guardarBodega,
    existenciaPorBodega,
    proveedores,
    cargandoProveedores,
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
  const [formBodega, setFormBodega] = useState({
    nombre: "",
    ubicacion: "",
    es_movil: false,
  });

  const abrirNuevaBodega = () => {
    setFormBodega({ nombre: "", ubicacion: "", es_movil: false });
    setModalBodega({ modo: "crear" });
  };

  const abrirEditarBodega = (b) => {
    setFormBodega({
      id: b.id,
      nombre: b.nombre || "",
      ubicacion: b.ubicacion || "",
      es_movil: Boolean(b.es_movil),
    });
    setModalBodega({ modo: "editar" });
  };

  const handleGuardarBodega = async (e) => {
    e.preventDefault();
    try {
      await guardarBodega(formBodega);
      setModalBodega(null);
    } catch (err) {
      alert(err.message);
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
    setModalProveedor({ modo: "crear" });
  };

  const abrirEditarProveedor = (p) => {
    setFormProveedor({
      id: p.id,
      nombre: p.nombre || "",
      contacto: p.contacto || "",
      tipo: p.tipo || TIPO_PROVEEDOR.COMERCIAL,
    });
    setModalProveedor({ modo: "editar" });
  };

  const handleGuardarProveedor = async (e) => {
    e.preventDefault();
    try {
      await guardarProveedor(formProveedor);
      setModalProveedor(null);
    } catch (err) {
      alert(err.message);
    }
  };

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Cabecera */}
      <div>
        <h3 style={{ fontSize: "16px", fontWeight: "700", margin: 0, color: "#1e293b" }}>
           Administración: Bodegas y Proveedores
        </h3>
        <p style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0 0" }}>
          Configuración de ubicaciones y catálogo de origen de medicamentos
        </p>
      </div>

      {/* Pestañas */}
      <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", gap: "16px" }}>
        {[
          { id: "bodegas", etiqueta: " Bodegas" },
          { id: "proveedores", etiqueta: " Proveedores y Donantes" },
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => setPestañaActiva(p.id)}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: "700",
              border: "none",
              background: "none",
              cursor: "pointer",
              borderBottom: pestañaActiva === p.id ? "2px solid #10b981" : "2px solid transparent",
              color: pestañaActiva === p.id ? "#10b981" : "#64748b",
            }}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {/* ═══════════ BODEGAS ═══════════ */}
      {pestañaActiva === "bodegas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
              {bodegas.length} bodegas registradas
            </p>
            <button
              onClick={abrirNuevaBodega}
              style={{
                padding: "8px 16px",
                backgroundColor: "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: "9999px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              + Nueva Bodega
            </button>
          </div>

          {cargandoBodegas ? (
            <p style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center", padding: "20px" }}>
              Cargando bodegas...
            </p>
          ) : bodegas.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center", padding: "20px" }}>
              No hay bodegas registradas
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "#64748b" }}>Nombre</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "#64748b" }}>Tipo</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "#64748b" }}>Ubicación</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: "#64748b" }}>Existencias</th>
                  <th style={{ textAlign: "center", padding: "10px 12px", color: "#64748b" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {bodegas.map((b) => (
                  <tr key={b.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>{b.nombre}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        fontSize: "11px",
                        fontWeight: 600,
                        backgroundColor: b.es_movil ? "#dbeafe" : "#f0fdf4",
                        color: b.es_movil ? "#1d4ed8" : "#15803d",
                      }}>
                        {b.es_movil ? " Móvil" : " Fija"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#64748b" }}>
                      {b.ubicacion || <span style={{ color: "#cbd5e1" }}>— Sin ubicación</span>}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>
                      {existenciaPorBodega[b.id] ?? 0}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <button
                        onClick={() => abrirEditarBodega(b)}
                        style={{
                          padding: "4px 10px",
                          fontSize: "12px",
                          border: "none",
                          backgroundColor: "#f1f5f9",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        Editar
                      </button>
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
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
              {proveedores.length} proveedores y donantes
            </p>
            <button
              onClick={abrirNuevoProveedor}
              style={{
                padding: "8px 16px",
                backgroundColor: "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: "9999px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              + Nuevo Proveedor
            </button>
          </div>

          {cargandoProveedores ? (
            <p style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center", padding: "20px" }}>
              Cargando proveedores...
            </p>
          ) : proveedores.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center", padding: "20px" }}>
              No hay proveedores registrados
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "#64748b" }}>Nombre</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "#64748b" }}>Tipo</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "#64748b" }}>Contacto</th>
                  <th style={{ textAlign: "center", padding: "10px 12px", color: "#64748b" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {proveedores.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>{p.nombre}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        fontSize: "11px",
                        fontWeight: 600,
                        backgroundColor: p.tipo === "donante" ? "#fef3c7" : "#dbeafe",
                        color: p.tipo === "donante" ? "#92400e" : "#1d4ed8",
                      }}>
                        {p.tipo === "donante" ? " Donante" : " Comercial"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#64748b" }}>
                      {p.contacto || <span style={{ color: "#cbd5e1" }}>— Sin contacto</span>}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <button
                        onClick={() => abrirEditarProveedor(p)}
                        style={{
                          padding: "4px 10px",
                          fontSize: "12px",
                          border: "none",
                          backgroundColor: "#f1f5f9",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        Editar
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
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
        }}>
          <form onSubmit={handleGuardarBodega} style={{
            backgroundColor: "#fff", borderRadius: "12px", padding: "24px", width: "100%",
            maxWidth: "420px", margin: "16px", display: "flex", flexDirection: "column", gap: "16px",
          }}>
            <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>
              {modalBodega.modo === "crear" ? "Nueva Bodega" : "Editar Bodega"}
            </h4>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>
                Nombre <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                value={formBodega.nombre}
                onChange={(e) => setFormBodega(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Bodega Norte"
                maxLength={100}
                required
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: "8px",
                  border: "1px solid #e2e8f0", fontSize: "13px",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>
                Ubicación
              </label>
              <input
                type="text"
                value={formBodega.ubicacion}
                onChange={(e) => setFormBodega(f => ({ ...f, ubicacion: e.target.value }))}
                placeholder="Dirección o referencia (opcional)"
                maxLength={200}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: "8px",
                  border: "1px solid #e2e8f0", fontSize: "13px",
                }}
              />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
              <input
                type="checkbox"
                checked={formBodega.es_movil}
                onChange={(e) => setFormBodega(f => ({ ...f, es_movil: e.target.checked }))}
              />
              Es bodega móvil (viaja a jornadas)
            </label>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setModalBodega(null)}
                style={{
                  padding: "8px 16px", borderRadius: "8px", border: "1px solid #e2e8f0",
                  backgroundColor: "#fff", fontSize: "13px", cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{
                  padding: "8px 16px", borderRadius: "8px", border: "none",
                  backgroundColor: "#10b981", color: "#fff", fontSize: "13px",
                  fontWeight: 500, cursor: "pointer",
                }}
              >
                {modalBodega.modo === "crear" ? "Crear" : "Guardar Cambios"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ═══════════ MODAL PROVEEDOR ═══════════ */}
      {modalProveedor && (
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
        }}>
          <form onSubmit={handleGuardarProveedor} style={{
            backgroundColor: "#fff", borderRadius: "12px", padding: "24px", width: "100%",
            maxWidth: "420px", margin: "16px", display: "flex", flexDirection: "column", gap: "16px",
          }}>
            <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>
              {modalProveedor.modo === "crear" ? "Nuevo Proveedor" : "Editar Proveedor"}
            </h4>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>
                Nombre <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                value={formProveedor.nombre}
                onChange={(e) => setFormProveedor(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre del proveedor o donante"
                maxLength={150}
                required
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: "8px",
                  border: "1px solid #e2e8f0", fontSize: "13px",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>
                Contacto
              </label>
              <input
                type="text"
                value={formProveedor.contacto}
                onChange={(e) => setFormProveedor(f => ({ ...f, contacto: e.target.value }))}
                placeholder="Teléfono, persona, etc. (opcional)"
                maxLength={150}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: "8px",
                  border: "1px solid #e2e8f0", fontSize: "13px",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>
                Tipo <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={formProveedor.tipo}
                onChange={(e) => setFormProveedor(f => ({ ...f, tipo: e.target.value }))}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: "8px",
                  border: "1px solid #e2e8f0", fontSize: "13px",
                }}
              >
                <option value={TIPO_PROVEEDOR.COMERCIAL}> Comercial (Compra)</option>
                <option value={TIPO_PROVEEDOR.DONANTE}> Donante</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setModalProveedor(null)}
                style={{
                  padding: "8px 16px", borderRadius: "8px", border: "1px solid #e2e8f0",
                  backgroundColor: "#fff", fontSize: "13px", cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{
                  padding: "8px 16px", borderRadius: "8px", border: "none",
                  backgroundColor: "#10b981", color: "#fff", fontSize: "13px",
                  fontWeight: 500, cursor: "pointer",
                }}
              >
                {modalProveedor.modo === "crear" ? "Crear" : "Guardar Cambios"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
