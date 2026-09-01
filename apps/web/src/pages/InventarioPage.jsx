import { useState, useEffect } from "react";
import ModalMedicamento from "./ModalMedicamento.jsx";
import { ModalAltaLote } from "./ModalAltaLote.jsx";
import { ModalAtenderAlerta } from "./ModalAtenderAlerta.jsx";
import ModalRegistroIngreso from "./ModalRegistroIngreso.jsx";
import { ModalSalidaMedicamento } from "./ModalSalidaMedicamento";
import { supabase } from "@ecopac/shared";

// API Medicamentos y Principios Activos
import {
  listarMedicamentos,
  registrarMedicamento,
  actualizarMedicamento,
} from "../../../../packages/shared/inventario/medicamentos.api.js";
import { listarBodegas } from "../../../../packages/shared/inventario/bodegas.api.js";
import { generarIngresoDesdeDonacion } from "../../../../packages/shared/donaciones/ingreso.api.js";
import { listarProveedores } from "../../../../packages/shared/inventario/proveedores.api.js";
import {
  listarPrincipiosActivos,
  registrarPrincipioActivo,
} from "../../../../packages/shared/inventario/principios-activos.api.js";

import { useCatalogoMedicamentos } from "../../../../packages/shared/inventario/useCatalogoMedicamentos.js";
import { useGestionLotes } from "../../../../packages/shared/inventario/useGestionLotes.js";

const thStyle = {
  padding: "12px 16px",
  fontSize: "11px",
  fontWeight: "700",
  color: "#64748b",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
};

const tdStyle = {
  padding: "14px 16px",
  verticalAlign: "middle",
  textAlign: "center",
};

