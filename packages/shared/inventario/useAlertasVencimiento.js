import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  listarAlertas,
  atenderAlerta,
  historialAlertas,
  sincronizarAlertas,
} from "./alertas.api.js";
import { listarBodegas } from "./bodegas.api.js";
import { esAdministrador } from "../usuarios/roles.js";
import { aFechaLocal, diasHastaVencimiento } from "../formato/fechas.js";

/**
 * Dias restantes para que venza un lote (negativo si ya vencio, 0 si vence hoy). Se exporta
 * aparte del hook -y lo siguen usando useVistaExistencias.js y reportes/api.js- para poder
 * probarla sin montar un componente (issue #694).
 *
 * Regla #597: un lote que vence HOY (dias = 0) todavia es valido y entregable.
 *
 * Antes calculaba con new Date(fechaVencimiento) - new Date() en milisegundos, que interpreta
 * una cadena AAAA-MM-DD como medianoche UTC. En Guatemala (UTC-6) eso adelanta un dia cualquier
 * fecha, y ademas comparaba contra el instante actual (con hora), no contra el dia de
 * calendario. diasHastaVencimiento() (formato/fechas.js) ya resuelve las dos cosas.
 *
 * @param {string} fechaVencimiento
 * @param {string} [fechaIngreso]
 * @returns {number|null}
 */
export function calcularDiasRestantes(fechaVencimiento, fechaIngreso) {
  if (!fechaVencimiento) return null;

  if (fechaIngreso) {
    const ingreso = aFechaLocal(fechaIngreso);
    const vencimiento = aFechaLocal(fechaVencimiento);
    if (ingreso && vencimiento && vencimiento < ingreso) return null;
  }

  return diasHastaVencimiento(fechaVencimiento);
}

/**
 * Traduce la lista de acciones mas la sesion actual a los argumentos que declara atenderAlerta()
 * (alertas.api.js). Se exporta aparte del hook para poder probar la traduccion sin montar un
 * componente (issue #709): el bug original mandaba { accionTomada } en vez de { accion, ... }.
 *
 * Desde la issue #755 ya no viaja usuarioId: quien atiende lo fija la base con auth.uid()
 * (fn_atender_alerta_caducidad, 00138, extendida por 00143 para aceptar varias acciones a la
 * vez). `totalDisponible` es lo que las cantidades de `acciones` tienen que sumar exacto -el
 * disponible vivo del lote, no cantidadAfectada.
 *
 * @param {{accion:string, cantidad:number, bodegaDestinoId?:string}[]} acciones
 * @param {{ rolUsuario?: string }} sesion
 * @param {number} totalDisponible
 */
export function datosAtenderAlerta(acciones, { rolUsuario }, totalDisponible) {
  return { acciones, rolUsuario, totalDisponible };
}

// Cuantas alertas atendidas muestra el bloque "Atendidas recientemente" del panel web.
export const LIMITE_DE_ATENDIDAS = 10;

// Cada instancia montada del hook, para avisarles cuando una atiende una alerta (issue #755). La
// web monta dos a la vez -la del panel y la que cuenta pendientes para la pestana "Alertas" de
// InventarioPage- y sin este aviso el contador de la pestana seguia en el numero de antes hasta
// recargar la pagina. En memoria y sin window, para que valga igual en el movil.
const instanciasMontadas = new Set();

/**
 * Vuelve a consultar alertas_caducidad en cada instancia montada de useAlertasVencimiento(),
 * desde fuera del hook.
 *
 * Es RECARGA, no sincronizacion: cada `consultar()` de la lista decide por su cuenta -con el
 * `rolUsuario` de esa instancia- si ademas llama a sincronizarAlertas(), que es admin-only
 * (fn_sincronizar_alertas_caducidad rechaza a cualquier otro rol con 42501). Por eso esta
 * funcion es segura de llamar sin importar el rol de quien registro el movimiento que la
 * dispara: para una instancia de administracion sincroniza y relista; para cualquier otra,
 * relista nada mas.
 *
 * La usa marcarComoAtendida() de este mismo archivo, y tambien flujos de otros modulos que
 * cambian existencias fuera de "atender una alerta" -registrar un ingreso o una salida, aprobar
 * un movimiento pendiente- para que el panel de alertas no dependa de que alguien lo recargue a
 * mano ni de esperar a la rutina programada del dia siguiente.
 *
 * @returns {Promise<unknown[]>}
 */
export function recargarAlertasMontadas() {
  return Promise.all([...instanciasMontadas].map((consultarInstancia) => consultarInstancia()));
}

