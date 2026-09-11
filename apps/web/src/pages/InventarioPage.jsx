import { useState, useEffect } from "react";
import React from "react";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { useNavigate } from "react-router-dom";
import ModalMedicamento from "./ModalMedicamento.jsx";
import ModalPrincipioActivo from "./ModalPrincipioActivo.jsx";
import { ModalAltaLote } from "./ModalAltaLote.jsx";
import ModalRegistroIngreso from "./ModalRegistroIngreso.jsx";
import { ModalSalidaMedicamento } from "./ModalSalidaMedicamento";
import BandejaValidacionPage from "./BandejaValidacionPage";
import { useVistaExistencias } from "../../../../packages/shared/inventario/useVistaExistencias.js";
import PanelAlertasVencimiento from "./PanelAlertasVencimiento.jsx";
import AdministracionBodegasProveedoresPage from "./AdministracionBodegasProveedoresPage.jsx";
import { useAlertasVencimiento } from "../../../../packages/shared/inventario/useAlertasVencimiento.js";
import KardexMovimientosPage from "./KardexMovimientosPage.jsx";

// API Medicamentos y Principios Activos
import {
  listarMedicamentos,
  registrarMedicamento,
  actualizarMedicamento,
  listarPrincipiosDeMedicamento,
} from "../../../../packages/shared/inventario/medicamentos.api.js";
import { listarBodegas } from "../../../../packages/shared/inventario/bodegas.api.js";
import { listarProveedores } from "../../../../packages/shared/inventario/proveedores.api.js";
import { listarLotes, registrarLote } from "../../../../packages/shared/inventario/lotes.api.js";
import {
  listarPrincipiosActivos,
  registrarPrincipioActivo,
} from "../../../../packages/shared/inventario/principios-activos.api.js";

