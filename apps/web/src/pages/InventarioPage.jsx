import { useEffect, useMemo, useState } from "react";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalMedicamento from "./ModalMedicamento.jsx";
import ModalPrincipioActivo from "./ModalPrincipioActivo.jsx";
import { ModalAltaLote } from "./ModalAltaLote.jsx";
import ModalRegistroIngreso from "./ModalRegistroIngreso.jsx";
import { ModalSalidaMedicamento } from "./ModalSalidaMedicamento";
import BandejaValidacionPage from "./BandejaValidacionPage";
import {
  actualizarLote,
  actualizarMedicamento,
  datosLoteParaRegistrar,
  ETIQUETAS_PRESENTACION,
  filtrarCatalogoMedicamentos,
  FILTROS_CATALOGO_MEDICAMENTOS,
  FILTROS_CATALOGO_VACIOS,
  formatearFechaCorta,
  hayFiltrosDeCatalogo,
  resumirLotesPorMedicamento,
  desactivarMedicamento,
  esAdministrador,
  ETIQUETAS_ORIGEN_LOTE,
  formatearMoneda,
  listarBodegas,
  listarLotes,
  listarMedicamentos,
  listarPrincipiosActivos,
  listarPrincipiosDeMedicamento,
  listarProveedores,
  obtenerValorDeInventario,
  puedeCorregirLote,
  puedeRegistrarMovimiento,
  puedeVerValorizacion,
  reactivarMedicamento,
  registrarLote,
  registrarMedicamento,
  registrarPrincipioActivo,
  totalizarValorizacion,
  useAlertasVencimiento,
  useGestionLotes,
  usePendientesValidacion,
} from "@ecopac/shared";
import { Form, Nav, Table } from "react-bootstrap";
import PrimaryButton from "../components/PrimaryButton";
import Selector from "../components/Selector";
import TextField from "../components/TextField";
import FilterBar from "../components/FilterBar";
import SecondaryButton from "../components/SecondaryButton";
import StatusChip from "../components/StatusChip";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import StatCard from "../components/StatCard";
import PanelAlertasVencimiento from "./PanelAlertasVencimiento.jsx";
import AdministracionBodegasProveedoresPage from "./AdministracionBodegasProveedoresPage.jsx";
import KardexMovimientosPage from "./KardexMovimientosPage.jsx";
import CatalogoPrincipiosActivosPage from "./CatalogoPrincipiosActivosPage.jsx";
import MisMovimientosPage from "./MisMovimientosPage.jsx";

