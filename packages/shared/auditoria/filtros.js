// Filtros de la bitacora de auditoria (issue #643).

import { SUBTIPOS_DE_RANGO, TIPOS_DE_FILTRO } from "../descriptores.js";

/**
 * Las tablas que escriben en eventos_auditoria, una por cada
 * `CREATE TRIGGER ... EXECUTE FUNCTION registrar_evento_auditoria[_usuario_permiso|_rol_permiso]()`
 * de supabase/migrations/ (00026, 00045, 00070, 00139, 00148, 00149 y la 00152, que audita todas
 * las tablas de negocio). Es una lista a mano y no una consulta al catalogo de Postgres: auditar
 * una tabla nueva es de por si un cambio de migracion deliberado, y ese mismo PR actualiza esta
 * lista. etiquetaDeTablaAuditada() cubre el olvido si se repite. Ordenadas por modulo.
 */
export const TABLAS_AUDITADAS = [
  // Pacientes y atencion clinica
  { value: "pacientes", label: "Pacientes" },
  { value: "expedientes", label: "Expedientes" },
  { value: "padecimientos_cronicos", label: "Padecimientos crónicos" },
  { value: "fusiones_pacientes", label: "Fusiones de expedientes" },
  { value: "atenciones", label: "Atenciones" },
  { value: "triajes", label: "Signos vitales" },
  { value: "consultas", label: "Consultas" },
  { value: "consulta_diagnostico", label: "Diagnósticos de consulta" },
  { value: "recetas", label: "Recetas" },
  { value: "receta_detalle", label: "Medicamentos de receta" },
  { value: "diagnosticos", label: "Catálogo de diagnósticos" },
  { value: "condiciones_cronicas", label: "Catálogo de condiciones crónicas" },
  { value: "comunidades", label: "Comunidades" },
  // Inventario
  { value: "medicamentos", label: "Medicamentos e insumos" },
  { value: "medicamento_principio", label: "Principios de un medicamento" },
  { value: "principios_activos", label: "Principios activos" },
  { value: "presentaciones", label: "Presentaciones" },
  { value: "bodegas", label: "Bodegas" },
  { value: "proveedores", label: "Proveedores" },
  { value: "lotes", label: "Lotes" },
  { value: "movimientos_inventario", label: "Movimientos de inventario" },
  { value: "alertas_caducidad", label: "Alertas de vencimiento" },
  { value: "configuracion_alertas_caducidad", label: "Avisos de vencimiento (configuración)" },
  // Jornadas
  { value: "jornadas", label: "Jornadas" },
  { value: "jornada_personal", label: "Equipo de jornada" },
  { value: "jornada_presupuesto_origen", label: "Aportes al presupuesto" },
  { value: "fuentes_de_presupuesto", label: "Fuentes de aportes" },
  { value: "jornada_insumos", label: "Insumos de jornada" },
  // Proyectos y presupuesto
  { value: "proyectos", label: "Proyectos" },
  { value: "proyecto_personal", label: "Equipo de proyecto" },
  { value: "proyecto_hitos", label: "Hitos de proyecto" },
  { value: "proyecto_seguimiento", label: "Seguimiento de proyecto" },
  { value: "proyecto_insumos", label: "Insumos de proyecto" },
  { value: "gastos", label: "Gastos" },
  // Donaciones
  { value: "donantes", label: "Donantes" },
  { value: "donaciones", label: "Donaciones" },
  { value: "donacion_detalle", label: "Detalle de donación" },
  // Usuarios y permisos
  { value: "perfiles", label: "Perfiles de usuario" },
  { value: "perfil_especialidad", label: "Especialidades" },
  { value: "usuario_permiso", label: "Permisos por usuario" },
  { value: "rol_permiso", label: "Permisos por rol" },
  { value: "rol_modulo", label: "Acceso a módulos por rol" },
];

/**
 * Etiqueta legible de una tabla auditada: la de TABLAS_AUDITADAS, o, si la tabla no esta en la
 * lista, su nombre con los guiones bajos como espacios ("rol_permiso" -> "Rol permiso"), nunca el
 * nombre crudo de Postgres.
 *
 * @param {string} tabla Valor de eventos_auditoria.tabla_afectada.
 * @returns {string}
 */
export function etiquetaDeTablaAuditada(tabla) {
  const conocida = TABLAS_AUDITADAS.find((opcion) => opcion.value === tabla);
  if (conocida) return conocida.label;
  const texto = String(tabla ?? "").replaceAll("_", " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export const FILTROS_BITACORA_AUDITORIA_VACIOS = {
  usuarioId: null,
  tablaAfectada: null,
  fecha: { min: null, max: null },
};

export const FILTROS_BITACORA_AUDITORIA = [
  {
    id: "usuarioId",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Usuario",
    opcionesDesde: "perfiles",
  },
  {
    id: "tablaAfectada",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Tabla afectada",
    opciones: TABLAS_AUDITADAS,
  },
  {
    id: "fecha",
    tipo: TIPOS_DE_FILTRO.RANGO,
    subtipo: SUBTIPOS_DE_RANGO.FECHA,
    label: "Fecha",
  },
];
