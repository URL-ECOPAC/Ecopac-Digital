// Modulo de la bitacora de auditoria (issue #643). Solo lectura, sin campos.js ni
// validaciones.js: no hay formulario, la pantalla es un listado sobre eventos_auditoria
// (00026_auditoria_borrado_logico.sql).

export * from "./api.js";
export * from "./permisos.js";
export * from "./columnas.js";
export * from "./filtros.js";
export * from "./detalle.js";
export {
  useBitacoraAuditoria,
  armarFilasDeAuditoria,
  calcularPaginasDeAuditoria,
  EVENTOS_POR_PAGINA,
} from "./useBitacoraAuditoria.js";