export default function InventarioPage() {
  const [tabActiva, setTabActiva] = useState("catalogo");
  const [inventarioRaw, setInventarioRaw] = useState([]);
  const [principiosActivos, setPrincipiosActivos] = useState([]);
  const [lotesRaw, setLotesRaw] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  // Valor monetario del inventario disponible (issue #752): solo administracion y los roles
  // consultivos lo reciben (fn_valor_de_inventario_disponible, 00122). Se guarda ya totalizado
  // -no la lista completa por bodega/medicamento/origen, que esta pantalla no necesita- porque el
  // unico uso hoy es la tarjeta "VALOR INVENTARIO" del panel de indicadores.
  const [valorizacion, setValorizacion] = useState(null);
  // Corregir el costo de un lote (issue #752): id del lote cuya fila esta en modo edicion, y el
  // texto que se esta escribiendo. Solo uno a la vez, igual que el resto de ediciones inline de
  // esta pantalla.
  const [loteEnCorreccion, setLoteEnCorreccion] = useState(null);
  const [costoEnEdicion, setCostoEnEdicion] = useState("");
  const [guardandoCosto, setGuardandoCosto] = useState(false);
  const [errorCorreccionCosto, setErrorCorreccionCosto] = useState(null);

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
  // porVencer/vencidas- lo vuelve a calcular PanelAlertasVencimiento.jsx con su propia llamada a
  // useAlertasVencimiento(), que es la que de verdad se pinta en pantalla. Las dos llamadas leen
  // alertas_caducidad de forma independiente (mismo patron que usePendientesValidacion() en la
  // bandeja de validacion), no derivan el conteo de lotesRaw.
  const { cantidadPendientes: cantidadPendientesAlertas } = useAlertasVencimiento({});

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

  const [filtrosCatalogo, setFiltrosCatalogo] = useState(FILTROS_CATALOGO_VACIOS);

  const {
    alertasCriticas,
    validarNuevoLote,
    errorValidacion: errorLotes,
    setErrorValidacion: setErrorLotes,
    erroresDeLote,
  } = useGestionLotes({
    lotesIniciales: lotesRaw,
    bodegas,
    proveedores,
    usuario: usuarioActual,
  });

  // Busqueda y filtro por origen de la pestaña "Lotes" (issue #752): la tabla se arma directo
  // contra lotesRaw -la forma real de aLote() (lotes.api.js)-, ya no contra useVistaExistencias(),
  // que agrupaba por medicamento y esperaba campos que un lote no tiene (bodega, entre otros: un
  // lote no vive en una sola bodega, eso lo decide existencias). "todas" es el valor inicial del
  // selector de origen, no una etiqueta de ETIQUETAS_ORIGEN_LOTE.
  const [busquedaLotes, setBusquedaLotes] = useState("");
  const [filtroBodega, setFiltroBodega] = useState("todas");

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError(null);
      const [resMed, resPA, resBodegas, resProveedores, resLotes] = await Promise.all([
        // soloActivos:false (issue #756): antes el catalogo pedia listarMedicamentos() con su
        // default (soloActivos:true), asi que un medicamento desactivado desaparecia sin
        // ninguna forma de volver a verlo ni de reactivarlo desde la pantalla.
        listarMedicamentos({ soloActivos: false }),
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

      // Aparte del Promise.all: es una consulta distinta (RPC, no una tabla) y solo administracion
      // y los roles consultivos la reciben. Un rol sin acceso no la dispara siquiera -la funcion
      // la rechazaria igual, pero no tiene sentido pedir algo que ya se sabe que va a fallar-, y
      // su fallo no bloquea el resto del catalogo: se ve la pantalla completa sin la tarjeta de
      // valor.
      if (puedeVerValorizacion(rol)) {
        const { valorizacion: filas, error: errorValorizacion } = await obtenerValorDeInventario();
        if (errorValorizacion) {
          console.error(
            "Error cargando la valorizacion del inventario:",
            errorValorizacion.detalle,
          );
        } else {
          setValorizacion(totalizarValorizacion(filas));
        }
      }

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
      esPediatrico: Boolean(item.esPediatrico),
      activo: item.activo ?? true,
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
          esPediatrico: Boolean(formData.esPediatrico),
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

  // desactivarMedicamento()/reactivarMedicamento() existian y estaban probadas pero ningun
  // boton las llamaba (issue #756): un medicamento no se podia dar de baja del catalogo desde
  // ninguna pantalla.
  const handleAlternarActivoMedicamento = async () => {
    setErrorGuardarMedicamento(null);
    setCargandoGuardar(true);
    const { error: errorAlternar } = formData.activo
      ? await desactivarMedicamento(formData.id)
      : await reactivarMedicamento(formData.id);
    setCargandoGuardar(false);

    if (errorAlternar) {
      setErrorGuardarMedicamento(errorAlternar.mensaje);
      return;
    }

    setModalAbierto(false);
    await cargarDatos();
  };

  const handleGuardarLote = async (valores) => {
    if (!validarNuevoLote(valores)) return;

    const { error: errorRegistro } = await registrarLote(datosLoteParaRegistrar(valores));

    if (errorRegistro) {
      setErrorLotes(errorRegistro.mensaje);
      return;
    }

    setModalAltaLoteAbierto(false);
    cargarDatos();
  };

  // Corregir el costo unitario de un lote ya registrado (issue #752). Quien puede corregir lo
  // decide puedeCorregirLote() -espejo de la politica RLS de UPDATE, 00107-, no un rol fijo: la
  // administradora siempre, o quien registro el lote mientras siga provisional.
  const abrirCorreccionCosto = (lote) => {
    setLoteEnCorreccion(lote.id);
    setCostoEnEdicion(lote.costoUnitario === null ? "" : String(lote.costoUnitario));
    setErrorCorreccionCosto(null);
  };

  const cancelarCorreccionCosto = () => {
    setLoteEnCorreccion(null);
    setCostoEnEdicion("");
    setErrorCorreccionCosto(null);
  };

  const guardarCorreccionCosto = async (loteId) => {
    setGuardandoCosto(true);
    setErrorCorreccionCosto(null);

    const { lote, error: errorCorreccion } = await actualizarLote(loteId, {
      costoUnitario: costoEnEdicion === "" ? null : Number(costoEnEdicion),
    });

    setGuardandoCosto(false);

    if (errorCorreccion) {
      setErrorCorreccionCosto(errorCorreccion.mensaje);
      return;
    }

    setLotesRaw((anteriores) => anteriores.map((l) => (l.id === loteId ? lote : l)));
    cancelarCorreccionCosto();
  };

  const lotesFiltrados = lotesRaw.filter((lote) => {
    const texto = busquedaLotes.trim().toLowerCase();
    const coincideTexto =
      texto === "" ||
      lote.medicamento?.toLowerCase().includes(texto) ||
      lote.numeroLote?.toLowerCase().includes(texto);
    const coincideOrigen =
      filtroBodega === "todas" || ETIQUETAS_ORIGEN_LOTE[lote.origen] === filtroBodega;
    return coincideTexto && coincideOrigen;
  });

  // Catalogo: filtros sobre los campos reales del modelo y resumen de lotes por medicamento.
  const resumenDeLotes = useMemo(() => resumirLotesPorMedicamento(lotesRaw), [lotesRaw]);
  const medicamentosVisibles = useMemo(
    () => filtrarCatalogoMedicamentos(inventarioRaw, filtrosCatalogo, resumenDeLotes),
    [inventarioRaw, filtrosCatalogo, resumenDeLotes],
  );

  // Acciones de la cabecera. Eran cuatro <button> con estilos en linea -dos verdes, uno ambar,
  // hexadecimales fuera de la paleta- y el "+" escrito dentro del texto. Ahora son las acciones de
  // PageHeader, que pone el "+" sola y dibuja los botones del catalogo.
  const tabsSinAccionesDeCabecera = ["validacion", "administracion", "kardex"];
  const accionesCabecera =
    esAdmin && !tabsSinAccionesDeCabecera.includes(tabActiva)
      ? [
          {
            label: "Registrar ingreso",
            onClick: () => setModalRegistroIngresoAbierto(true),
          },
          {
            label: "Registrar salida",
            onClick: () => setModalSalidaAbierto(true),
            variant: "secondary",
          },
          ...(tabActiva === "catalogo"
            ? [{ label: "Nuevo medicamento", onClick: abrirModalNuevo }]
            : []),
          ...(tabActiva === "lotes"
            ? [
                {
                  label: "Registrar lote",
                  onClick: () => {
                    setErrorLotes(null);
                    setModalAltaLoteAbierto(true);
                  },
                },
              ]
            : []),
        ]
      : [];

  // Pestanas. Eran nueve <button> con un color de subrayado distinto cada una (#10b981, #f59e0b,
  // #0284c7, #6366f1, #0d9488, #7c3aed): las pastillas de `.nav-tabs` de ui.css son las mismas
  // que usan pacientes, presupuestos y reportes.
  // Rotulos cortos: con los largos ("Catalogo de medicamentos", "Kardex de movimientos") las
  // ocho pestanas no cabian en una fila y "Validacion" caia sola a una segunda linea.
  const pestanas = [
    { id: "catalogo", label: "Catálogo" },
    { id: "lotes", label: "Lotes" },
    { id: "alertas", label: "Alertas", contador: cantidadPendientesAlertas },
    { id: "kardex", label: "Kardex" },
    { id: "administracion", label: "Bodegas y proveedores" },
    { id: "principios-activos", label: "Principios activos" },
    ...(puedeRegistrarMovimiento(rol) ? [{ id: "mis-movimientos", label: "Mis movimientos" }] : []),
    { id: "validacion", label: "Validación", contador: conteo },
  ];

  return (
    <ScreenContainer
      contentContainerStyle={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-md)",
      }}
    >
      <PageHeader
        title="Control de inventario"
        subtitle="Trazabilidad multi-bodega • Lote y serie • Alertas de caducidad"
        actions={accionesCabecera}
      />

      <Nav variant="tabs" activeKey={tabActiva} onSelect={(clave) => setTabActiva(clave)}>
        {pestanas.map((pestana) => (
          <Nav.Item key={pestana.id}>
            <Nav.Link eventKey={pestana.id}>
              {pestana.label}
              {pestana.contador > 0 && <span className="ec-tab-contador">{pestana.contador}</span>}
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>
      {error && (
        <div className="alert alert-danger mb-0" role="alert">
          {error}
        </div>
      )}

      {/* Catálogo */}
      {tabActiva === "catalogo" && (
        <>
          <div className="ec-kpis">
            {/* StatCard, del catalogo de componentes: es esta misma tarjeta -rotulo en
              versalitas del color del indicador, cifra grande, pie apagado- pero hecha con los
              tokens en vez de con nueve hexadecimales escritos en linea (#10b981, #059669,
              #94a3b8...), ninguno de los cuales era un color de la paleta de Ecopac. Es la
              tarjeta que el resto de los modulos no tenia y que ahora comparten donaciones,
              presupuestos y reportes.

              DE PASO SE VAN TRES NUMEROS INVENTADOS. "REFERENCIAS" mostraba
              `inventarioRaw.length || 10`, asi que un catalogo vacio -o uno que no cargo- se
              leia como diez referencias; "POR VENCER" hacia lo mismo con `|| 2`; y "SIN STOCK"
              era un `1` escrito a mano, sin ninguna consulta detras. La tarjeta de agotados se
              reemplaza por una de lotes registrados, que la pantalla SI puede calcular:
              lotesRaw es lo que devuelve listarLotes(), mientras que el stock disponible vive
              en `existencias` y esta pantalla no lo consulta. */}
            <StatCard
              label="Referencias"
              value={inventarioRaw.length}
              caption="en catalogo"
              accent="var(--color-primary)"
            />
            <StatCard
              label="Por vencer"
              value={alertasCriticas.length}
              caption="&le; 60 dias"
              accent="var(--color-warning)"
            />
            <StatCard
              label="Lotes"
              value={lotesRaw.length}
              caption="registrados"
              accent="var(--color-info)"
            />
            {/* Solo administracion y los roles consultivos ven el valor monetario del stock
              (issue #752): un medico o voluntario no reciben ni siquiera un placeholder, no
              solo el numero oculto. */}
            {puedeVerValorizacion(rol) && (
              <StatCard
                label="Valor inventario"
                value={
                  valorizacion
                    ? (formatearMoneda(valorizacion.valorDisponible) ?? "Sin costo registrado")
                    : "..."
                }
                caption={
                  valorizacion && valorizacion.lotesSinCosto > 0
                    ? `${valorizacion.lotesSinCosto} lote(s) sin costo registrado`
                    : "stock actual"
                }
                accent="var(--accent-inventario)"
                esTexto
              />
            )}
          </div>

          {alertasCriticas.length > 0 && (
            <div className="alert alert-warning mb-0" role="status">
              <span className="ec-rotulo mb-1">Alertas de caducidad</span>
              <ul className="mb-0 ps-3">
                {alertasCriticas.map((item) => (
                  <li key={item.id}>
                    {/* item viene de aLote() (lotes.api.js) via useGestionLotes: medicamento ya
                        es el nombre (una cadena), y el numero de lote es numeroLote, no
                        numero_lote/lote. */}
                    <strong>{item.medicamento}</strong> · lote{" "}
                    <span className="ec-mono">{item.numeroLote}</span> · vence en{" "}
                    {item.diasRestantes} dias
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Filtros y tabla con los campos que `medicamentos` si tiene (00016, 00050). Ver
              packages/shared/inventario/catalogoMedicamentos.js: la categoria, el codigo, la bodega
              y el precio de antes no eran columnas y salian de valores escritos a mano. */}
          <FilterBar
            campos={FILTROS_CATALOGO_MEDICAMENTOS}
            valores={filtrosCatalogo}
            onChange={(id, valor) => setFiltrosCatalogo((previos) => ({ ...previos, [id]: valor }))}
            onLimpiar={() => setFiltrosCatalogo(FILTROS_CATALOGO_VACIOS)}
            hayFiltros={hayFiltrosDeCatalogo(filtrosCatalogo)}
          />

          <p className="ec-rotulo mb-0">
            {medicamentosVisibles.length === 1
              ? "1 medicamento"
              : `${medicamentosVisibles.length} medicamentos`}
          </p>

          <div className="ec-tabla">
            <Table responsive hover className="mb-0">
              <thead>
                <tr>
                  <th>Medicamento</th>
                  <th>Concentracion</th>
                  <th>Presentacion</th>
                  <th>Marca</th>
                  <th>Uso</th>
                  <th className="text-end">Lotes</th>
                  <th>Proximo vencimiento</th>
                  <th>Estado</th>
                  {esAdmin && <th className="text-end">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan={esAdmin ? 9 : 8} className="text-center text-body-secondary py-4">
                      Cargando el catalogo...
                    </td>
                  </tr>
                ) : medicamentosVisibles.length === 0 ? (
                  <tr>
                    <td colSpan={esAdmin ? 9 : 8} className="text-center text-body-secondary py-4">
                      {inventarioRaw.length === 0
                        ? "Todavia no hay medicamentos en el catalogo."
                        : "Ningun medicamento coincide con estos filtros."}
                    </td>
                  </tr>
                ) : (
                  medicamentosVisibles.map((item) => {
                    const lotes = resumenDeLotes.get(item.id);
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.nombre}</strong>
                          {item.formaFarmaceutica && (
                            <span className="d-block text-body-secondary small">
                              {item.formaFarmaceutica}
                            </span>
                          )}
                        </td>
                        <td>{item.concentracion}</td>
                        <td>{ETIQUETAS_PRESENTACION[item.presentacion] ?? item.presentacion}</td>
                        <td>{item.marca}</td>
                        <td>
                          <span
                            className="ec-chip"
                            style={{
                              "--ec-acento": item.esPediatrico
                                ? "var(--color-info)"
                                : "var(--color-secondary)",
                            }}
                          >
                            {item.esPediatrico ? "Pediatrico" : "General"}
                          </span>
                        </td>
                        <td className="text-end">
                          {lotes?.lotes ?? 0}
                          {lotes?.vencidos > 0 && (
                            <span className="d-block small text-danger">
                              {lotes.vencidos} vencido{lotes.vencidos === 1 ? "" : "s"}
                            </span>
                          )}
                        </td>
                        <td>
                          {lotes?.proximoVencimiento ? (
                            <>
                              {formatearFechaCorta(lotes.proximoVencimiento)}
                              <span className="d-block small text-body-secondary">
                                en {lotes.diasParaProximo} dias
                              </span>
                            </>
                          ) : (
                            <span className="text-body-secondary">Sin lotes vigentes</span>
                          )}
                        </td>
                        <td>
                          <StatusChip
                            status={item.activo === false ? "inactivo" : "activo"}
                            label={item.activo === false ? "Inactivo" : "Activo"}
                          />
                        </td>
                        {esAdmin && (
                          <td className="text-end">
                            <SecondaryButton
                              title="Editar"
                              size="sm"
                              onClick={() => abrirModalEditar(item)}
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
        </>
      )}

      {/* Pestaña: Lotes. Misma barra de filtros y misma tabla que el catalogo: antes eran un input
          en pastilla, un <select> suelto y una tabla con hexadecimales en linea, y la fecha se
          pintaba con new Date(...).toLocaleDateString(), que en Guatemala la adelanta un dia. */}
      {tabActiva === "lotes" && (
        <>
          <div className="ec-filtros">
            <div className="ec-filtro ec-filtro--busqueda">
              <TextField
                label="Buscar lote"
                placeholder="Medicamento o número de lote"
                value={busquedaLotes}
                onChange={(e) => setBusquedaLotes(e.target.value)}
                style={{ marginBottom: 0 }}
              />
            </div>
            <div className="ec-filtro">
              <Selector
                label="Origen"
                value={filtroBodega === "todas" ? null : filtroBodega}
                options={Object.values(ETIQUETAS_ORIGEN_LOTE).map((etiqueta) => ({
                  value: etiqueta,
                  label: etiqueta,
                }))}
                onSelect={(valor) => setFiltroBodega(valor ?? "todas")}
                placeholder="Todos los origenes"
                style={{ marginBottom: 0 }}
              />
            </div>
            <div className="ec-filtros-limpiar">
              <SecondaryButton
                title="Limpiar filtros"
                variant="neutra"
                disabled={!busquedaLotes && filtroBodega === "todas"}
                onClick={() => {
                  setBusquedaLotes("");
                  setFiltroBodega("todas");
                }}
              />
            </div>
          </div>

          {errorCorreccionCosto && (
            <div className="alert alert-danger mb-0" role="alert">
              {errorCorreccionCosto}
            </div>
          )}

          <div className="ec-tabla">
            <Table responsive hover className="mb-0">
              <thead>
                <tr>
                  <th>Medicamento</th>
                  <th>Lote</th>
                  <th>Origen</th>
                  <th className="text-end">Cantidad</th>
                  <th className="text-end">Costo unitario</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th className="text-end">Acción</th>
                </tr>
              </thead>
              <tbody>
                {lotesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-body-secondary py-4">
                      {lotesRaw.length === 0
                        ? "Todavia no hay lotes registrados."
                        : "Ningun lote coincide con estos filtros."}
                    </td>
                  </tr>
                ) : (
                  lotesFiltrados.map((lote) => {
                    const enCorreccion = loteEnCorreccion === lote.id;
                    return (
                      <tr key={lote.id}>
                        <td>
                          <strong>{lote.medicamento}</strong>
                        </td>
                        <td className="ec-mono">{lote.numeroLote}</td>
                        <td>{ETIQUETAS_ORIGEN_LOTE[lote.origen] ?? lote.origen}</td>
                        <td className="text-end">{lote.cantidadIngresada}</td>
                        <td className="text-end">
                          {enCorreccion ? (
                            <Form.Control
                              type="number"
                              min="0"
                              step="0.01"
                              size="sm"
                              autoFocus
                              aria-label="Costo unitario"
                              value={costoEnEdicion}
                              onChange={(e) => setCostoEnEdicion(e.target.value)}
                              className="text-end ms-auto"
                              style={{ maxWidth: "8rem" }}
                            />
                          ) : (
                            (formatearMoneda(lote.costoUnitario) ?? "Sin registrar")
                          )}
                        </td>
                        <td>
                          {lote.fechaVencimiento
                            ? formatearFechaCorta(lote.fechaVencimiento)
                            : "Sin fecha"}
                        </td>
                        <td>
                          <StatusChip
                            status={lote.vencido ? "critico" : "disponible"}
                            label={lote.vencido ? "Vencido" : "Vigente"}
                          />
                        </td>
                        <td className="text-end">
                          {enCorreccion ? (
                            <div className="ec-acciones ec-acciones--fin">
                              <SecondaryButton
                                title="Cancelar"
                                size="sm"
                                variant="neutra"
                                onClick={cancelarCorreccionCosto}
                                disabled={guardandoCosto}
                              />
                              <PrimaryButton
                                title="Guardar"
                                size="sm"
                                onClick={() => guardarCorreccionCosto(lote.id)}
                                loading={guardandoCosto}
                              />
                            </div>
                          ) : (
                            puedeCorregirLote(rol, lote, perfil?.id) && (
                              <SecondaryButton
                                title="Editar costo"
                                size="sm"
                                onClick={() => abrirCorreccionCosto(lote)}
                              />
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
        </>
      )}

      {/* Pestaña: Alertas completada mediante PanelAlertasVencimiento */}
      {tabActiva === "alertas" && (
        <PanelAlertasVencimiento usuarioId={usuarioActual?.id} rolUsuario={usuarioActual?.rol} />
      )}

      {/* Pestaña: Kardex Movimientos */}
      {tabActiva === "kardex" && <KardexMovimientosPage titulo="Historial de Movimientos" />}

      {/* Pestaña: Administración */}
      {tabActiva === "administracion" && <AdministracionBodegasProveedoresPage />}

      {/* Pestaña: Validación */}
      {tabActiva === "validacion" && (
        <BandejaValidacionPage usuarioId={perfil?.id} rolUsuario={rol} />
      )}

      {/* Pestaña: Principios Activos */}
      {tabActiva === "principios-activos" && <CatalogoPrincipiosActivosPage />}

      {/* Pestaña: Mis Movimientos */}
      {tabActiva === "mis-movimientos" && <MisMovimientosPage />}

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
          onAlternarActivo={handleAlternarActivoMedicamento}
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
          errores={erroresDeLote}
          medicamentos={inventarioRaw}
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
    </ScreenContainer>
  );
}
