import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listarAlertas, atenderAlerta, sincronizarAlertas } from "./alertas.api.js";
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
 * Traduce la accion tomada mas la sesion actual a los argumentos que declara atenderAlerta()
 * (alertas.api.js). Se exporta aparte del hook para poder probar la traduccion sin montar un
 * componente (issue #709): el bug original mandaba { accionTomada } en vez de { accion,
 * usuarioId, rolUsuario }, y atenderAlerta() siempre fallaba por falta de usuarioId.
 *
 * @param {string} accionTomada
 * @param {{ usuarioId?: string, rolUsuario?: string }} sesion
 */
export function datosAtenderAlerta(accionTomada, { usuarioId, rolUsuario }) {
  return { accion: accionTomada, usuarioId, rolUsuario };
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
 * @param {{ usuarioId: string, rolUsuario: string }} contexto Quien esta operando el panel; viaja
 *   tal cual a atenderAlerta().
 */
export function useAlertasVencimiento({ usuarioId, rolUsuario } = {}) {
  const [alertas, setAlertas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  // Mismo resguardo contra respuestas fuera de orden que usePendientesValidacion().
  const peticionVigente = useRef(0);

  const consultar = useCallback(async () => {
    peticionVigente.current += 1;
    const idDeEstaPeticion = peticionVigente.current;

    setCargando(true);
    setError(null);

    // Antes de listar, se pone al dia la tabla (issue #834). Un lote que ya vencio no tenia
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
    setCargando(false);
  }, [rolUsuario]);

  useEffect(() => {
    consultar();
  }, [consultar]);

  const recargar = useCallback(() => consultar(), [consultar]);

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
    async (idAlerta, accionTomada) => {
      if (!accionTomada || accionTomada.trim() === "") {
        throw new Error("Debe indicar la acción tomada");
      }

      const respuesta = await atenderAlerta(
        idAlerta,
        datosAtenderAlerta(accionTomada, { usuarioId, rolUsuario }),
      );

      if (respuesta.error) {
        throw new Error(respuesta.error.mensaje);
      }

      await consultar();
      return respuesta;
    },
    [usuarioId, rolUsuario, consultar],
  );

  return {
    porVencer,
    vencidas,
    cantidadPendientes: alertas.length,
    cargando,
    error,
    recargar,

    busqueda,
    setBusqueda,

    marcarComoAtendida,
  };
}