/**
 * View model del panel de alertas de vencimiento (issue #268, RF-19), y de la correccion de la
 * auditoria campo-a-vista (issue #756): el panel calculaba sus propias "alertas" a partir de la
 * lista de lotes, en vez de leer `alertas_caducidad` (la tabla que de verdad llena
 * fn_generar_alertas_caducidad() todos los dias). El sintoma no era solo estetico: al reconstruir
 * la fila con `id: lote.id`, "Atender" llamaba a atenderAlerta() con el id de un LOTE, no de una
 * alerta, y esa llamada nunca actualizaba ninguna fila real.
 *
 * Ahora el hook consulta listarAlertas() directamente, igual que usePendientesValidacion()
 * consulta listarMovimientos(): sin props de lotes/bodegas, con su propio cargando/error, y
 * recargando la lista despues de atender una alerta con exito. Sirve a las dos plataformas: el
 * panel web (PanelAlertasVencimiento.jsx) y el resumen movil
 * (InventarioResumenAlertasScreen.js, issue #785), que antes tenia su propia copia del calculo
 * client-side sobre `lotes` -mismo bug de fondo, solo que sin boton de "Atender" que lo
 * disparara todavia.
 *
 * @param {{ rolUsuario: string }} contexto Quien esta operando el panel. El rol decide si se
 *   sincroniza al abrir y viaja a atenderAlerta(); quien atiende lo fija la base (issue #755).
 */
export function useAlertasVencimiento({ rolUsuario } = {}) {
  const [alertas, setAlertas] = useState([]);
  // Las ya atendidas (issue #755): quien, cuando y que accion. Su fallo va aparte de `error`: el
  // historial es informativo, y no puede tapar la lista de pendientes, que es la que pide accion.
  const [atendidas, setAtendidas] = useState([]);
  const [errorAtendidas, setErrorAtendidas] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  // Destinos posibles de una reubicacion (issue #755). Se piden una vez: el catalogo de bodegas
  // no cambia mientras el panel esta abierto, y solo hace falta al elegir "Reubicado".
  const [bodegas, setBodegas] = useState([]);
  const [errorBodegas, setErrorBodegas] = useState(null);

  // Mismo resguardo contra respuestas fuera de orden que usePendientesValidacion().
  const peticionVigente = useRef(0);

  const consultar = useCallback(async () => {
    peticionVigente.current += 1;
    const idDeEstaPeticion = peticionVigente.current;

    setCargando(true);
    setError(null);

    // Antes de listar, se pone al dia la tabla (issue #838). Un lote que ya vencio no tenia
    // alerta ninguna -- fn_generar_alertas_caducidad() lo descartaba por vencido hasta la 00129 --
    // asi que el bloque "Vencidos - Para dar de baja" salia vacio con el lote a la vista en el
    // inventario. Solo lo intenta la administradora, que es quien puede atenderlas, y su fallo se
    // ignora a proposito: el panel se lee igual sin este paso, y taparlo con un error seria peor
    // que mostrar la lista que ya habia.
    if (esAdministrador(rolUsuario)) await sincronizarAlertas();

    const respuesta = await listarAlertas();

    if (idDeEstaPeticion !== peticionVigente.current) return;

    if (respuesta.error) {
      setError(respuesta.error);
      setCargando(false);
      return;
    }

    setAlertas(respuesta.alertas);

    const historial = await historialAlertas({ limite: LIMITE_DE_ATENDIDAS });
    if (idDeEstaPeticion !== peticionVigente.current) return;
    setAtendidas(historial.alertas);
    setErrorAtendidas(historial.error);

    setCargando(false);
  }, [rolUsuario]);

  useEffect(() => {
    consultar();
  }, [consultar]);

  useEffect(() => {
    instanciasMontadas.add(consultar);
    return () => instanciasMontadas.delete(consultar);
  }, [consultar]);

  const recargar = useCallback(() => consultar(), [consultar]);

  useEffect(() => {
    let vigente = true;
    listarBodegas().then((respuesta) => {
      if (!vigente) return;
      setBodegas(respuesta.bodegas);
      setErrorBodegas(respuesta.error);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const alertasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return alertas;

    return alertas.filter((alerta) =>
      [alerta.medicamento, alerta.numeroLote].some((campo) =>
        (campo ?? "").toLowerCase().includes(termino),
      ),
    );
  }, [alertas, busqueda]);

  const porVencer = useMemo(
    () => alertasFiltradas.filter((alerta) => (alerta.diasRestantes ?? 0) >= 0),
    [alertasFiltradas],
  );
  const vencidas = useMemo(
    () => alertasFiltradas.filter((alerta) => (alerta.diasRestantes ?? 0) < 0),
    [alertasFiltradas],
  );

  const marcarComoAtendida = useCallback(
    async (idAlerta, acciones, totalDisponible) => {
      const respuesta = await atenderAlerta(
        idAlerta,
        datosAtenderAlerta(acciones, { rolUsuario }, totalDisponible),
      );

      if (respuesta.error) {
        throw new Error(respuesta.error.mensaje);
      }

      await recargarAlertasMontadas();
      return respuesta;
    },
    [rolUsuario],
  );

  return {
    porVencer,
    vencidas,
    cantidadPendientes: alertas.length,
    atendidas,
    errorAtendidas,
    bodegas,
    errorBodegas,
    cargando,
    error,
    recargar,

    busqueda,
    setBusqueda,

    marcarComoAtendida,
  };
}
