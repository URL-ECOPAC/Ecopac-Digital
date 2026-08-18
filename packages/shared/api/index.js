// Acceso a Supabase.
//
// Este es el unico lugar del monorepo que importa @supabase/supabase-js. Ni apps/web ni
// apps/mobile pueden hacerlo por su cuenta (regla de AGENTS.md): si lo hicieran, cada app
// terminaria con su propia sesion y sus propias reglas.
//
// Aqui vive la infraestructura del cliente. Las consultas de cada modulo van en el api.js
// de su carpeta (packages/shared/pacientes/api.js, etc.) y usan obtenerSupabase().

export * from "./almacenamiento.js";
export * from "./cliente.js";
export * from "./errores.js";
export * from "./errores-de-supabase.js";
