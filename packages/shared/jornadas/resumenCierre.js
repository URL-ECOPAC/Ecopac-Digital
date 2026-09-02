// Resumen de cierre de una jornada (issue #183): los indicadores del dia y las advertencias que
// se muestran antes de finalizar, y que quedan consultables despues desde el detalle.
//
// FUENTE UNICA DE LOS INDICADORES (trampa 7 del issue): pacientesAtendidos, consultasRealizadas y
// tratamientosEntregados NO son un segundo calculo. Son las mismas tres funciones que
// usePanelJornada.js (issue #187, "panel de la jornada en curso") ya usa: contarPacientesDeJornada
// (atenciones/api.js), contarConsultasDeJornada y contarRecetasDeJornada (pacientes/*.api.js). No
// se usa vista_reporte_impacto (que ya consume la pestaña "Resumen" de #181, DetalleJornadaPage.jsx,
// sin tocar): esas tres funciones documentan explicitamente que coinciden en el numero con esa
// vista, con un mecanismo de acceso que no depende de leer la vista (ver atenciones/api.js:187-195).
// "Medicamentos entregados" del criterio 1 se interpreta como recetas emitidas
// (tratamientosEntregados), igual que vista_reporte_impacto.tratamientos_entregados: no se agrega
// un conteo de unidades de receta_detalle que no existe hoy como funcion reusable.
//
// "Atenciones sin consulta" (criterio 2, primera mitad) ya existe: fn_contar_atenciones_incompletas
// (migracion 00051) expuesta por contarAtencionesIncompletas() (api.js). Este archivo la reusa, pero
// NO tal cual: la funcion es SECURITY INVOKER (00051:70-76 no declara SECURITY DEFINER), corre con
// los privilegios de quien llama, y su cuerpo hace NOT EXISTS contra `consultas`, cuyo SELECT (00033)
// es solo administrador/medico. Para junta directiva y socio fundador, que ademas no tienen SELECT
// sobre `atenciones` (00033), el FROM atenciones entero queda vacio por RLS y la funcion devuelve un
// 0 REAL Y FALSO -- "todo completo" es lo opuesto de "no se pudo saber", y esta es la unica
// advertencia que justifica que esta pantalla exista. Por eso puedeVerAtencionesIncompletas() de mas
// abajo gatea la llamada: sin ese permiso, `atencionesIncompletas` queda en `null`, nunca en 0.
// Mismo defecto exacto tenia contarPacientesDeJornada() (atenciones/api.js): no recibe `rol` y lee
// `atenciones` directo, cuyo SELECT (00033) tampoco alcanza a junta directiva ni a socio fundador --
// puedeVerAtenciones() de mas abajo gatea esa llamada tambien, por la misma razon.
//
// "Movimientos pendientes de validar" (criterio 2, segunda mitad) es lo unico que faltaba.
// movimientos_inventario no tiene jornada_id (cuelga de bodega_id, ver movimientos.api.js:9-12): el
// botiquin de una jornada es jornadas.botiquin_bodega_id (00036, nullable). listarMovimientos() ya
// acepta filtrar por bodega_id (movimientos.api.js), asi que "pendientes del botiquin de esta
// jornada" es ese filtro con estado 'pendiente', sin RPC ni tabla nueva. usePendientesValidacion.js
// (#158) no se toca: cuenta pendientes globales, no por jornada, y ese archivo no es dueño de esa
// distincion.
//
// SELECT sobre movimientos_inventario esta abierto a cualquier sesion activa (politica "Sesion
// activa lee movimientos_inventario", 00079:204-205: `USING (public.rol_actual() IS NOT NULL)`), a
// diferencia de consultas/atenciones/recetas: no hace falta gatear este conteo por rol.
//
// "Del botiquin de esta jornada", no "de esta jornada" (a proposito, ver el texto que arma
// DetalleJornadaPage.jsx con este numero): jornadas.botiquin_bodega_id NO tiene UNIQUE (00036), asi
// que nada en el esquema impide que dos jornadas compartan bodega -- si eso pasara, el numero
// incluiria movimientos de la otra jornada. En la practica esto no se puede probar hoy: campos.js
// declara el campo `botiquinBodega` (CAMPOS_JORNADA) pero lo excluye a proposito de
// IDS_CAMPOS_FORMULARIO_JORNADA (el subconjunto que arma ModalJornada.jsx, issue #179), asi que
// ninguna pantalla del repo permite asignarle un botiquin a una jornada: botiquinBodegaId es null
// para toda jornada creada desde la UI, y esta advertencia no tiene con que dispararse todavia.
// Corregir eso es tocar el formulario de alta/edicion de jornada, fuera de la excepcion de alcance
// de #183 (solo DetalleJornadaPage.jsx y la pagina del Kanban) -- queda reportado, no arreglado aca.

