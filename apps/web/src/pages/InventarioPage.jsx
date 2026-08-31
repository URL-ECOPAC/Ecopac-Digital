import React, { useState, useEffect } from "react";
import ModalMedicamento from "./ModalMedicamento.jsx";
import { ModalAltaLote } from "./ModalAltaLote.jsx";
import { ModalAtenderAlerta } from "./ModalAtenderAlerta.jsx";
// 1. Importar el modal de registro de ingreso (#156)
import ModalRegistroIngreso from "./ModalRegistroIngreso.jsx";

// API Medicamentos y Principios Activos (#154)
import {
  listarMedicamentos,
  registrarMedicamento,
  actualizarMedicamento,
} from "../../../../packages/shared/inventario/medicamentos.api.js";

import {
  listarPrincipiosActivos,
  registrarPrincipioActivo,
} from "../../../../packages/shared/inventario/principios-activos.api.js";

import { useCatalogoMedicamentos } from "../../../../packages/shared/inventario/useCatalogoMedicamentos.js";
import { useGestionLotes } from "../../../../packages/shared/inventario/useGestionLotes.js";

export default function InventarioPage() {
  // Pestaña Activa: 'catalogo' | 'lotes'
  const [tabActiva, setTabActiva] = useState("catalogo");

  const [inventarioRaw, setInventarioRaw] = useState([]);
  const [principiosActivos, setPrincipiosActivos] = useState([]);
  const [lotesRaw, setLotesRaw] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [donaciones, setDonaciones] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Estados Modales Medicamentos (#154)
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [cargandoGuardar, setCargandoGuardar] = useState(false);
  const [advertenciaDuplicado, setAdvertenciaDuplicado] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    principio_activo_id: "",
    concentracion: "",
    presentacion: "",
    marca: "",
    formaFarmaceutica: "",
  });

  // Estados Modales Lotes (#155)
  const [modalAltaLoteAbierto, setModalAltaLoteAbierto] = useState(false);
  const [alertaSeleccionada, setAlertaSeleccionada] = useState(null);

  // 2. Estado Modal Registro de Ingreso (#156)
  const [modalRegistroIngresoAbierto, setModalRegistroIngresoAbierto] = useState(false);

  const esAdmin = true;
  const usuarioActual = { id: "user-admin-uuid", rol: esAdmin ? "Administrador" : "Usuario" };

  // Hooks Shared
  const {
    busqueda,
    setBusqueda,
    categoriaSeleccionada,
    setCategoriaSeleccionada,
    bodegaSeleccionada,
    setBodegaSeleccionada,
    categoriasPills,
    inventarioFiltrado,
  } = useCatalogoMedicamentos({ inventarioInicial: inventarioRaw });

  const {
    lotesFiltrados,
    alertasCriticas,
    validarNuevoLote,
    atenderAlertaCaducidad,
    errorValidacion: errorLotes,
    setErrorValidacion: setErrorLotes,
  } = useGestionLotes({
    lotesIniciales: lotesRaw,
    bodegas,
    proveedores,
    usuario: usuarioActual,
  });

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError(null);

      const [resMed, resPA] = await Promise.all([listarMedicamentos(), listarPrincipiosActivos()]);

      if (resMed.error) {
        setError(resMed.error.mensaje || "Error al cargar medicamentos");
      } else {
        setInventarioRaw(resMed.medicamentos || []);
      }

      if (resPA.error) {
        console.error("Error cargando principios activos:", resPA.error);
      } else {
        setPrincipiosActivos(resPA.principiosActivos || []);
      }
    } catch (err) {
      console.error("Error cargando inventario:", err);
      setError("No se pudo cargar el inventario.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Handlers Medicamento (#154)
  const abrirModalNuevo = () => {
    setModoEdicion(false);
    setFormData({
      nombre: "",
      principio_activo_id: "",
      concentracion: "",
      presentacion: "",
      marca: "",
      formaFarmaceutica: "",
    });
    setAdvertenciaDuplicado(false);
    setModalAbierto(true);
  };

  const abrirModalEditar = (item) => {
    setModoEdicion(true);
    setFormData({
      id: item.id,
      nombre: item.nombre || "",
      principio_activo_id: item.principio_activo_id || "",
      concentracion: item.concentracion || "",
      presentacion: item.presentacion || "",
      marca: item.marca || "",
      formaFarmaceutica: item.formaFarmaceutica || item.forma_farmaceutica || "",
    });
    setAdvertenciaDuplicado(false);
    setModalAbierto(true);
  };

  const handleCrearPrincipioActivo = async () => {
    const nuevoNombre = prompt("Nombre del nuevo principio activo:");
    if (!nuevoNombre || !nuevoNombre.trim()) return;

    try {
      const { principioActivo, error: errorPA } = await registrarPrincipioActivo({
        nombre: nuevoNombre.trim(),
      });

      if (errorPA) {
        alert(`No se pudo guardar: ${errorPA.mensaje || "Error al crear el principio activo"}`);
        return;
      }

      if (principioActivo && principioActivo.id) {
        setPrincipiosActivos((prev) => [...prev, principioActivo]);
        setFormData((prev) => ({
          ...prev,
          principio_activo_id: principioActivo.id,
        }));
      }
    } catch (err) {
      console.error("Error al crear principio activo:", err);
      alert("Error al procesar la solicitud del principio activo.");
    }
  };

  const normalizarPresentacion = (valor) => {
    if (!valor) return "";
    return valor
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  };

  const handleGuardarMedicamento = async () => {
    const duplicado = inventarioRaw.some(
      (item) =>
        item.id !== formData.id &&
        item.nombre?.toLowerCase() === formData.nombre?.toLowerCase() &&
        item.concentracion?.toLowerCase() === formData.concentracion?.toLowerCase() &&
        item.presentacion?.toLowerCase() === formData.presentacion?.toLowerCase() &&
        item.marca?.toLowerCase() === formData.marca?.toLowerCase()
    );

    if (duplicado) {
      setAdvertenciaDuplicado(true);
      return;
    }

    try {
      setCargandoGuardar(true);

      if (modoEdicion) {
        const { error: errorUpdate } = await actualizarMedicamento(formData.id, {
          nombre: formData.nombre.trim(),
          concentracion: formData.concentracion.trim(),
          presentacion: normalizarPresentacion(formData.presentacion),
          marca: formData.marca.trim(),
          formaFarmaceutica: formData.formaFarmaceutica ? formData.formaFarmaceutica.trim() : null,
        });

        if (errorUpdate) {
          alert(`Error al actualizar: ${errorUpdate.mensaje || errorUpdate.message}`);
          return;
        }
      } else {
        if (!formData.principioActivoId) {
          alert("Debes seleccionar un principio activo.");
          return;
        }

        const payload = {
          nombre: formData.nombre.trim(),
          concentracion: formData.concentracion.trim(),
          presentacion: normalizarPresentacion(formData.presentacion),
          marca: formData.marca.trim(),
          formaFarmaceutica: formData.formaFarmaceutica ? formData.formaFarmaceutica.trim() : null,
          esPediatrico: Boolean(formData.esPediatrico),
          principiosActivosIds: [formData.principioActivoId],
        };

        const { error: errorReg } = await registrarMedicamento(payload);

        if (errorReg) {
          console.error("Detalle del error API:", errorReg);
          alert(`Error al registrar: ${errorReg.mensaje || errorReg.message}`);
          return;
        }
      }

      setModalAbierto(false);
      await cargarDatos();
    } catch (err) {
      console.error("Error inesperado:", err);
      alert("Error de comunicación con el servidor.");
    } finally {
      setCargandoGuardar(false);
    }
  };

  // Handlers Lotes (#155)
  const handleGuardarLote = (datosLote) => {
    if (validarNuevoLote(datosLote)) {
      setModalAltaLoteAbierto(false);
      cargarDatos();
    }
  };

  const handleResolverAlerta = (alertaId, accion) => {
    const datosCierre = atenderAlertaCaducidad(alertaId, accion);
    if (datosCierre) {
      setAlertaSeleccionada(null);
      cargarDatos();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        padding: "24px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#1e293b", margin: 0 }}>
            Control de Inventario
          </h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0 0" }}>
            Trazabilidad multi-bodega • Lote y serie • Alertas de caducidad
          </p>
        </div>

        {/* Acciones de Admin */}
        {esAdmin && (
          <div style={{ display: "flex", gap: "8px" }}>
            {/* 3. Botón + Registrar Ingreso (#156) */}
            <button
              onClick={() => setModalRegistroIngresoAbierto(true)}
              style={{
                padding: "10px 20px",
                borderRadius: "9999px",
                border: "none",
                backgroundColor: "#059669",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              + Registrar Ingreso
            </button>

            {tabActiva === "catalogo" ? (
              <button
                onClick={abrirModalNuevo}
                style={{
                  padding: "10px 20px",
                  borderRadius: "9999px",
                  border: "none",
                  backgroundColor: "#10b981",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                + Nuevo Medicamento
              </button>
            ) : (
              <button
                onClick={() => {
                  setErrorLotes(null);
                  setModalAltaLoteAbierto(true);
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "9999px",
                  border: "none",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                + Registrar Lote
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pestañas de Navegación Módulo */}
      <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", gap: "16px" }}>
        <button
          onClick={() => setTabActiva("catalogo")}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: "700",
            border: "none",
            background: "none",
            cursor: "pointer",
            borderBottom: tabActiva === "catalogo" ? "2px solid #10b981" : "2px solid transparent",
            color: tabActiva === "catalogo" ? "#10b981" : "#64748b",
          }}
        >
          Catálogo Medicamentos
        </button>
        <button
          onClick={() => setTabActiva("lotes")}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: "700",
            border: "none",
            background: "none",
            cursor: "pointer",
            borderBottom: tabActiva === "lotes" ? "2px solid #2563eb" : "2px solid transparent",
            color: tabActiva === "lotes" ? "#2563eb" : "#64748b",
          }}
        >
          Lotes y Caducidades
        </button>
      </div>

      {/* Tira de Alertas Críticas */}
      {alertasCriticas.length > 0 && (
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "#fffbeb",
            border: "1px solid #fef3c7",
            borderRadius: "12px",
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#b45309" }}>
            Alertas Críticas de Caducidad ({alertasCriticas.length})
          </span>
          <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
            {alertasCriticas.map((lote) => (
              <div
                key={lote.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  backgroundColor: lote.estadoAlerta === "danger" ? "#fee2e2" : "#fef3c7",
                  color: lote.estadoAlerta === "danger" ? "#991b1b" : "#92400e",
                }}
              >
                <span>
                  {lote.medicamento?.nombre} (Lote: {lote.numero_lote}) -{" "}
                  {lote.diasRestantes <= 0 ? "VENCIDO" : `${lote.diasRestantes} días`}
                </span>
                <button
                  onClick={() => setAlertaSeleccionada(lote)}
                  style={{
                    padding: "2px 6px",
                    fontSize: "10px",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    backgroundColor: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Atender
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "#fef2f2",
            color: "#991b1b",
            borderRadius: "12px",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      {/* Métricas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "16px",
            borderRadius: "16px",
            border: "1px solid #f1f5f9",
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#10b981" }}>REFERENCIAS</span>
          <h2 style={{ fontSize: "24px", margin: "4px 0 0 0", color: "#10b981" }}>
            {inventarioRaw.length}
          </h2>
        </div>
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "16px",
            borderRadius: "16px",
            border: "1px solid #f1f5f9",
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#f59e0b" }}>POR VENCER</span>
          <h2 style={{ fontSize: "24px", margin: "4px 0 0 0", color: "#f59e0b" }}>
            {alertasCriticas.length}
          </h2>
        </div>
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "16px",
            borderRadius: "16px",
            border: "1px solid #f1f5f9",
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#ec4899" }}>SIN STOCK</span>
          <h2 style={{ fontSize: "24px", margin: "4px 0 0 0", color: "#ec4899" }}>0</h2>
        </div>
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "16px",
            borderRadius: "16px",
            border: "1px solid #f1f5f9",
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#06b6d4" }}>
            VALOR INVENTARIO
          </span>
          <h2 style={{ fontSize: "24px", margin: "4px 0 0 0", color: "#06b6d4" }}>Q 0</h2>
        </div>
      </div>

      {/* Buscador y Filtros */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Código, descripción o lote..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{
            flex: 1,
            padding: "10px 16px",
            borderRadius: "9999px",
            border: "1px solid #e2e8f0",
            fontSize: "13px",
            outline: "none",
          }}
        />
        <div
          style={{
            display: "flex",
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "9999px",
            padding: "3px",
          }}
        >
          {["Todas", "Central", "Norte", "Sur"].map((b) => (
            <button
              key={b}
              onClick={() => setBodegaSeleccionada(b === "Todas" ? "" : b)}
              style={{
                padding: "6px 16px",
                borderRadius: "9999px",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                backgroundColor:
                  bodegaSeleccionada === b || (b === "Todas" && !bodegaSeleccionada)
                    ? "#e8f5e9"
                    : "transparent",
                color:
                  bodegaSeleccionada === b || (b === "Todas" && !bodegaSeleccionada)
                    ? "#2e7d32"
                    : "#64748b",
              }}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Catálogo */}
      {tabActiva === "catalogo" && (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "24px",
            border: "1px solid #f1f5f9",
            overflow: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "13px",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #f1f5f9", color: "#94a3b8", fontSize: "10px" }}>
                <th style={{ padding: "16px" }}>CÓDIGO</th>
                <th style={{ padding: "16px" }}>DESCRIPCIÓN</th>
                <th style={{ padding: "16px" }}>MARCA / FORMA</th>
                <th style={{ padding: "16px" }}>LOTE / SERIE</th>
                <th style={{ padding: "16px" }}>BODEGA</th>
                <th style={{ padding: "16px" }}>STOCK</th>
                {esAdmin && <th style={{ padding: "16px", textAlign: "center" }}>ACCIONES</th>}
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td
                    colSpan={esAdmin ? 7 : 6}
                    style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}
                  >
                    Cargando inventario...
                  </td>
                </tr>
              ) : inventarioFiltrado.length === 0 ? (
                <tr>
                  <td
                    colSpan={esAdmin ? 7 : 6}
                    style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}
                  >
                    No hay referencias registradas.
                  </td>
                </tr>
              ) : (
                inventarioFiltrado.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                    <td style={{ padding: "16px", color: "#10b981", fontFamily: "monospace" }}>
                      {item.id ? item.id.substring(0, 8).toUpperCase() : "FAR-0000"}
                    </td>
                    <td style={{ padding: "16px", fontWeight: "700", color: "#1e293b" }}>
                      {item.nombre} {item.concentracion ? `(${item.concentracion})` : ""}
                    </td>
                    <td style={{ padding: "16px", color: "#64748b" }}>
                      {item.marca || "Generico"}{" "}
                      {item.formaFarmaceutica ? `• ${item.formaFarmaceutica}` : ""}
                    </td>
                    <td style={{ padding: "16px", fontFamily: "monospace" }}>
                      {item.lote || "N/A"}
                    </td>
                    <td style={{ padding: "16px" }}>{item.bodega || "CENTRAL"}</td>
                    <td style={{ padding: "16px", fontWeight: "700" }}>{item.stock ?? 0}</td>
                    {esAdmin && (
                      <td style={{ padding: "16px", textAlign: "center" }}>
                        <button
                          onClick={() => abrirModalEditar(item)}
                          style={{
                            border: "none",
                            background: "none",
                            color: "#0ea5e9",
                            cursor: "pointer",
                            fontWeight: "600",
                            fontSize: "12px",
                          }}
                        >
                          Editar
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Lotes */}
      {tabActiva === "lotes" && (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "24px",
            border: "1px solid #f1f5f9",
            overflow: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "13px",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #f1f5f9", color: "#94a3b8", fontSize: "10px" }}>
                <th style={{ padding: "16px" }}>NÚMERO LOTE</th>
                <th style={{ padding: "16px" }}>MEDICAMENTO</th>
                <th style={{ padding: "16px" }}>ORIGEN</th>
                <th style={{ padding: "16px" }}>FECHA CADUCIDAD</th>
                <th style={{ padding: "16px" }}>STOCK DISPONIBLE</th>
                <th style={{ padding: "16px" }}>ESTADO</th>
              </tr>
            </thead>
            <tbody>
              {lotesFiltrados.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}
                  >
                    No hay lotes registrados.
                  </td>
                </tr>
              ) : (
                lotesFiltrados.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                    <td style={{ padding: "16px", fontFamily: "monospace", fontWeight: "700" }}>
                      {item.numero_lote}
                    </td>
                    <td style={{ padding: "16px", fontWeight: "600" }}>
                      {item.medicamento?.nombre}
                    </td>
                    <td style={{ padding: "16px", textTransform: "capitalize" }}>{item.origen}</td>
                    <td style={{ padding: "16px" }}>{item.fecha_vencimiento}</td>
                    <td style={{ padding: "16px", fontWeight: "700" }}>{item.stockTotal} u.</td>
                    <td style={{ padding: "16px" }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: "9999px",
                          fontSize: "11px",
                          fontWeight: "700",
                          backgroundColor:
                            item.estadoAlerta === "danger"
                              ? "#fee2e2"
                              : item.estadoAlerta === "warning"
                                ? "#fef3c7"
                                : "#d1fae5",
                          color:
                            item.estadoAlerta === "danger"
                              ? "#991b1b"
                              : item.estadoAlerta === "warning"
                                ? "#92400e"
                                : "#065f46",
                        }}
                      >
                        {item.estadoAlerta === "danger"
                          ? "Vencido"
                          : item.estadoAlerta === "warning"
                            ? "Próximo a Vencer"
                            : "Vigente"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modales Medicamentos */}
      <ModalMedicamento
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        modoEdicion={modoEdicion}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleGuardarMedicamento}
        principiosActivos={principiosActivos}
        onCrearPrincipioActivo={handleCrearPrincipioActivo}
        advertenciaDuplicado={advertenciaDuplicado}
        cargando={cargandoGuardar}
      />

      {/* Modales Lotes */}
      <ModalAltaLote
        abierto={modalAltaLoteAbierto}
        onClose={() => setModalAltaLoteAbierto(false)}
        onGuardar={handleGuardarLote}
        medicamentos={inventarioRaw}
        proveedores={proveedores}
        bodegas={bodegas}
        errorValidacion={errorLotes}
      />

      <ModalAtenderAlerta
        alerta={alertaSeleccionada}
        onClose={() => setAlertaSeleccionada(null)}
        onResolver={handleResolverAlerta}
        errorValidacion={errorLotes}
      />

      {/* 4. Render del Modal Registro Ingreso (#156) */}
      <ModalRegistroIngreso
        abierto={modalRegistroIngresoAbierto}
        onCerrar={() => {
          setModalRegistroIngresoAbierto(false);
          cargarDatos(); // Recargar inventario al cerrar o registrar un movimiento
        }}
        catalogos={{
          medicamentos: inventarioRaw,
          bodegas,
          donaciones,
          proveedores,
        }}
        usuarioActual={usuarioActual}
      />
    </div>
  );
}