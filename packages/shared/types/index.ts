// Tipos TypeScript compartidos entre web y mobile
// - Patient: datos y historial clínico
// - Medicine: medicamento, lote, fecha de vencimiento
// - OutreachDay: jornada, voluntarios, locación
// - Recurso, Donación, Reporte, etc.
//
// RolUsuario y Permiso se retiraron en la issue #396: eran del Modelo B de permisos
// (utils/permisos.ts), con roles capitalizados que no coinciden con el enum rol_usuario de la
// base. Si un tipo de rol hace falta, se deriva de ROLES en usuarios/roles.js, que es la
// fuente de verdad.
