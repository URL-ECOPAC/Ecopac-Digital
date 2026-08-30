// Tipos del dominio compartidos entre web y movil.
//
// Se documentan con JSDoc (`@typedef`), no con TypeScript. Es la decision A de la issue #493:
// packages/shared se escribe en JavaScript, porque un `.ts` queda fuera del bloque de la
// frontera de eslint.config.mjs -que solo alcanza {js,jsx}- y entra sin pasar por
// no-restricted-imports ni no-restricted-globals. La regla y su porque estan en
// docs/ARQUITECTURA-FRONTEND.md, en "La frontera, en concreto".
//
// Este archivo es donde van los tipos base del dominio cuando se escriba la issue #48.
//
// RolUsuario y Permiso se retiraron en la issue #396: eran del Modelo B de permisos
// (utils/permisos.ts), con roles capitalizados que no coinciden con el enum rol_usuario de la
// base. Si un tipo de rol hace falta, se deriva de ROLES en usuarios/roles.js, que es la
// fuente de verdad.
