// Esquema declarativo de los formularios del modulo de presupuestos (issue #288).
//
// Reescrito para que hable el contrato que consumen las dos apps. La version anterior declaraba un
// objeto con claves `key`, `requerido` suelto y cadenas crudas como tipo ('text', 'number',
// 'file', 'textarea'), ninguna de las cuales esta en TIPOS_DE_CAMPO. Los componentes de formulario
// recorren una LISTA y comparan el tipo contra el vocabulario de descriptores.js, asi que aquello
// no se dibujaba.
//
// Los ids son los de las columnas de gastos en 00025_presupuesto_gastos.sql:
//
//   gastos (id, jornada_id, concepto, categoria, monto, fecha, responsable_id, estado,
//           registrado_por, aprobado_por, aprobado_en, created_at, updated_at)
//
// La version anterior declaraba `categoria_id`, `fecha_gasto`, `proyecto_id`, `comprobante_url` y
// `observaciones`. Las tres ultimas no existen en la tabla, y las dos primeras se llaman
// `categoria` y `fecha`, que es lo que ya usa presupuestos/api.js: el modulo se contradecia a si
// mismo.
//
// Ver packages/shared/pacientes/campos.js, que es el ejemplar de referencia.

import { TIPOS_DE_CAMPO } from "../descriptores.js";

/**
 * Valores del enum categoria_gasto (supabase/migrations/00025_presupuesto_gastos.sql).
 *
 * Van capitalizados porque asi estan declarados en la migracion, que es la fuente de verdad
 * (AGENTS.md). Se listan aqui una sola vez para que ninguna pantalla escriba el valor a mano.
 */
export const CATEGORIAS_DE_GASTO = {
  MEDICAMENTOS: "Medicamentos",
  LOGISTICA: "Logistica",
  DIAGNOSTICO: "Diagnostico",
  HONORARIOS: "Honorarios",
  EDUCACION: "Educacion",
  INFRAESTRUCTURA: "Infraestructura",
};

export const OPCIONES_CATEGORIA_GASTO = [
  { value: CATEGORIAS_DE_GASTO.MEDICAMENTOS, label: "Medicamentos" },
  { value: CATEGORIAS_DE_GASTO.LOGISTICA, label: "Logistica" },
  { value: CATEGORIAS_DE_GASTO.DIAGNOSTICO, label: "Diagnostico" },
  { value: CATEGORIAS_DE_GASTO.HONORARIOS, label: "Honorarios" },
  { value: CATEGORIAS_DE_GASTO.EDUCACION, label: "Educacion" },
  { value: CATEGORIAS_DE_GASTO.INFRAESTRUCTURA, label: "Infraestructura" },
];

/**
 * Valores del enum estado_gasto (00089, issue #412).
 *
 * Hasta la 00089, gastos.estado reutilizaba estado_movimiento (pensado para
 * movimientos_inventario, 00023); ahora tiene su propio tipo, con el mismo vocabulario:
 * 'pendiente', 'aprobado' y 'rechazado'.
 *
 * Esta constante es la que el PR #448 intentaba importar de @ecopac/ui-tokens como
 * `ESTADOS_GASTO`, y por eso rompio el build: ui-tokens no exporta eso ni deberia, porque un
 * valor de enum del dominio no es un token de diseno.
 */
export const ESTADOS_DE_GASTO = {
  PENDIENTE: "pendiente",
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
};

export const OPCIONES_ESTADO_GASTO = [
  { value: ESTADOS_DE_GASTO.PENDIENTE, label: "Pendiente" },
  { value: ESTADOS_DE_GASTO.APROBADO, label: "Aprobado" },
  { value: ESTADOS_DE_GASTO.RECHAZADO, label: "Rechazado" },
];

/**
 * Formulario de registro y edicion de un gasto.
 *
 * `estado`, `registrado_por`, `aprobado_por` y `aprobado_en` no estan aqui a proposito: no
 * los escribe quien registra el gasto. `estado` nace en 'pendiente' por DEFAULT de la tabla y solo
 * cambia por la bandeja de aprobacion (issue #299).
 */
export const CAMPOS_GASTO = [
  {
    id: "concepto",
    label: "Concepto del gasto",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    placeholder: "Ej. Compra de insumos medicos",
    validacion: { requerido: true },
  },
  {
    id: "categoria",
    label: "Categoria",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opciones: OPCIONES_CATEGORIA_GASTO,
    validacion: { requerido: true },
  },
  {
    id: "monto",
    label: "Monto (Q)",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    // CHECK (monto > 0) en 00025: el minimo no es una preferencia de la pantalla.
    validacion: { requerido: true, minimo: 0.01 },
  },
  {
    id: "fecha",
    label: "Fecha del gasto",
    tipo: TIPOS_DE_CAMPO.FECHA,
    validacion: { requerido: true },
  },
  {
    id: "jornada_id",
    label: "Jornada",
    tipo: TIPOS_DE_CAMPO.SELECT,
    // NOT NULL en 00025: todo gasto cuelga de una jornada. El proyecto no se elige aqui, se
    // deduce de la jornada (jornadas.proyecto_id).
    opcionesDesde: "jornadas",
    validacion: { requerido: true },
  },
  {
    id: "responsable_id",
    label: "Responsable",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "perfiles",
  },
];
