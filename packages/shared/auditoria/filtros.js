// Filtros de la bitacora de auditoria (issue #643).

import { SUBTIPOS_DE_RANGO, TIPOS_DE_FILTRO } from "../descriptores.js";

/**
 * Las ocho tablas que hoy escriben en eventos_auditoria, una por cada
 * `CREATE TRIGGER ... EXECUTE FUNCTION registrar_evento_auditoria[_usuario_permiso]()` de
 * supabase/migrations/ (00026, 00045, 00070). Es una lista a mano y no una consulta al
 * catalogo de Postgres: audita una tabla nueva es de por si un cambio de migracion deliberado,
 * y ese mismo PR actualiza esta lista.
 */
export const TABLAS_AUDITADAS = [
  { value: "pacientes", label: "Pacientes" },
  { value: "expedientes", label: "Expedientes" },
  { value: "consultas", label: "Consultas" },
  { value: "recetas", label: "Recetas" },
  { value: "movimientos_inventario", label: "Movimientos de inventario" },
  { value: "perfiles", label: "Perfiles de usuario" },
  { value: "usuario_permiso", label: "Permisos por usuario" },
  { value: "padecimientos_cronicos", label: "Padecimientos crónicos" },
];

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