import { contarPacientesDeJornada } from "../atenciones/api.js";
import { ESTADOS_MOVIMIENTO } from "../enums.js";
import { listarMovimientos } from "../inventario/movimientos.api.js";
import { contarConsultasDeJornada } from "../pacientes/consultas.api.js";
import { puedeVerHistorial as puedeVerDatosClinicos } from "../pacientes/permisos.js";
import { contarRecetasDeJornada } from "../pacientes/recetas.api.js";
import { esAdministrador, ROLES } from "../usuarios/roles.js";
import { contarAtencionesIncompletas } from "./api.js";

/**
 * Puede ver cuantos pacientes tiene registrados una jornada.
 *
 * Espejo de la politica de SELECT de `atenciones` (00033): administrador, medico y voluntario
 * general. contarPacientesDeJornada() (atenciones/api.js) no toma `rol` ni gatea nada por su
 * cuenta -- sin este chequeo, para junta directiva y socio fundador (que no estan en esa politica)
 * devolveria 0 real, RLS filtrando toda la tabla, indistinguible de "cero pacientes de verdad".
 */
function puedeVerAtenciones(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO || rol === ROLES.VOLUNTARIO;
}

/**
 * Puede ver si hay atenciones sin consulta.
 *
 * fn_contar_atenciones_incompletas (00051) es SECURITY INVOKER y su NOT EXISTS lee `consultas`
 * (00033: solo administrador/medico). Reusa puedeVerDatosClinicos() (pacientes/permisos.js,
 * mismo par de roles) en vez de declarar un espejo nuevo de la misma politica.
 */
const puedeVerAtencionesIncompletas = puedeVerDatosClinicos;

/**
 * Cuenta los movimientos de inventario pendientes de validar contra el botiquin de una jornada.
 *
 * Una jornada sin botiquin asignado (botiquinBodegaId null -- hoy, todas: ver el encabezado de
 * este archivo) no tiene bodega que consultar: devuelve 0, no un error ni un guion, porque no hay
 * ningun movimiento que pudiera estar pendiente sin una bodega que los agrupe.
 *
 * @param {string|null|undefined} botiquinBodegaId
 * @returns {Promise<{ cantidad: number, error: object|null }>}
 */
export async function contarMovimientosPendientesDelBotiquin(botiquinBodegaId) {
  if (!botiquinBodegaId) return { cantidad: 0, error: null };

  const { datos, error } = await listarMovimientos({
    estado: ESTADOS_MOVIMIENTO.PENDIENTE,
    bodega_id: botiquinBodegaId,
  });

  if (error) return { cantidad: 0, error };
  return { cantidad: datos.length, error: null };
}

