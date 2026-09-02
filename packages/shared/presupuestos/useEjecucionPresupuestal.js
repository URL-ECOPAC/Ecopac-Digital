// View model de la pantalla de ejecucion presupuestal (issue #300).
//
// Self-fetching, mismo patron que jornadas/useJornadasKanban.js: el hook llama a sus propias
// funciones de api.js en un useEffect y expone `recargar` como alias de esa carga. No el patron
// de proyectos/useSeguimientoProyecto.js (recibe *Iniciales por props y nunca llama a api.js por
// su cuenta): ese patron es el que dejo useHistorialDonaciones.js sin conectar a datos reales
// hasta que se reescribio. El criterio de aceptacion pide "handlers de cambio de filtro y de
// recarga", y un hook que expone `recargar` es un hook que sabe cargar solo.

import { useCallback, useEffect, useState } from "react";

import { listarProyectos } from "../proyectos/api.js";
import { listarJornadas } from "../jornadas/api.js";
import { listarUsuarios } from "../usuarios/api.js";
import { nombreCompletoDe } from "../usuarios/useUsuariosListado.js";
import { obtenerPresupuestoProyecto, obtenerPresupuestoSistema, listarGastos } from "./api.js";
import { permisosDeGastos } from "./permisos.js";

const KPIS_VACIOS = { asignado: 0, gastado: 0, disponible: 0, pendiente: 0, porcentaje: 0 };

const CATALOGOS_VACIOS = { proyectos: [], jornadas: [], perfiles: [] };

/**
 * Catalogo `{ value, label }` para los `opcionesDesde` de FILTROS_GASTO/CAMPOS_GASTO
 * (jornada_id, proyecto_id, responsable_id): mismo patron `aOpciones()` que ya usa
 * jornadas/useFormularioJornada.js, sin reimplementarlo -- ese helper es privado de ese
 * archivo, asi que se repite aqui su misma forma en vez de importarlo entre modulos.
 */
function aOpciones(filas, etiquetaDe) {
  return (filas ?? []).map((fila) => ({ value: fila.id, label: etiquetaDe(fila) }));
}

/**
 * Porcentaje ejecutado de un presupuesto. `asignado` en 0 da 0, nunca NaN/Infinity: un
 * presupuesto sin asignar no tiene "cero por ciento gastado", tiene un porcentaje que no aplica,
 * y 0 es la forma segura de pintarlo sin inventar un dato. No se recorta a 100: un proyecto se
 * puede sobregirar y la pantalla tiene que poder mostrarlo.
 *
 * @param {number} asignado
 * @param {number} gastado
 * @returns {number}
 */
export function calcularPorcentajeEjecutado(asignado, gastado) {
  const total = Number(asignado) || 0;
  if (total <= 0) return 0;
  return ((Number(gastado) || 0) / total) * 100;
}

/**
 * Combina `listarProyectos()` (nombre, id) con el resultado de `obtenerPresupuestoProyecto()`
 * por id, en la fila que pide el criterio 2: asignado, ejecutado, porcentaje y disponible.
 *
 * Un proyecto cuyo presupuesto no llego (la llamada individual fallo, o no hay fila) entra en
 * ceros en vez de omitirse: sigue siendo un proyecto real que la pantalla tiene que listar, solo
 * que sin dato de ejecucion todavia.
 *
 * @param {object[]} proyectos Filas de listarProyectos() (api.js de proyectos/).
 * @param {Record<string, {asignado:number, gastado:number, disponible:number, pendiente:number}>} presupuestosPorProyecto
 *   Mapa id de proyecto -> presupuesto, construido con Promise.all sobre obtenerPresupuestoProyecto().
 * @returns {{id:string, nombre:string, asignado:number, gastado:number, disponible:number, porcentaje:number}[]}
 */
export function combinarProyectosConPresupuesto(proyectos = [], presupuestosPorProyecto = {}) {
  return proyectos.map((proyecto) => {
    const presupuesto = presupuestosPorProyecto[proyecto.id] ?? KPIS_VACIOS;
    return {
      id: proyecto.id,
      nombre: proyecto.nombre,
      // listarProyectos() (proyectos/api.js) ya aplana el perfil embebido del responsable a un
      // nombre listo para pintar (aProyecto()); el criterio 2 de #301 pide mostrarlo junto al
      // ejecutado, y esta funcion es el unico lugar que arma esa fila combinada.
      responsable: proyecto.responsableNombre || null,
      asignado: presupuesto.asignado,
      gastado: presupuesto.gastado,
      disponible: presupuesto.disponible,
      porcentaje: calcularPorcentajeEjecutado(presupuesto.asignado, presupuesto.gastado),
    };
  });
}

/**
 * Combina las jornadas de un proyecto (listarJornadasDelProyecto()) con su presupuesto
 * (obtenerPresupuestoJornada() por id), para el detalle de #301 (criterio 3). Gemela de
 * combinarProyectosConPresupuesto(): misma forma de fila, mismo criterio de "en ceros y no
 * omitida" cuando el presupuesto individual no llego.
 *
 * @param {object[]} jornadas Filas de listarJornadasDelProyecto() (proyectos/api.js): id,
 *   nombre, fecha, estado.
 * @param {Record<string, {asignado:number, gastado:number, disponible:number, pendiente:number}>}
 *   presupuestosPorJornada Mapa id de jornada -> presupuesto.
 * @returns {{id:string, nombre:string, fecha:string, estado:string, asignado:number,
 *   gastado:number, disponible:number, porcentaje:number}[]}
 */
