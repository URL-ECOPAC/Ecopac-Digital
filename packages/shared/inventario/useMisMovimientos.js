import { useCallback, useEffect, useState } from "react";

import { ESTADOS_MOVIMIENTO } from "../enums.js";
import { validarConDescriptores } from "../validations/index.js";
import { CAMPOS_CORRECCION_MOVIMIENTO } from "./campos.js";
import { FILTROS_MIS_MOVIMIENTOS_VACIOS } from "./filtros.js";
import { editarMovimiento, listarMovimientos } from "./movimientos.api.js";
import { puedeAprobarMovimiento, puedeRegistrarMovimiento } from "./permisos.js";
import { nombreDe } from "./useKardexMovimientos.js";

/**
 * Aplana los embeds de listarMovimientos() a los campos planos que pide
 * COLUMNAS_MIS_MOVIMIENTOS, mas `puedeEditar`: una fila solo se puede corregir si sigue
 * pendiente Y la registro la misma persona que esta mirando la pantalla -la misma condicion que
 * exige editarMovimiento() (00106) en el servidor, calculada aqui para que la pantalla sepa
 * quitar la accion antes de intentar un UPDATE que RLS va a rechazar.
 *
 * Exportada aparte del hook para poder probarla sin montar React (packages/shared corre vitest
 * en environment "node", sin DOM), mismo motivo que filasDeKardex() en useKardexMovimientos.js.
 */
export function filaDeMisMovimientos(mov, usuarioId) {
  return {
    ...mov,
    medicamentoNombre: mov.lote?.medicamento?.nombre ?? null,
    numeroLote: mov.lote?.numero_lote ?? null,
    bodegaNombre: mov.bodega?.nombre ?? null,
    registradoPorNombre: nombreDe(mov.registradoPor),
    createdAt: mov.created_at,
    puedeEditar: mov.estado === ESTADOS_MOVIMIENTO.PENDIENTE && mov.registrado_por === usuarioId,
  };
}

/**
 * Los valores del formulario de correccion de un movimiento, con los de solo lectura ya legibles
 * (issue #840, B1): el lote y la bodega se muestran por su nombre, no por su id, porque la
 * correccion no carga esos catalogos.
 *
 * @param {object|null} movimiento Una fila de filaDeMisMovimientos().
 * @returns {Record<string, unknown>} Indexado por los ids de CAMPOS_CORRECCION_MOVIMIENTO.
 */
export function valoresDeCorreccionDeMovimiento(movimiento) {
  const lote = [
    movimiento?.medicamentoNombre,
    movimiento?.numeroLote && `Lote ${movimiento.numeroLote}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    tipo: movimiento?.tipo ?? "",
    lote,
    bodega: movimiento?.bodegaNombre ?? "",
    cantidad: movimiento?.cantidad ?? "",
    motivo: movimiento?.motivo ?? "",
  };
}

/**
 * Hook de la pantalla "Mis movimientos" (issue #756): los movimientos de inventario que la
 * persona misma registro -o, si puede aprobar, los de todo el mundo, con el filtro "alcance"-,
 * con la unica correccion que editarMovimiento() (00106) permite mientras un movimiento propio
 * sigue pendiente: cantidad y motivo, nunca tipo/lote/bodega.
 *
 * RLS es quien de verdad impide leer o editar de mas (SELECT esta abierto a cualquier sesion
 * activa desde la 00034/00079, y el UPDATE de 00106 solo alcanza lo propio y pendiente): este
 * hook filtra por comodidad de pantalla, no como barrera de seguridad -mismo criterio que deja
 * escrito el encabezado de permisos.js.
 */
export function useMisMovimientos({ usuarioId, rolUsuario } = {}) {
  const [movimientos, setMovimientos] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_MIS_MOVIMIENTOS_VACIOS);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erroresForm, setErroresForm] = useState({});

  const puedeVer = puedeRegistrarMovimiento(rolUsuario);
  const puedeVerTodos = puedeAprobarMovimiento(rolUsuario);

  const cargar = useCallback(async () => {
    if (!puedeVer || !usuarioId) {
      setMovimientos([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    // Quien no puede ver movimientos ajenos siempre queda acotado a lo propio, sin importar que
    // traiga el estado de "alcance": la opcion "todos" ni siquiera se le dibuja, pero esto cubre
    // tambien el primer render, antes de que la pantalla decida que mostrar.
    const soloMios = !puedeVerTodos || filtros.alcance !== "todos";

    const { datos, error: errorDeConsulta } = await listarMovimientos({
      registrado_por: soloMios ? usuarioId : undefined,
      estado: filtros.estado || undefined,
    });

    if (errorDeConsulta) {
      setMovimientos([]);
      setError(errorDeConsulta);
      setCargando(false);
      return;
    }

    setMovimientos(datos.map((mov) => filaDeMisMovimientos(mov, usuarioId)));
    setCargando(false);
  }, [usuarioId, puedeVer, puedeVerTodos, filtros]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const setFiltro = useCallback((id, valor) => {
    setFiltros((anteriores) => ({ ...anteriores, [id]: valor }));
  }, []);

  const editar = useCallback(
    async (id, datos) => {
      const errores = validarConDescriptores(CAMPOS_CORRECCION_MOVIMIENTO, datos);
      if (!errores.cantidad && Number(datos.cantidad) <= 0) {
        errores.cantidad = "Cantidad debe ser mayor a 0.";
      }

      if (Object.keys(errores).length > 0) {
        setErroresForm(errores);
        return { ok: false, errores };
      }

      setEnviando(true);
      setErroresForm({});

      const { error: errorDeEdicion } = await editarMovimiento(
        id,
        { cantidad: Number(datos.cantidad), motivo: datos.motivo },
        usuarioId,
      );

      setEnviando(false);

      if (errorDeEdicion) {
        setError(errorDeEdicion);
        return { ok: false, error: errorDeEdicion };
      }

      await cargar();
      return { ok: true };
    },
    [usuarioId, cargar],
  );

  return {
    movimientos,
    total: movimientos.length,
    filtros,
    setFiltro,
    cargando,
    error,
    enviando,
    erroresForm,
    puedeVer,
    puedeVerTodos,
    editar,
    recargar: cargar,
  };
}
