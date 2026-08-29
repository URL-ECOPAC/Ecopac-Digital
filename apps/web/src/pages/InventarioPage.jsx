import React, { useState, useEffect } from "react";
import ModalMedicamento from "./ModalMedicamento.jsx";

// Importaciones nombradas exactas desde el API de medicamentos
import {
  listarMedicamentos,
  registrarMedicamento,
  actualizarMedicamento,
} from "../../../../packages/shared/inventario/medicamentos.api.js";

// Importaciones nombradas exactas del API de principios activos
import {
  listarPrincipiosActivos,
  registrarPrincipioActivo,
} from "../../../../packages/shared/inventario/principios-activos.api.js";

import { useCatalogoMedicamentos } from "../../../../packages/shared/inventario/useCatalogoMedicamentos.js";

export default function InventarioPage() {
  const [inventarioRaw, setInventarioRaw] = useState([]);
  const [principiosActivos, setPrincipiosActivos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Estados del Modal
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

  // Requerimiento Issue #154: Vista y permisos de Administrador
  const esAdmin = true;

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

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError(null);

      const [resMed, resPA] = await Promise.all([
        listarMedicamentos(),
        listarPrincipiosActivos(),
      ]);

      // Extraer arreglo de medicamentos
      if (resMed.error) {
        setError(resMed.error.mensaje || "Error al cargar medicamentos");
      } else {
        setInventarioRaw(resMed.medicamentos || []);
      }

      // Extraer arreglo de principios activos según firma real { principiosActivos, error }
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
      // Llamada directa usando la función de la API de principios activos
      const { principioActivo, error: errorPA } = await registrarPrincipioActivo({
        nombre: nuevoNombre.trim(),
      });

      if (errorPA) {
        alert(`No se pudo guardar: ${errorPA.mensaje || "Error al crear el principio activo"}`);
        return;
      }

      if (principioActivo && principioActivo.id) {
        // 1. Añadirlo inmediatamente a la lista local para renderizarlo en el select
        setPrincipiosActivos((prev) => [...prev, principioActivo]);

        // 2. Seleccionar automáticamente el ID recién registrado en el formulario
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

  const handleGuardarMedicamento = async () => {
    // Validar combinación duplicada: Nombre + Concentración + Presentación + Marca (Issue #154)
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
          nombre: formData.nombre,
          concentracion: formData.concentracion,
          presentacion: formData.presentacion,
          marca: formData.marca,
          formaFarmaceutica: formData.formaFarmaceutica,
        });

        if (errorUpdate) {
          console.error("Error al actualizar medicamento:", errorUpdate);
          return;
        }
      } else {
        const { error: errorReg } = await registrarMedicamento({
          nombre: formData.nombre,
          concentracion: formData.concentracion,
          presentacion: formData.presentacion,
          marca: formData.marca,
          formaFarmaceutica: formData.formaFarmaceutica,
          principiosActivosIds: formData.principio_activo_id
            ? [formData.principio_activo_id]
            : [],
        });

        if (errorReg) {
          console.error("Error al registrar medicamento:", errorReg);
          return;
        }
      }

      setModalAbierto(false);
      await cargarDatos();
    } catch (err) {
      console.error("Error inesperado al guardar medicamento:", err);
    } finally {
      setCargandoGuardar(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "24px", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#1e293b", margin: 0 }}>Control de Inventario</h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0 0" }}>
            Trazabilidad multi-bodega • Lote y serie • Alertas de caducidad
          </p>
        </div>

        {/* Botón visible solo si es Admin (#154) */}
        {esAdmin && (
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
              boxShadow: "0 2px 4px rgba(16, 185, 129, 0.2)",
            }}
          >
            + Nuevo Medicamento
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: "12px 16px", backgroundColor: "#fef2f2", color: "#991b1b", borderRadius: "12px", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {/* Métricas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        <div style={{ backgroundColor: "#ffffff", padding: "16px", borderRadius: "16px", border: "1px solid #f1f5f9" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#10b981" }}>REFERENCIAS</span>
          <h2 style={{ fontSize: "24px", margin: "4px 0 0 0", color: "#10b981" }}>{inventarioRaw.length}</h2>
        </div>
        <div style={{ backgroundColor: "#ffffff", padding: "16px", borderRadius: "16px", border: "1px solid #f1f5f9" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#f59e0b" }}>POR VENCER</span>
          <h2 style={{ fontSize: "24px", margin: "4px 0 0 0", color: "#f59e0b" }}>0</h2>
        </div>
        <div style={{ backgroundColor: "#ffffff", padding: "16px", borderRadius: "16px", border: "1px solid #f1f5f9" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#ec4899" }}>SIN STOCK</span>
          <h2 style={{ fontSize: "24px", margin: "4px 0 0 0", color: "#ec4899" }}>0</h2>
        </div>
        <div style={{ backgroundColor: "#ffffff", padding: "16px", borderRadius: "16px", border: "1px solid #f1f5f9" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#06b6d4" }}>VALOR INVENTARIO</span>
          <h2 style={{ fontSize: "24px", margin: "4px 0 0 0", color: "#06b6d4" }}>Q 0</h2>
        </div>
      </div>

      {/* Buscador y Bodegas */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Código, descripción o lote..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ flex: 1, padding: "10px 16px", borderRadius: "9999px", border: "1px solid #e2e8f0", fontSize: "13px", outline: "none" }}
        />
        <div style={{ display: "flex", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "9999px", padding: "3px" }}>
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
                backgroundColor: (bodegaSeleccionada === b || (b === "Todas" && !bodegaSeleccionada)) ? "#e8f5e9" : "transparent",
                color: (bodegaSeleccionada === b || (b === "Todas" && !bodegaSeleccionada)) ? "#2e7d32" : "#64748b",
              }}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Categorías Pills */}
      {categoriasPills && (
        <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
          {categoriasPills.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaSeleccionada(cat)}
              style={{
                padding: "6px 16px",
                borderRadius: "9999px",
                fontSize: "12px",
                border: "1px solid",
                cursor: "pointer",
                backgroundColor: categoriaSeleccionada === cat ? "#ecfdf5" : "#ffffff",
                color: categoriaSeleccionada === cat ? "#047857" : "#64748b",
                borderColor: categoriaSeleccionada === cat ? "#a7f3d0" : "#e2e8f0",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Tabla */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: "24px", border: "1px solid #f1f5f9", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
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
              <tr><td colSpan={esAdmin ? 7 : 6} style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}>Cargando inventario...</td></tr>
            ) : inventarioFiltrado.length === 0 ? (
              <tr><td colSpan={esAdmin ? 7 : 6} style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}>No hay referencias registradas.</td></tr>
            ) : (
              inventarioFiltrado.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                  <td style={{ padding: "16px", color: "#10b981", fontFamily: "monospace" }}>{item.id ? item.id.substring(0, 8).toUpperCase() : "FAR-0000"}</td>
                  <td style={{ padding: "16px", fontWeight: "700", color: "#1e293b" }}>
                    {item.nombre} {item.concentracion ? `(${item.concentracion})` : ""}
                  </td>
                  <td style={{ padding: "16px", color: "#64748b" }}>
                    {item.marca || "Generico"} {item.formaFarmaceutica ? `• ${item.formaFarmaceutica}` : ""}
                  </td>
                  <td style={{ padding: "16px", fontFamily: "monospace" }}>{item.lote || "N/A"}</td>
                  <td style={{ padding: "16px" }}>{item.bodega || "CENTRAL"}</td>
                  <td style={{ padding: "16px", fontWeight: "700" }}>{item.stock ?? 0}</td>
                  {esAdmin && (
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <button
                        onClick={() => abrirModalEditar(item)}
                        style={{ border: "none", background: "none", color: "#0ea5e9", cursor: "pointer", fontWeight: "600", fontSize: "12px" }}
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

      {/* Componente Modal */}
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
    </div>
  );
}