export function combinarJornadasConPresupuesto(jornadas = [], presupuestosPorJornada = {}) {
  return jornadas.map((jornada) => {
    const presupuesto = presupuestosPorJornada[jornada.id] ?? KPIS_VACIOS;
    return {
      id: jornada.id,
      nombre: jornada.nombre,
      fecha: jornada.fecha,
      estado: jornada.estado,
      asignado: presupuesto.asignado,
      gastado: presupuesto.gastado,
      disponible: presupuesto.disponible,
      porcentaje: calcularPorcentajeEjecutado(presupuesto.asignado, presupuesto.gastado),
    };
  });
}

/**
 * View model de la pantalla de ejecucion presupuestal, compartido por la web y la movil: ninguna
 * decision de aqui abajo depende de la plataforma (criterio 5).
 *
 * Tres llamadas por carga:
 *   1. obtenerPresupuestoSistema() -> los 4 KPIs (criterio 1). `pendiente` YA es "monto en
 *      aprobacion": la suma de gastos en estado 'pendiente'. Si falla, es el error "duro": los
 *      tres bloques de la pantalla quedan vacios, porque es el contenido principal.
 *   2. listarProyectos() + obtenerPresupuestoProyecto(id) en paralelo (Promise.all) por cada
 *      proyecto -> la lista de ejecucion por proyecto (criterio 2). Es N+1 porque
 *      presupuesto_de_proyecto (la RPC que ya existe, presupuestos/api.js) toma un solo id y no
 *      hay una version que liste todos de una vez; no se agrega una RPC nueva para esto -seria
 *      expandir el alcance de una issue de shared a un cambio de base de datos que nadie pidio-,
 *      y a la escala de proyectos de esta ONG el costo es aceptable. Un fallo aqui es blando: la
 *      lista de proyectos queda vacia y el resto de la pantalla se sigue mostrando.
 *   3. listarGastos({ estado }) -> la lista de gastos filtrada (criterio 3). Tambien blando.
 *
 * Ademas de esas tres, en paralelo con la de proyectos, se cargan los catalogos que
 * FILTROS_GASTO y CAMPOS_GASTO (filtros.js/campos.js) declaran por `opcionesDesde`
 * ('proyectos', 'jornadas', 'perfiles'): sin ellos FilterBar deja esos selects vacios y
 * deshabilitados (FilterBar.jsx). Es dato tan secundario como la lista de proyectos: un fallo
 * aqui no vacia la pantalla, solo deja ese catalogo en particular sin opciones.
 *
 * @param {string} [rol] Rol de la sesion actual, para resolver `puedeVer` con permisosDeGastos().
 *   Un rol ausente resuelve a `false`, igual que permisosDeGastos(undefined).
 */
export function useEjecucionPresupuestal(rol) {
  const [kpis, setKpis] = useState(KPIS_VACIOS);
  const [proyectos, setProyectos] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [catalogos, setCatalogos] = useState(CATALOGOS_VACIOS);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    const { presupuesto, error: errorSistema } = await obtenerPresupuestoSistema();

    if (errorSistema) {
      setKpis(KPIS_VACIOS);
      setProyectos([]);
      setGastos([]);
      setCatalogos(CATALOGOS_VACIOS);
      setError(errorSistema);
      setCargando(false);
      return;
    }

    setKpis({
      ...presupuesto,
      porcentaje: calcularPorcentajeEjecutado(presupuesto.asignado, presupuesto.gastado),
    });

    // Dato secundario: si esta parte falla, los KPIs ya cargados se quedan y la pantalla no se
    // vacia por completo (mismo criterio que pacientesPorJornada en useJornadasKanban.js).
    const [{ proyectos: filas }, { jornadas: filasDeJornada }, { usuarios: filasDePerfil }] =
      await Promise.all([listarProyectos(), listarJornadas(), listarUsuarios({ estado: true })]);

    const presupuestosPorProyecto = {};
    await Promise.all(
      filas.map(async (proyecto) => {
        const { presupuesto: presupuestoDelProyecto } = await obtenerPresupuestoProyecto(
          proyecto.id,
        );
        if (presupuestoDelProyecto) presupuestosPorProyecto[proyecto.id] = presupuestoDelProyecto;
      }),
    );
    setProyectos(combinarProyectosConPresupuesto(filas, presupuestosPorProyecto));

    setCatalogos({
      proyectos: aOpciones(filas, (proyecto) => proyecto.nombre),
      jornadas: aOpciones(filasDeJornada, (jornada) => jornada.nombre),
      perfiles: aOpciones(filasDePerfil, nombreCompletoDe),
    });

    const { gastos: filasDeGasto } = await listarGastos({ estado: filtroEstado || undefined });
    setGastos(filasDeGasto);

    setCargando(false);
  }, [filtroEstado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiarFiltroEstado = useCallback((estado) => {
    setFiltroEstado(estado || "");
  }, []);

  const limpiarFiltroEstado = useCallback(() => {
    setFiltroEstado("");
  }, []);

  const permisos = permisosDeGastos(rol);

  return {
    kpis,
    proyectos,
    gastos,
    catalogos,
    filtroEstado,
    cambiarFiltroEstado,
    limpiarFiltroEstado,
    cargando,
    error,
    recargar: cargar,
    puedeVer: permisos.puedeVerTodo,
  };
}
