import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalMedicamento from "./ModalMedicamento.jsx";
import ModalPrincipioActivo from "./ModalPrincipioActivo.jsx";
import ModalPresentacion from "./ModalPresentacion.jsx";
import ModalRegistroIngreso from "./ModalRegistroIngreso.jsx";
import { ModalSalidaMedicamento } from "./ModalSalidaMedicamento";
import BandejaValidacionPage from "./BandejaValidacionPage";
import {
  actualizarLote,
  actualizarMedicamento,
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
  listarExistenciasDisponibles,
  listarLotes,
  listarMedicamentos,
  listarPresentaciones,
  listarPrincipiosActivos,
  listarPrincipiosDeMedicamento,
  listarProveedores,
  obtenerValorDeInventario,
  pestanasDeInventario,
  puedeCorregirLote,
  puedeDarDeAltaMedicamento,
  puedeRegistrarMovimiento,
  puedeVerValorizacion,
  reactivarMedicamento,
  registrarMedicamento,
  registrarPresentacion,
  registrarPrincipioActivo,
  sumarExistenciasPorLote,
  ETIQUETAS_TIPO_ARTICULO,
  TIPOS_DE_ARTICULO,
  totalizarValorizacion,
  useAlertasVencimiento,
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
import CatalogoPresentacionesPage from "./CatalogoPresentacionesPage.jsx";
import MisMovimientosPage from "./MisMovimientosPage.jsx";

// Pestanas que se pueden abrir con ?tab=. Es el enlace de las notificaciones del buzon (issue
// #755): /inventario?tab=alertas, ?tab=validacion o ?tab=catalogo. "mis-movimientos" no esta
// porque depende del rol; una pestana que no esta en la lista cae al catalogo, la de siempre.
const PESTANAS_ENLAZABLES = [
  "catalogo",
  "lotes",
  "alertas",
  "kardex",
  "administracion",
  "principios-activos",
  "presentaciones",
  "validacion",
];

function pestanaDeEnlace(pedida) {
  return PESTANAS_ENLAZABLES.includes(pedida) ? pedida : "catalogo";
}

export default function InventarioPage() {
  const [parametros] = useSearchParams();
  const pestanaPedida = parametros.get("tab");
  const [tabActiva, setTabActiva] = useState(() => pestanaDeEnlace(pestanaPedida));

  // Si ?tab= cambia con la pagina ya montada (se abre otra notificacion), la pestana lo sigue.
  useEffect(() => {
    if (pestanaPedida) setTabActiva(pestanaDeEnlace(pestanaPedida));
  }, [pestanaPedida]);
  const [inventarioRaw, setInventarioRaw] = useState([]);
  const [principiosActivos, setPrincipiosActivos] = useState([]);
  const [presentaciones, setPresentaciones] = useState([]);
  const [lotesRaw, setLotesRaw] = useState([]);
  // Existencias vivas (vista_lotes_disponibles), para la columna "Disponible" de la pestaña
  // Lotes: lotesRaw.cantidadIngresada es el historico de entrada, no el stock que queda hoy.
  const [existenciasRaw, setExistenciasRaw] = useState([]);
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
  const [modalPresentacionAbierto, setModalPresentacionAbierto] = useState(false);
  const [advertenciaDuplicado, setAdvertenciaDuplicado] = useState(false);
  // Un fallo al guardar se pinta dentro del modal, no en un alert() del navegador (issue #762).
  const [errorGuardarMedicamento, setErrorGuardarMedicamento] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    tipoArticulo: TIPOS_DE_ARTICULO.MEDICAMENTO,
    principio_activo_id: "",
    concentracion: "",
    presentacionId: "",
    marca: "",
    formaFarmaceutica: "",
  });

  // El indicador de la pestaña y el aviso "Alertas de caducidad" del catálogo leen las mismas
  // alertas pendientes que PanelAlertasVencimiento.jsx -su propia llamada a useAlertasVencimiento()
  // es la que de verdad se pinta en la pestaña Alertas-, no derivan de lotesRaw (mismo patron de
  // instancias independientes que usePendientesValidacion() en la bandeja de validacion).
  //
  // Antes el aviso del catalogo salia de useGestionLotes(), que recalculaba "por vencer" a partir
  // de la fecha de cada lote sin mirar alertas_caducidad.estado: atender una alerta en la pestaña
  // Alertas no cambia la fecha de vencimiento del lote, asi que el aviso nunca se quitaba aunque la
  // alerta ya estuviera resuelta. recargarAlertasMontadas() (useAlertasVencimiento.js) ya avisa a
  // esta instancia cuando otra atiende una alerta; con la lista de pendientes real, el aviso se
  // actualiza solo.
  const {
    cantidadPendientes: cantidadPendientesAlertas,
    porVencer: alertasPorVencer,
    vencidas: alertasVencidas,
  } = useAlertasVencimiento({});
  const alertasCriticas = useMemo(
    () => [...alertasVencidas, ...alertasPorVencer],
    [alertasVencidas, alertasPorVencer],
  );

  // Modales Lotes y Alertas. Aqui habia un modalAltaLoteAbierto para "Registrar lote": se
  // retiro con la issue #846 (ver el comentario de la barra de acciones).
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
      const [
        resMed,
        resPA,
        resPresentaciones,
        resBodegas,
        resProveedores,
        resLotes,
        resExistencias,
      ] = await Promise.all([
        // soloActivos:false (issue #756): antes el catalogo pedia listarMedicamentos() con su
        // default (soloActivos:true), asi que un medicamento desactivado desaparecia sin
        // ninguna forma de volver a verlo ni de reactivarlo desde la pantalla.
        listarMedicamentos({ soloActivos: false }),
        listarPrincipiosActivos(),
        listarPresentaciones(),
        listarBodegas(),
        listarProveedores(),
        listarLotes(),
        listarExistenciasDisponibles(),
      ]);

      // Los siete fallos tienen que llegar a la pantalla. Antes solo lo hacia el de medicamentos:
      // los otros se escribian en la consola y la pestana seguia como si nada, con el
      // desplegable de bodegas vacio o el kardex sin lotes y sin decir por que. Es el fallo
      // silencioso que describe la issue #762: algo no funciona y el sistema dice que si.
      const fallos = [];

      if (resMed.error) fallos.push(["medicamentos", resMed.error]);
      else setInventarioRaw(resMed.medicamentos || []);

      if (resPA.error) fallos.push(["principios activos", resPA.error]);
      else setPrincipiosActivos(resPA.principiosActivos || []);

      if (resPresentaciones.error) fallos.push(["presentaciones", resPresentaciones.error]);
      else setPresentaciones(resPresentaciones.presentaciones || []);

      if (resBodegas.error) fallos.push(["bodegas", resBodegas.error]);
      else setBodegas(resBodegas.bodegas || []);

      if (resProveedores.error) fallos.push(["proveedores", resProveedores.error]);
      else setProveedores(resProveedores.proveedores || []);

      if (resLotes.error) fallos.push(["lotes", resLotes.error]);
      else setLotesRaw(resLotes.lotes || []);

      // Sin cantidadDisponible por lote si esto falla: la tabla de Lotes sigue mostrando lo
      // historico (cantidadIngresada) y la columna "Disponible" cae a 0 para todos, no se tapa
      // la pestana entera por un dato que es un complemento del resto.
      if (resExistencias.error) fallos.push(["existencias", resExistencias.error]);
      else setExistenciasRaw(resExistencias.existencias || []);

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

        // Un solo mensaje para todos: en la practica todos fallan por la misma causa -red
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
      tipoArticulo: TIPOS_DE_ARTICULO.MEDICAMENTO,
      principio_activo_id: "",
      concentracion: "",
      presentacionId: "",
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
      tipoArticulo: item.tipoArticulo || TIPOS_DE_ARTICULO.MEDICAMENTO,
      // listarMedicamentos() no trae la relacion con principios_activos: se llena abajo, en
      // cuanto listarPrincipiosDeMedicamento() resuelva.
      principio_activo_id: "",
      concentracion: item.concentracion || "",
      presentacionId: item.presentacionId || "",
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

  const handleGuardarPresentacionNueva = async (_id, datos) => {
    const { presentacion, error: errorPresentacion } = await registrarPresentacion(datos);
    if (errorPresentacion) return { ok: false, error: errorPresentacion };

    setPresentaciones((prev) => [...prev, presentacion]);
    setFormData((prev) => ({ ...prev, presentacionId: presentacion.id }));
    return { ok: true, presentacion };
  };

  const handleGuardarMedicamento = async () => {
    setErrorGuardarMedicamento(null);
    // presentacionId (00144): se compara el id, no una etiqueta -- dos presentaciones podrian
    // compartir texto parecido, pero el catalogo real las distingue por id, no por como se
    // escriban.
    const duplicado = inventarioRaw.some(
      (item) =>
        item.id !== formData.id &&
        item.nombre?.toLowerCase() === formData.nombre?.toLowerCase() &&
        item.concentracion?.toLowerCase() === formData.concentracion?.toLowerCase() &&
        item.presentacionId === formData.presentacionId &&
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
          tipoArticulo: formData.tipoArticulo,
          concentracion: formData.concentracion.trim(),
          presentacionId: formData.presentacionId,
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
          tipoArticulo: formData.tipoArticulo,
          concentracion: formData.concentracion.trim(),
          presentacionId: formData.presentacionId,
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

  // Lotes: cuanto queda hoy de cada lote, sumado en todas las bodegas. Reutiliza el mismo
  // helper probado que arma la pantalla movil de existencias por lote (useExistenciasPorLote.js);
  // sin bodegaId suma todas, igual que "Cantidad" (cantidadIngresada) tampoco distingue bodega.
  const disponiblePorLote = useMemo(
    () => sumarExistenciasPorLote(existenciasRaw),
    [existenciasRaw],
  );

  // Catalogo: filtros sobre los campos reales del modelo y resumen de lotes por medicamento.
  const resumenDeLotes = useMemo(() => resumirLotesPorMedicamento(lotesRaw), [lotesRaw]);
  const medicamentosVisibles = useMemo(
    () => filtrarCatalogoMedicamentos(inventarioRaw, filtrosCatalogo, resumenDeLotes),
    [inventarioRaw, filtrosCatalogo, resumenDeLotes],
  );

  // Para el filtro de presentacion (opcionesDesde: "presentaciones", 00144) y para el Selector
  // de ModalMedicamento: mismo catalogo cargado, sin volver a pedirlo.
  const opcionesPresentacion = useMemo(
    () =>
      presentaciones.map((presentacion) => ({
        value: presentacion.id,
        label: presentacion.nombre,
      })),
    [presentaciones],
  );

  // Pestanas. Eran nueve <button> con un color de subrayado distinto cada una (#10b981, #f59e0b,
  // #0284c7, #6366f1, #0d9488, #7c3aed): las pastillas de `.nav-tabs` de ui.css son las mismas
  // que usan pacientes, presupuestos y reportes.
  // Rotulos cortos: con los largos ("Catalogo de medicamentos", "Kardex de movimientos") las
  // ocho pestanas no cabian en una fila y "Validacion" caia sola a una segunda linea.
  //
  // Cuales ve cada rol lo decide pestanasDeInventario(rol) en packages/shared (issue #864,
  // extendida por #859), no esta pantalla.
  const etiquetasDePestana = {
    catalogo: { label: "Catálogo" },
    lotes: { label: "Lotes" },
    alertas: { label: "Alertas", contador: cantidadPendientesAlertas },
    kardex: { label: "Kardex" },
    administracion: { label: "Bodegas y proveedores" },
    "principios-activos": { label: "Principios activos" },
    presentaciones: { label: "Presentaciones" },
    "mis-movimientos": { label: "Mis movimientos" },
    validacion: { label: "Validación", contador: conteo },
  };

  const pestanas = pestanasDeInventario(rol).map((id) => ({ id, ...etiquetasDePestana[id] }));

  // A ?tab= se llega desde una notificacion, y puede apuntar a una pestana que este rol ya no
  // tiene -la de validacion, sin ir mas lejos, que se la mandan al administrador-. Sin esto la
  // barra no marcaria ninguna pestana como activa y debajo se dibujaria igual el contenido de una
  // que el rol no deberia abrir.
  const pestanaVisible = pestanas.some((pestana) => pestana.id === tabActiva)
    ? tabActiva
    : (pestanas[0]?.id ?? "catalogo");

  // Acciones de la cabecera. Eran cuatro <button> con estilos en linea -dos verdes, uno ambar,
  // hexadecimales fuera de la paleta- y el "+" escrito dentro del texto. Ahora son las acciones de
  // PageHeader, que pone el "+" sola y dibuja los botones del catalogo.
  //
  // "Registrar ingreso"/"Registrar salida" se gateaban con esAdmin: medico y voluntario -que
  // permisos.js (puedeRegistrarMovimiento) y la politica de INSERT (00034) SI dejan registrar un
  // movimiento, solo que nace 'pendiente' en vez de autoaprobado- no tenian boton en toda la web
  // para abrir ninguno de los dos modales. RLS los habria dejado insertar iguales -por eso
  // "Mis movimientos" ya existia para ellos-, pero sin el boton no habia como llegar ahi. Reportado
  // como "no puedo registrar una salida en inventario". "Nuevo medicamento" usa
  // puedeDarDeAltaMedicamento(rol): administrador y medico (00141, issue #864).
  const tabsSinAccionesDeCabecera = ["validacion", "administracion", "kardex"];
  const puedeRegistrar = puedeRegistrarMovimiento(rol);
  const accionesCabecera = tabsSinAccionesDeCabecera.includes(pestanaVisible)
    ? []
    : [
        ...(puedeRegistrar
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
            ]
          : []),
        ...(pestanaVisible === "catalogo" && puedeDarDeAltaMedicamento(rol)
          ? [{ label: "Nuevo medicamento", onClick: abrirModalNuevo }]
          : []),
        // Aqui estaba "Registrar lote". Se retira con la issue #846: registrarLote() insertaba
        // en `lotes` y nada mas, asi que el lote nacia sin existencias en ninguna bodega y sin
        // movimiento que lo respaldara. El stock solo nace de un ingreso, y "Registrar ingreso"
        // -que crea el lote y el movimiento a la vez- ya esta arriba en esta misma barra. Un
        // boton que parece dar de alta existencias y no las da es peor que no tenerlo.
      ];

  // Un no-admin puede llegar a ?tab=validacion desde el enlace de una notificacion del buzon
  // (issue #755) sin saber que esa pestana ya no es la suya: en vez de pantalla vacia o error, se
  // le manda en silencio al catalogo -la misma pestana por defecto a la que ya cae cualquier
  // ?tab= desconocido en pestanaDeEnlace(), arriba-.
  useEffect(() => {
    if (tabActiva === "validacion" && !esAdmin) {
      setTabActiva("catalogo");
    }
  }, [tabActiva, esAdmin]);

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

      <Nav variant="tabs" activeKey={pestanaVisible} onSelect={(clave) => setTabActiva(clave)}>
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
      {pestanaVisible === "catalogo" && (
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
              caption="alertas pendientes"
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
                    {/* item viene de aAlerta() (alertas.api.js) via useAlertasVencimiento: solo
                        alertas pendientes de verdad, no lotes por fecha. */}
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
            catalogos={{ presentaciones: opcionesPresentacion }}
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
                  <th>Tipo</th>
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
                    <td colSpan={esAdmin ? 10 : 9} className="text-center text-body-secondary py-4">
                      Cargando el catalogo...
                    </td>
                  </tr>
                ) : medicamentosVisibles.length === 0 ? (
                  <tr>
                    <td colSpan={esAdmin ? 10 : 9} className="text-center text-body-secondary py-4">
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
                        <td>{ETIQUETAS_TIPO_ARTICULO[item.tipoArticulo] ?? item.tipoArticulo}</td>
                        <td>{item.concentracion}</td>
                        {/* item.presentacion ya es la etiqueta resuelta (presentaciones.nombre,
                            00144), no un valor de enum que traducir. */}
                        <td>{item.presentacion}</td>
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
      {pestanaVisible === "lotes" && (
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
                  <th className="text-end">Ingresada</th>
                  <th className="text-end">Disponible</th>
                  <th className="text-end">Costo unitario</th>
                  <th className="text-end">Total</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th className="text-end">Acción</th>
                </tr>
              </thead>
              <tbody>
                {lotesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center text-body-secondary py-4">
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
                        <td className="text-end">{disponiblePorLote.get(lote.id) ?? 0}</td>
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
                        <td className="text-end">
                          {/* Costo unitario x stock DISPONIBLE (no cantidadIngresada): un lote
                              con salidas ya aplicadas o parcialmente vencido no vale lo mismo
                              que el dia que entro. Sin costo registrado (null) el total es
                              desconocido, no cero -- mismo criterio que "Sin registrar" arriba. */}
                          {lote.costoUnitario === null
                            ? "—"
                            : formatearMoneda(
                                lote.costoUnitario * (disponiblePorLote.get(lote.id) ?? 0),
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
      {pestanaVisible === "alertas" && (
        <PanelAlertasVencimiento usuarioId={usuarioActual?.id} rolUsuario={usuarioActual?.rol} />
      )}

      {/* Pestaña: Kardex Movimientos */}
      {pestanaVisible === "kardex" && <KardexMovimientosPage titulo="Historial de Movimientos" />}

      {/* Pestaña: Administración */}
      {pestanaVisible === "administracion" && <AdministracionBodegasProveedoresPage />}

      {/* Pestaña: Validación */}
      {pestanaVisible === "validacion" && (
        <BandejaValidacionPage usuarioId={perfil?.id} rolUsuario={rol} />
      )}

      {/* Pestaña: Principios Activos */}
      {pestanaVisible === "principios-activos" && <CatalogoPrincipiosActivosPage />}

      {/* Pestaña: Presentaciones */}
      {pestanaVisible === "presentaciones" && <CatalogoPresentacionesPage />}

      {/* Pestaña: Mis Movimientos */}
      {pestanaVisible === "mis-movimientos" && <MisMovimientosPage />}

      {/* Modales */}
      {modalAbierto && (
        <ModalMedicamento
          isOpen={modalAbierto}
          modoEdicion={modoEdicion}
          cargando={cargandoGuardar}
          formData={formData}
          setFormData={setFormData}
          principiosActivos={principiosActivos}
          presentaciones={presentaciones}
          advertenciaDuplicado={advertenciaDuplicado}
          error={errorGuardarMedicamento}
          onSubmit={handleGuardarMedicamento}
          onClose={() => setModalAbierto(false)}
          onCrearPrincipioActivo={() => setModalPrincipioActivoAbierto(true)}
          onCrearPresentacion={() => setModalPresentacionAbierto(true)}
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

      {modalPresentacionAbierto && (
        <ModalPresentacion
          visible
          presentacion={null}
          onClose={() => setModalPresentacionAbierto(false)}
          onGuardar={handleGuardarPresentacionNueva}
          onEliminar={async () => ({ ok: false })}
        />
      )}

      {/* Montado solo mientras esta abierto (igual que ModalRegistroIngreso, abajo): estaba
          montado siempre, con el propio componente devolviendo null cuando abierto=false, asi
          que el estado de useRegistroSalida (motivo, medicamento, lote, cantidad) sobrevivia al
          cierre y la siguiente salida arrancaba con los datos de la anterior en vez de en blanco
          (issue #859). Montar y desmontar de nuevo es lo que reinicia ese estado. */}
      {modalSalidaAbierto && (
        <ModalSalidaMedicamento
          abierto={modalSalidaAbierto}
          onClose={() => setModalSalidaAbierto(false)}
          onExito={cargarDatos}
          medicamentos={inventarioRaw}
          usuarioId={usuarioActual?.id}
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