const cardMetricStyle = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  padding: "16px 20px",
  border: "1px solid #f1f5f9",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
};
const datosTablaDemo = [];
export default function InventarioPage() {
  // Pestaña Activa: 'catalogo' | 'lotes'
  const [tabActiva, setTabActiva] = useState("catalogo");

  const [inventarioRaw, setInventarioRaw] = useState([]);
  const [principiosActivos, setPrincipiosActivos] = useState([]);
  const [lotesRaw, setLotesRaw] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [donaciones, setDonaciones] = useState([]);
  const { setModalIngresoAbierto, refrescarInventario } = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Modales Medicamentos
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

  // Modales Lotes y Alertas
  const [modalAltaLoteAbierto, setModalAltaLoteAbierto] = useState(false);
  const [modalSalidaAbierto, setModalSalidaAbierto] = useState(false);
  const [alertaSeleccionada, setAlertaSeleccionada] = useState(null);
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
    inventarioFiltrado: inventarioFiltradoHook,
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
      // Agrega listarBodegas aquí
      const [resMed, resPA, resBodegas, resProveedores] = await Promise.all([
        listarMedicamentos(),
        listarPrincipiosActivos(),
        listarBodegas(),
        listarProveedores(),
      ]);
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
      if (resBodegas.error) {
        console.error("Error cargando bodegas:", resBodegas.error);
      } else {
        setBodegas(resBodegas.bodegas || []); // Se guardan en tu estado 'bodegas'
      }
      if (resProveedores.error) {
        console.error("Error cargando proveedores:", resProveedores.error);
      } else {
        setProveedores(resProveedores.proveedores || []); // <-- Se asigna a setProveedores
      }
    } catch (err) {
      console.error("Error cargando inventario:", err);
      setError("No se pudo cargar el inventario.");
    } finally {
      setCargando(false);
    }
  };

  const handleGuardarIngresoDonacion = async (formData) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // formData contendrá los datos seleccionados en el modal (ej: donacionDetalleId, medicamentoId, bodegaId, etc.)
      const { resultado, error } = await generarIngresoDesdeDonacion(formData.donacionDetalleId, {
        medicamentoId: formData.medicamentoId,
        bodegaId: formData.bodegaId,
        numeroLote: formData.numeroLote,
        fechaVencimiento: formData.fechaVencimiento,
        proveedorId: formData.proveedorId,
        usuarioId: user?.id, // El ID del usuario actual autenticado
      });

      if (error) {
        console.error("Error al registrar ingreso desde donación:", error.mensaje);
        alert(error.mensaje);
        return;
      }

      // Si todo sale bien, cerramos el modal, refrescamos el inventario y notificamos éxito
      setModalIngresoAbierto(false);
      refrescarInventario();
    } catch (err) {
      console.error("Excepción inesperada al guardar ingreso:", err);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Handlers
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
        setFormData((prev) => ({ ...prev, principio_activo_id: principioActivo.id }));
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
        item.marca?.toLowerCase() === formData.marca?.toLowerCase(),
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
        if (!formData.principio_activo_id) {
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
          principiosActivosIds: [formData.principio_activo_id],
        };

        const { error: errorReg } = await registrarMedicamento(payload);

        if (errorReg) {
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

  // Helper de formato de Badges
  const getBadgeEstado = (estado, stock) => {
    if (stock === 0) {
      return { label: "AGOTADO", bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1" };
    }

    switch (estado?.toLowerCase()) {
      case "critico":
      case "crítico":
        return { label: "CRÍTICO", bg: "#fdf2f8", color: "#db2777", border: "#fbcfe8" };
      case "por vencer":
        return { label: "POR VENCER", bg: "#fffbeb", color: "#d97706", border: "#fef3c7" };
      case "disponible":
      default:
        return { label: "DISPONIBLE", bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" };
    }
  };

  const alertasParaMostrar =
    alertasCriticas.length > 0
      ? alertasCriticas
      : [
          {
            id: "alt-1",
            medicamento: { nombre: "Metformina 850mg Comprimidos" },
            codigo: "FAR-0009",
            numero_lote: "L-2024-0567",
            bodega: "SUR",
            diasRestantes: 12,
            fechaCaducidad: "27 jul 2024",
          },
          {
            id: "alt-2",
            medicamento: { nombre: "Amoxicilina 500mg Cápsulas" },
            codigo: "FAR-0041",
            numero_lote: "L-2024-0091",
            bodega: "CENTRAL",
            diasRestantes: 30,
            fechaCaducidad: "14 ago 2024",
          },
        ];

  const fuenteInicial = inventarioRaw.length > 0 ? inventarioFiltradoHook : datosTablaDemo;

  const baseDatosFiltrada = fuenteInicial.filter((item) => {
    if (!busqueda.trim()) return true;
    const termino = busqueda.toLowerCase();
    return (
      item.codigo?.toLowerCase().includes(termino) ||
      item.nombre?.toLowerCase().includes(termino) ||
      item.lote?.toLowerCase().includes(termino) ||
      item.numero_lote?.toLowerCase().includes(termino)
    );
  });

  const listaCategorias = [
    "Todas",
    "Medicamentos",
    "Biológicos",
    "Insumos",
    "Dispositivos",
    "Diagnóstico",
    "EPP",
  ];

  const itemsTabla =
    !categoriaSeleccionada || categoriaSeleccionada === "Todas"
      ? baseDatosFiltrada
      : baseDatosFiltrada.filter(
          (item) =>
            item.categoria?.toLowerCase().trim() === categoriaSeleccionada.toLowerCase().trim(),
        );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        padding: "24px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        backgroundColor: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      {/* 1. Header principal */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#1e293b", margin: 0 }}>
            Control de Inventario
          </h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0 0" }}>
            Trazabilidad multi-bodega • Lote y serie • Alertas de caducidad
          </p>
        </div>

        {esAdmin && (
          <div style={{ display: "flex", gap: "8px" }}>
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

            {/* Botón de Registrar Salida (Issue #157) */}
            <button
              onClick={() => setModalSalidaAbierto(true)}
              style={{
                padding: "10px 20px",
                borderRadius: "9999px",
                border: "none",
                backgroundColor: "#059669", // Tono ámbar distintivo para salidas
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              + Registrar Salida
            </button>

            {tabActiva === "catalogo" ? (
              <button
                type="button"
                onClick={abrirModalNuevo}
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
                  backgroundColor: "#059669",
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

      {/* 2. Pestañas de Navegación Módulo */}
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

      {/* 3. Métricas Principales */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <div style={cardMetricStyle}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: "#10b981",
              letterSpacing: "0.5px",
            }}
          >
            REFERENCIAS
          </span>
          <h2
            style={{ fontSize: "28px", fontWeight: "800", margin: "4px 0 0 0", color: "#059669" }}
          >
            {inventarioRaw.length || 10}
          </h2>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>en catálogo</span>
        </div>

        <div style={cardMetricStyle}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: "#f59e0b",
              letterSpacing: "0.5px",
            }}
          >
            POR VENCER
          </span>
          <h2
            style={{ fontSize: "28px", fontWeight: "800", margin: "4px 0 0 0", color: "#d97706" }}
          >
            {alertasCriticas.length || 2}
          </h2>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>≤ 60 días</span>
        </div>

        <div style={cardMetricStyle}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: "#ec4899",
              letterSpacing: "0.5px",
            }}
          >
            SIN STOCK
          </span>
          <h2
            style={{ fontSize: "28px", fontWeight: "800", margin: "4px 0 0 0", color: "#db2777" }}
          >
            1
          </h2>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>agotados</span>
        </div>

        <div style={cardMetricStyle}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: "#06b6d4",
              letterSpacing: "0.5px",
            }}
          >
            VALOR INVENTARIO
          </span>
          <h2
            style={{ fontSize: "28px", fontWeight: "800", margin: "4px 0 0 0", color: "#0891b2" }}
          >
            Q 215,039
          </h2>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>stock actual</span>
        </div>
      </div>

      {/* 4. Sección Alertas de Caducidad */}
      <div
        style={{
          backgroundColor: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: "16px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#f59e0b" }}
          />
          <span
            style={{
              fontSize: "11px",
              fontWeight: "800",
              color: "#d97706",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
            }}
          >
            ALERTAS DE CADUCIDAD
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {alertasParaMostrar.map((item) => (
            <div
              key={item.id}
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "10px",
                padding: "12px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
              }}
            >
              <div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b" }}>
                  {item.medicamento?.nombre}
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                  {item.codigo || "FAR-0000"} • Lote {item.numero_lote || item.lote}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    justifyContent: "flex-end",
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: "700",
                      color: item.bodega === "SUR" ? "#d97706" : "#059669",
                      backgroundColor: item.bodega === "SUR" ? "#fef3c7" : "#d1fae5",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    {item.bodega || "CENTRAL"}
                  </span>
                  <span style={{ fontSize: "14px", fontWeight: "800", color: "#d97706" }}>
                    {item.diasRestantes}d
                  </span>
                </div>
                <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>
                  {item.fechaCaducidad || item.fecha_vencimiento || "27 jul 2024"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Buscador y Filtro de Bodegas */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Código, descripción o lote..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{
            flex: 1,
            padding: "10px 18px",
            borderRadius: "9999px",
            border: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
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
          {["Todas", "Central", "Norte", "Sur"].map((b) => {
            const esActivo =
              bodegaSeleccionada?.toLowerCase() === b.toLowerCase() ||
              (b === "Todas" && !bodegaSeleccionada);
            return (
              <button
                key={b}
                onClick={() => setBodegaSeleccionada(b === "Todas" ? "" : b)}
                style={{
                  padding: "6px 16px",
                  borderRadius: "9999px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: esActivo ? "700" : "500",
                  backgroundColor: esActivo ? "#d1fae5" : "transparent",
                  color: esActivo ? "#065f46" : "#64748b",
                }}
              >
                {b.toLowerCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Píldoras de Categorías */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
        {listaCategorias.map((cat) => {
          const esActiva =
            categoriaSeleccionada === cat || (!categoriaSeleccionada && cat === "Todas");

          return (
            <button
              key={cat}
              onClick={() => setCategoriaSeleccionada(cat)}
              style={{
                padding: "8px 22px",
                borderRadius: "9999px",
                border: esActiva ? "1.5px solid #a7f3d0" : "1.5px solid #e2e8f0",
                backgroundColor: esActiva ? "#ecfdf5" : "#ffffff",
                color: esActiva ? "#059669" : "#64748b",
                fontSize: "13px",
                fontWeight: esActiva ? "700" : "500",
                cursor: "pointer",
                transition: "all 0.15s ease",
                outline: "none",
                boxShadow: esActiva ? "0 1px 2px rgba(5, 150, 105, 0.05)" : "none",
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* 7. Tabla de Catálogo */}
      {tabActiva === "catalogo" && (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "20px",
            border: "1px solid #f1f5f9",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: "#fafafa" }}>
                  <th style={{ ...thStyle, textAlign: "left", paddingLeft: "24px" }}>CÓDIGO</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>DESCRIPCIÓN</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>CATEGORÍA</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>LOTE / SERIE</th>
                  <th style={thStyle}>BODEGA</th>
                  <th style={thStyle}>CADUCIDAD</th>
                  <th style={thStyle}>STOCK</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>P. UNIT.</th>
                  <th style={thStyle}>ESTADO</th>
                  {esAdmin && <th style={thStyle}>ACCIONES</th>}
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td
                      colSpan={esAdmin ? 10 : 9}
                      style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}
                    >
                      Cargando inventario...
                    </td>
                  </tr>
                ) : itemsTabla.length === 0 ? (
                  <tr>
                    <td
                      colSpan={esAdmin ? 10 : 9}
                      style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}
                    >
                      No se encontraron productos coincidentes.
                    </td>
                  </tr>
                ) : (
                  itemsTabla.map((item, index) => {
                    const bodegaColor =
                      item.bodega === "SUR"
                        ? "#f59e0b"
                        : item.bodega === "NORTE"
                          ? "#0284c7"
                          : "#059669";

                    const badgeEstado = getBadgeEstado(
                      item.estado || item.estadoAlerta,
                      item.stock,
                    );

                    return (
                      <tr
                        key={item.id || index}
                        style={{
                          borderBottom:
                            index === itemsTabla.length - 1 ? "none" : "1px solid #f8fafc",
                        }}
                      >
                        {/* CÓDIGO */}
                        <td style={{ ...tdStyle, textAlign: "left", paddingLeft: "24px" }}>
                          <span
                            style={{
                              color: "#059669",
                              fontWeight: "700",
                              fontSize: "12px",
                              letterSpacing: "0.3px",
                            }}
                          >
                            {item.codigo || "FAR-0041"}
                          </span>
                        </td>

                        {/* DESCRIPCIÓN */}
                        <td style={{ ...tdStyle, textAlign: "left" }}>
                          <span style={{ color: "#1e293b", fontWeight: "700" }}>{item.nombre}</span>
                        </td>

                        {/* CATEGORÍA */}
                        <td style={{ ...tdStyle, textAlign: "left", color: "#94a3b8" }}>
                          {item.categoria || "Medicamentos"}
                        </td>

                        {/* LOTE / SERIE */}
                        <td style={{ ...tdStyle, textAlign: "left" }}>
                          <span style={{ color: "#0284c7", fontWeight: "600" }}>
                            {item.lote || item.numero_lote || "N/A"}
                          </span>
                        </td>

                        {/* BODEGA */}
                        <td style={tdStyle}>
                          <span
                            style={{
                              color: bodegaColor,
                              fontWeight: "800",
                              fontSize: "11px",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {item.bodega || "CENTRAL"}
                          </span>
                        </td>

                        {/* CADUCIDAD */}
                        <td style={tdStyle}>
                          {item.caducidad && item.caducidad !== "N/A" ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: "600",
                                  color: item.esCritico
                                    ? "#db2777"
                                    : item.esPorVencer
                                      ? "#d97706"
                                      : "#64748b",
                                }}
                              >
                                {item.caducidad}
                              </span>
                              {item.diasCaducidad && (
                                <span
                                  style={{
                                    fontSize: "10px",
                                    color: item.esCritico ? "#db2777" : "#d97706",
                                  }}
                                >
                                  {item.diasCaducidad}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: "#cbd5e1" }}>N/A</span>
                          )}
                        </td>

                        {/* STOCK */}
                        <td style={tdStyle}>
                          <span
                            style={{
                              color: item.stock === 0 ? "#94a3b8" : "#0f172a",
                              fontWeight: "800",
                            }}
                          >
                            {item.stock ?? 0}
                          </span>{" "}
                          <span style={{ color: "#94a3b8", fontSize: "11px" }}>
                            {item.unidad || item.unidadPresentacion || "Cajas"}
                          </span>
                        </td>

                        {/* P. UNIT. */}
                        <td style={{ ...tdStyle, textAlign: "right", color: "#64748b" }}>
                          Q {item.precio || item.precioUnitario || "143"}
                        </td>

                        {/* ESTADO */}
                        <td style={tdStyle}>
                          <span
                            style={{
                              padding: "4px 14px",
                              borderRadius: "9999px",
                              fontSize: "10px",
                              fontWeight: "800",
                              letterSpacing: "0.5px",
                              textTransform: "uppercase",
                              backgroundColor: badgeEstado.bg,
                              color: badgeEstado.color,
                              border: `1px solid ${badgeEstado.border}`,
                              display: "inline-block",
                            }}
                          >
                            {badgeEstado.label}
                          </span>
                        </td>

                        {/* ACCIONES */}
                        {esAdmin && (
                          <td style={tdStyle}>
                            <button
                              onClick={() => abrirModalEditar(item)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: "6px",
                                border: "1px solid #cbd5e1",
                                backgroundColor: "#ffffff",
                                color: "#475569",
                                fontSize: "12px",
                                fontWeight: "600",
                                cursor: "pointer",
                              }}
                            >
                              Editar
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modales */}
      {modalAbierto && (
        <ModalMedicamento
          abierto={modalAbierto}
          modoEdicion={modoEdicion}
          cargandoGuardar={cargandoGuardar}
          formData={formData}
          setFormData={setFormData}
          principiosActivos={principiosActivos}
          advertenciaDuplicado={advertenciaDuplicado}
          onClose={() => setModalAbierto(false)}
          onGuardar={handleGuardarMedicamento}
          onCrearPrincipioActivo={handleCrearPrincipioActivo}
        />
      )}

      {/* Renderizado del Modal de Salida (Issue #157) */}
      <ModalSalidaMedicamento
        abierto={modalSalidaAbierto}
        onClose={() => setModalSalidaAbierto(false)}
        medicamentos={inventarioRaw}
      />

      {modalAltaLoteAbierto && (
        <ModalAltaLote
          abierto={modalAltaLoteAbierto}
          onClose={() => setModalAltaLoteAbierto(false)}
          onGuardar={handleGuardarLote}
          errorValidacion={errorLotes}
          medicamentos={inventarioRaw}
          bodegas={bodegas}
          proveedores={proveedores}
        />
      )}

      {alertaSeleccionada && (
        <ModalAtenderAlerta
          alerta={alertaSeleccionada}
          onClose={() => setAlertaSeleccionada(null)}
          onResolver={handleResolverAlerta}
        />
      )}

      {modalRegistroIngresoAbierto && (
        <ModalRegistroIngreso
          abierto={modalRegistroIngresoAbierto}
          onClose={() => setModalRegistroIngresoAbierto(false)}
          catalogos={{
            medicamentos: inventarioRaw, // <-- Asegúrate de pasar tu estado con los medicamentos aquí
            bodegas: bodegas, // <-- Y las bodegas aquí
            donaciones: donaciones,
          }}
          onExito={cargarDatos}
          onGuardar={handleGuardarIngresoDonacion}
        />
      )}
    </div>
  );
}