/**
 * Arma el resumen de cierre de una jornada (issue #183, criterios 1 y 2): los tres indicadores del
 * dia mas las dos advertencias (atenciones sin consulta, movimientos pendientes).
 *
 * Las cinco consultas corren en paralelo (dos de ellas gateadas por rol ANTES de llamar: ver
 * puedeVerAtenciones()/puedeVerAtencionesIncompletas() mas arriba). Un fallo de cualquiera de ellas
 * no tumba el resumen entero -- cada funcion ya devuelve su propio valor "sin dato" (`null` para
 * todo lo que RLS le puede esconder a un rol: los tres indicadores clinicos y la advertencia de
 * atenciones incompletas; `0` solo para movimientos pendientes, que no tiene ese problema de
 * permisos) y `error` solo lleva el primero que haya ocurrido, para que la pantalla pueda avisar
 * sin dejar de mostrar lo que si se pudo calcular. Mismo criterio que obtenerJornadasDePersona()
 * (api.js) usa para su propio Promise.all.
 *
 * @param {{ id: string, botiquinBodegaId?: string|null }} jornada
 * @param {{ rol?: string }} [opciones]
 * @returns {Promise<{
 *   indicadores: { pacientesAtendidos: number|null, consultasRealizadas: number|null, tratamientosEntregados: number|null },
 *   atencionesIncompletas: number|null,
 *   movimientosPendientes: number,
 *   error: object|null,
 * }>}
 */
export async function obtenerResumenCierre(jornada, { rol } = {}) {
  const jornadaId = jornada?.id;

  if (!jornadaId) {
    return {
      indicadores: { pacientesAtendidos: null, consultasRealizadas: null, tratamientosEntregados: null },
      atencionesIncompletas: null,
      movimientosPendientes: 0,
      error: null,
    };
  }

  const sinDato = Promise.resolve({ cantidad: null, error: null });

  const [
    respuestaPacientes,
    respuestaConsultas,
    respuestaRecetas,
    respuestaIncompletas,
    respuestaPendientes,
  ] = await Promise.all([
    puedeVerAtenciones(rol) ? contarPacientesDeJornada(jornadaId) : sinDato,
    contarConsultasDeJornada(jornadaId, { rol }),
    contarRecetasDeJornada(jornadaId, { rol }),
    puedeVerAtencionesIncompletas(rol) ? contarAtencionesIncompletas(jornadaId) : sinDato,
    contarMovimientosPendientesDelBotiquin(jornada?.botiquinBodegaId),
  ]);

  return {
    indicadores: {
      pacientesAtendidos: respuestaPacientes.cantidad,
      consultasRealizadas: respuestaConsultas.cantidad,
      tratamientosEntregados: respuestaRecetas.cantidad,
    },
    atencionesIncompletas: respuestaIncompletas.cantidad,
    movimientosPendientes: respuestaPendientes.cantidad,
    error:
      respuestaPacientes.error ??
      respuestaConsultas.error ??
      respuestaRecetas.error ??
      respuestaIncompletas.error ??
      respuestaPendientes.error ??
      null,
  };
}

/**
 * Indica si un resumen de cierre tiene algo que advertir (issue #183, criterio 2).
 *
 * `atencionesIncompletas` en `null` (rol sin acceso a datos clinicos, ver mas arriba) NO cuenta
 * como advertencia: esta funcion no puede avisar de algo que no pudo calcular. Es intencional que
 * eso tampoco alcance para pintar el aviso contrario ("todo en orden") -- quien consuma esta
 * funcion tiene que mostrar por separado que ese dato en particular no se pudo verificar (ver
 * DetalleJornadaPage.jsx), no inferir de `hayAdvertenciasDeCierre() === false` que la jornada esta
 * lista.
 *
 * Funcion pura, separada de obtenerResumenCierre() para poder probarla sin mockear ningun modulo
 * de red, mismo criterio que necesitaAvisoDeAtencionesIncompletas() en useJornadasKanban.js.
 * "Advertir" nunca es "impedir" (criterio 8): esta funcion solo decide si se pinta el aviso, nunca
 * si el boton de confirmar se deshabilita.
 *
 * @param {{ atencionesIncompletas: number|null, movimientosPendientes: number }} resumen
 * @returns {boolean}
 */
export function hayAdvertenciasDeCierre(resumen) {
  return (resumen?.atencionesIncompletas ?? 0) > 0 || (resumen?.movimientosPendientes ?? 0) > 0;
}