import { usePendientesValidacion } from "../../../../packages/shared/inventario/usePendientesValidacion.js";
import { useCatalogoMedicamentos } from "../../../../packages/shared/inventario/useCatalogoMedicamentos.js";
import {
  useGestionLotes,
  datosLoteParaRegistrar,
} from "../../../../packages/shared/inventario/useGestionLotes.js";
import { esAdministrador } from "../../../../packages/shared/usuarios/roles.js";

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
  const navigate = useNavigate();
  const [tabActiva, setTabActiva] = useState("catalogo");
  const [inventarioRaw, setInventarioRaw] = useState([]);
  const [principiosActivos, setPrincipiosActivos] = useState([]);
  const [lotesRaw, setLotesRaw] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Modales Medicamentos
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [cargandoGuardar, setCargandoGuardar] = useState(false);
  const [modalPrincipioActivoAbierto, setModalPrincipioActivoAbierto] = useState(false);
  const [advertenciaDuplicado, setAdvertenciaDuplicado] = useState(false);
  // Un fallo al guardar se pinta dentro del modal, como ya hace ModalAltaLote con
  // errorValidacion. Antes era un alert() del navegador (issue #762).
  const [errorGuardarMedicamento, setErrorGuardarMedicamento] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    principio_activo_id: "",
    concentracion: "",
    presentacion: "",
    marca: "",
    formaFarmaceutica: "",
  });

  // Solo se usa el conteo, para el indicador de la pestaña: el resto de este hook -busqueda,
  // filtros, porVencer/vencidas- lo vuelve a calcular PanelAlertasVencimiento.jsx con su propia
  // llamada a useAlertasVencimiento(), que es la que de verdad se pinta en pantalla.
  const { cantidadPendientes: cantidadPendientesAlertas } = useAlertasVencimiento({
    lotes: lotesRaw,
    bodegas: bodegas,
  });

  // Modales Lotes y Alertas
  const [modalAltaLoteAbierto, setModalAltaLoteAbierto] = useState(false);
  const [modalSalidaAbierto, setModalSalidaAbierto] = useState(false);
  const [modalRegistroIngresoAbierto, setModalRegistroIngresoAbierto] = useState(false);

  // issue #689: esAdmin/usuarioActual eran un usuario de prueba escrito a mano ("Administrador",
  // con mayuscula, y un id que no era un UUID). rolUsuario viajaba tal cual a
  // aprobarMovimiento()/rechazarMovimiento() (validacion.api.js), que comparan contra
  // esAdministrador(rolUsuario) -- el enum rol_usuario (00001) y usuarios/roles.js lo declaran
  // en minuscula ("administrador") -- asi que esa comparacion nunca coincidia y la bandeja de
  // validacion no aprobaba ni rechazaba nada, ni para la administradora real.
  const { perfil, rol } = useSesionCompartida();
  const esAdmin = esAdministrador(rol);
  const usuarioActual = { id: perfil?.id, rol };

  const { conteo } = usePendientesValidacion({
    usuarioId: perfil?.id,
    rolUsuario: rol,
  });

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
    alertasCriticas,
    validarNuevoLote,
    errorValidacion: errorLotes,
    setErrorValidacion: setErrorLotes,
  } = useGestionLotes({
    lotesIniciales: lotesRaw,
    bodegas,
    proveedores,
    usuario: usuarioActual,
  });

  const {
    medicamentos,
    columnas,
    busqueda: busquedaLotes,
    setBusqueda: setBusquedaLotes,
    filtroBodega,
    setFiltroBodega,
    filtroEstado,
    setFiltroEstado,
    ocultarSinExistencia,
    setOcultarSinExistencia,
    limpiarFiltros,
    filasExpandidas,
    toggleExpandir,
    ESTADO_EXISTENCIA,
  } = useVistaExistencias({
    existencias: Array.isArray(lotesRaw) ? lotesRaw : [],
    bodegas: Array.isArray(bodegas) ? bodegas.map((b) => b.nombre || b) : [],
  });

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError(null);
      const [resMed, resPA, resBodegas, resProveedores, resLotes] = await Promise.all([
        listarMedicamentos(),
        listarPrincipiosActivos(),
        listarBodegas(),
        listarProveedores(),
        listarLotes(),
      ]);

      // Los cinco fallos tienen que llegar a la pantalla. Antes solo lo hacia el de medicamentos:
      // los otros cuatro se escribian en la consola y la pestana seguia como si nada, con el
      // desplegable de bodegas vacio o el kardex sin lotes y sin decir por que. Es el fallo
      // silencioso que describe la issue #762: algo no funciona y el sistema dice que si.
      const fallos = [];

      if (resMed.error) fallos.push(["medicamentos", resMed.error]);
      else setInventarioRaw(resMed.medicamentos || []);

      if (resPA.error) fallos.push(["principios activos", resPA.error]);
      else setPrincipiosActivos(resPA.principiosActivos || []);

      if (resBodegas.error) fallos.push(["bodegas", resBodegas.error]);
      else setBodegas(resBodegas.bodegas || []);

      if (resProveedores.error) fallos.push(["proveedores", resProveedores.error]);
      else setProveedores(resProveedores.proveedores || []);

      if (resLotes.error) fallos.push(["lotes", resLotes.error]);
      else setLotesRaw(resLotes.lotes || []);

      if (fallos.length > 0) {
        // `detalle` y no el error entero: normalizarError() ya lo saneo para el log, y el objeto
        // crudo puede traer datos de la fila que fallo (regla de confidencialidad de AGENTS.md).
        for (const [recurso, fallo] of fallos) {
          console.error(`Error cargando ${recurso}:`, fallo.detalle);
        }

        // Un solo mensaje para todos: en la practica los cinco fallan por la misma causa -red
        // caida, sesion expirada- y `mensaje` ya es el texto que se le ensena a una persona.
        const recursos = fallos.map(([recurso]) => recurso).join(", ");
        setError(`No se pudo cargar: ${recursos}. ${fallos[0][1].mensaje ?? ""}`.trim());
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
    setErrorGuardarMedicamento(null);
    setModalAbierto(true);
  };

  const abrirModalEditar = async (item) => {
    setModoEdicion(true);
    setFormData({
      id: item.id,
      nombre: item.nombre || "",
      // listarMedicamentos() no trae la relacion con principios_activos: se llena abajo, en
      // cuanto listarPrincipiosDeMedicamento() resuelva.
      principio_activo_id: "",
      concentracion: item.concentracion || "",
      presentacion: item.presentacion || "",
      marca: item.marca || "",
      formaFarmaceutica: item.formaFarmaceutica || item.forma_farmaceutica || "",
    });
    setAdvertenciaDuplicado(false);
    setErrorGuardarMedicamento(null);
    setModalAbierto(true);

    const { principiosActivos: asociados } = await listarPrincipiosDeMedicamento(item.id);
    if (asociados[0]) {
      setFormData((prev) => ({ ...prev, principio_activo_id: asociados[0].id }));
    }
  };

  const handleGuardarPrincipioActivoNuevo = async (_id, datos) => {
    const { principioActivo, error: errorPA } = await registrarPrincipioActivo(datos);
    if (errorPA) return { ok: false, error: errorPA };

    setPrincipiosActivos((prev) => [...prev, principioActivo]);
    setFormData((prev) => ({ ...prev, principio_activo_id: principioActivo.id }));
    return { ok: true, principioActivo };
  };

  const normalizarPresentacion = (valor) => {
    if (!valor) return "";
    return valor
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  };

  const handleGuardarMedicamento = async () => {
    setErrorGuardarMedicamento(null);
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
          setErrorGuardarMedicamento(
            errorUpdate.mensaje || "No se pudo actualizar el medicamento.",
          );
          return;
        }
      } else {
        if (!formData.principio_activo_id) {
          setErrorGuardarMedicamento("Debes seleccionar un principio activo.");
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
          setErrorGuardarMedicamento(errorReg.mensaje || "No se pudo registrar el medicamento.");
          return;
        }
      }
      setModalAbierto(false);
      await cargarDatos();
    } catch (err) {
      console.error("Error inesperado:", err);
      setErrorGuardarMedicamento("Error de comunicación con el servidor.");
    } finally {
      setCargandoGuardar(false);
    }
  };

  const handleGuardarLote = async (datosLote) => {
    if (!validarNuevoLote(datosLote)) return;

    const { error: errorRegistro } = await registrarLote(datosLoteParaRegistrar(datosLote));

    if (errorRegistro) {
      setErrorLotes(errorRegistro.mensaje);
      return;
    }

    setModalAltaLoteAbierto(false);
    cargarDatos();
  };

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

        {esAdmin &&
          tabActiva !== "validacion" &&
          tabActiva !== "administracion" &&
          tabActiva !== "kardex" && (
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
              <button
                onClick={() => setModalSalidaAbierto(true)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "9999px",
                  border: "none",
                  backgroundColor: "#b45309",
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
              ) : tabActiva === "lotes" ? (
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
              ) : null}
            </div>
          )}
      </div>

      {/* 2. Pestañas de Navegación */}
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
            borderBottom: tabActiva === "lotes" ? "2px solid #10b981" : "2px solid transparent",
            color: tabActiva === "lotes" ? "#10b981" : "#64748b",
          }}
        >
          Lotes y Caducidades
        </button>
        <button
          onClick={() => setTabActiva("alertas")}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: "700",
            border: "none",
            background: "none",
            cursor: "pointer",
            borderBottom: tabActiva === "alertas" ? "2px solid #f59e0b" : "2px solid transparent",
            color: tabActiva === "alertas" ? "#d97706" : "#64748b",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>Alertas de Vencimiento</span>
          {cantidadPendientesAlertas > 0 && (
            <span
              style={{
                backgroundColor: "#fef3c7",
                color: "#92400e",
                fontSize: "11px",
                padding: "2px 8px",
                borderRadius: "9999px",
                fontWeight: "800",
              }}
            >
              {cantidadPendientesAlertas}
            </span>
          )}
        </button>
        {/* ✅ Pestaña Kardex agregada en la barra */}
        <button
          onClick={() => setTabActiva("kardex")}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: "700",
            border: "none",
            background: "none",
            cursor: "pointer",
            borderBottom: tabActiva === "kardex" ? "2px solid #0284c7" : "2px solid transparent",
            color: tabActiva === "kardex" ? "#0284c7" : "#64748b",
          }}
        >
          Kardex Movimientos
        </button>
        <button
          onClick={() => setTabActiva("administracion")}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: "700",
            border: "none",
            background: "none",
            cursor: "pointer",
            borderBottom:
              tabActiva === "administracion" ? "2px solid #6366f1" : "2px solid transparent",
            color: tabActiva === "administracion" ? "#4f46e5" : "#64748b",
          }}
        >
          Administración
        </button>
        <button
          onClick={() => navigate("/inventario/principios-activos")}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: "700",
            border: "none",
            background: "none",
            cursor: "pointer",
            borderBottom: "2px solid transparent",
            color: "#64748b",
          }}
        >
          Principios Activos
        </button>
        <button
          onClick={() => setTabActiva("validacion")}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: "700",
            border: "none",
            background: "none",
            cursor: "pointer",
            borderBottom:
              tabActiva === "validacion" ? "2px solid #10b981" : "2px solid transparent",
            color: tabActiva === "validacion" ? "#10b981" : "#64748b",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>Validación</span>
          {conteo > 0 && (
            <span
              style={{
                backgroundColor: "#fbbf24",
                color: "#78350f",
                fontSize: "11px",
                padding: "2px 8px",
                borderRadius: "9999px",
                fontWeight: "800",
              }}
            >
              {conteo}
            </span>
          )}
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

      {/* Catálogo */}
      {tabActiva === "catalogo" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
            }}
          >
            <div style={cardMetricStyle}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#10b981" }}>
                REFERENCIAS
              </span>
              <h2
                style={{
                  fontSize: "28px",
                  fontWeight: "800",
                  margin: "4px 0 0 0",
                  color: "#059669",
                }}
              >
                {inventarioRaw.length || 10}
              </h2>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>en catálogo</span>
            </div>
            <div style={cardMetricStyle}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#f59e0b" }}>
                POR VENCER
              </span>
              <h2
                style={{
                  fontSize: "28px",
                  fontWeight: "800",
                  margin: "4px 0 0 0",
                  color: "#d97706",
                }}
              >
                {alertasCriticas.length || 2}
              </h2>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>≤ 60 días</span>
            </div>
            <div style={cardMetricStyle}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#ec4899" }}>
                SIN STOCK
              </span>
              <h2
                style={{
                  fontSize: "28px",
                  fontWeight: "800",
                  margin: "4px 0 0 0",
                  color: "#db2777",
                }}
              >
                1
              </h2>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>agotados</span>
            </div>
            <div style={cardMetricStyle}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#06b6d4" }}>
                VALOR INVENTARIO
              </span>
              <h2
                style={{
                  fontSize: "28px",
                  fontWeight: "800",
                  margin: "4px 0 0 0",
                  color: "#0891b2",
                }}
              >
                Q 215,039
              </h2>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>stock actual</span>
            </div>
          </div>

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
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#f59e0b",
                }}
              />
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#d97706" }}>
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
                    <span style={{ fontSize: "14px", fontWeight: "800", color: "#d97706" }}>
                      {item.diasRestantes}d
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

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
          </div>

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
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "20px",
              border: "1px solid #f1f5f9",
              overflow: "hidden",
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
                      const badgeEstado = getBadgeEstado(
                        item.estado || item.estadoAlerta,
                        item.stock,
                      );
                      return (
                        <tr key={item.id || index} style={{ borderBottom: "1px solid #f8fafc" }}>
                          <td style={{ ...tdStyle, textAlign: "left", paddingLeft: "24px" }}>
                            <span style={{ color: "#059669", fontWeight: "700" }}>
                              {item.codigo || "FAR-0041"}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "left" }}>
                            <span style={{ color: "#1e293b", fontWeight: "700" }}>
                              {item.nombre}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "left", color: "#94a3b8" }}>
                            {item.categoria || "Medicamentos"}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "left" }}>
                            <span style={{ color: "#0284c7", fontWeight: "600" }}>
                              {item.lote || item.numero_lote || "N/A"}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontWeight: "800", fontSize: "11px" }}>
                              {item.bodega || "CENTRAL"}
                            </span>
                          </td>
                          <td style={tdStyle}>{item.caducidad || "N/A"}</td>
                          <td style={tdStyle}>
                            <span style={{ fontWeight: "800" }}>{item.stock ?? 0}</span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            Q {item.precio || "143"}
                          </td>
                          <td style={tdStyle}>
                            <span
                              style={{
                                padding: "4px 14px",
                                borderRadius: "9999px",
                                fontSize: "10px",
                                fontWeight: "800",
                                backgroundColor: badgeEstado.bg,
                                color: badgeEstado.color,
                                border: `1px solid ${badgeEstado.border}`,
                              }}
                            >
                              {badgeEstado.label}
                            </span>
                          </td>
                          {esAdmin && (
                            <td style={tdStyle}>
                              <button
                                onClick={() => abrirModalEditar(item)}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  border: "1px solid #cbd5e1",
                                  backgroundColor: "#ffffff",
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
        </>
      )}

      {/* Pestaña: Lotes */}
      {tabActiva === "lotes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Buscar medicamento, lote o código..."
              value={busquedaLotes}
              onChange={(e) => setBusquedaLotes(e.target.value)}
              style={{
                flex: 1,
                padding: "10px 16px",
                borderRadius: "9999px",
                border: "1px solid #e2e8f0",
                fontSize: "13px",
              }}
            />
            <select
              value={filtroBodega}
              onChange={(e) => setFiltroBodega(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: "12px", border: "1px solid #e2e8f0" }}
            >
              <option value="todas">Todas las bodegas</option>
              {bodegas.map((b, i) => (
                <option key={i} value={b.nombre || b}>
                  {b.nombre || b}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "16px",
              border: "1px solid #f1f5f9",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: "#fafafa" }}>
                  {columnas.map((col, i) => (
                    <th
                      key={i}
                      style={{
                        padding: "12px 16px",
                        textAlign: col.alineacion === "derecha" ? "right" : "left",
                      }}
                    >
                      {col.etiqueta}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {medicamentos.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #f8fafc" }}>
                    <td style={{ padding: "14px 16px" }}>{item.nombre}</td>
                    <td style={{ padding: "14px 16px" }}>{item.concentracion}</td>
                    <td style={{ padding: "14px 16px" }}>{item.presentacion}</td>
                    <td style={{ padding: "14px 16px" }}>{item.marca}</td>
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>{item.stockTotal}</td>
                    <td style={{ padding: "14px 16px" }}>
                      {item.fechaVencimientoMasProxima
                        ? new Date(item.fechaVencimientoMasProxima).toLocaleDateString("es-GT")
                        : "Sin fecha"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>{item.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pestaña: Alertas completada mediante PanelAlertasVencimiento */}
      {tabActiva === "alertas" && (
        <PanelAlertasVencimiento
          lotes={lotesRaw}
          bodegas={bodegas}
          usuarioId={usuarioActual?.id}
          rolUsuario={usuarioActual?.rol}
        />
      )}

      {/* Pestaña: Kardex Movimientos */}
      {tabActiva === "kardex" && <KardexMovimientosPage titulo="Historial de Movimientos" />}

      {/* Pestaña: Administración */}
      {tabActiva === "administracion" && <AdministracionBodegasProveedoresPage />}

      {/* Pestaña: Validación */}
      {tabActiva === "validacion" && (
        <BandejaValidacionPage usuarioId={perfil?.id} rolUsuario={rol} />
      )}

      {/* Modales */}
      {modalAbierto && (
        <ModalMedicamento
          isOpen={modalAbierto}
          modoEdicion={modoEdicion}
          cargando={cargandoGuardar}
          formData={formData}
          setFormData={setFormData}
          principiosActivos={principiosActivos}
          advertenciaDuplicado={advertenciaDuplicado}
          error={errorGuardarMedicamento}
          onSubmit={handleGuardarMedicamento}
          onClose={() => setModalAbierto(false)}
          onCrearPrincipioActivo={() => setModalPrincipioActivoAbierto(true)}
        />
      )}

      {modalPrincipioActivoAbierto && (
        <ModalPrincipioActivo
          visible
          principioActivo={null}
          onClose={() => setModalPrincipioActivoAbierto(false)}
          onGuardar={handleGuardarPrincipioActivoNuevo}
          onEliminar={async () => ({ ok: false })}
        />
      )}

      <ModalSalidaMedicamento
        abierto={modalSalidaAbierto}
        onClose={() => setModalSalidaAbierto(false)}
        medicamentos={inventarioRaw}
        usuarioId={usuarioActual?.id}
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

      {modalRegistroIngresoAbierto && (
        <ModalRegistroIngreso
          abierto={modalRegistroIngresoAbierto}
          onClose={() => setModalRegistroIngresoAbierto(false)}
          catalogos={{
            medicamentos: inventarioRaw,
            bodegas: bodegas,
            proveedores: proveedores,
          }}
          onExito={cargarDatos}
          usuarioId={usuarioActual?.id}
        />
      )}
    </div>
  );
}
