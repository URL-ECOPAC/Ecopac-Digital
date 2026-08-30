// Reglas de negocio de presupuestos y gastos (issue #296).
//
// Correccion respecto a la primera version: leia `gasto.categoria_id` y `gasto.fecha_gasto`, dos
// claves que no existen. Las columnas de la tabla `gastos` (00025_presupuesto_gastos.sql) son
// `categoria` y `fecha`, que es lo que ya escribia y filtraba presupuestos/api.js, asi que las
// validaciones no llegaban a mirar los datos reales: daban por faltantes campos que si venian, y
// dejaban pasar los que no.
//
// La lista de categorias validas ya no se recibe por parametro: sale de CATEGORIAS_DE_GASTO en
// campos.js, que replica el enum categoria_gasto de la migracion. Pasarla desde fuera invitaba a
// que cada pantalla trajera su propia copia, que es el bug que esta misma rama corrige en
// donaciones.

import { CATEGORIAS_DE_GASTO } from "../enums.js";

const CATEGORIAS_VALIDAS = Object.values(CATEGORIAS_DE_GASTO);

function estaVacio(valor) {
  return valor === undefined || valor === null || String(valor).trim() === "";
}

/**
 * Valida los datos de un gasto segun las reglas de negocio del modulo de presupuestos.
 *
 * Criterios de aceptacion de #296:
 * - El monto de un gasto debe ser mayor que cero.
 * - La fecha no puede ser posterior a hoy ni anterior al inicio de su jornada.
 * - El concepto y la categoria son obligatorios, y la categoria debe existir en el enum.
 * - Un gasto que dejaria la jornada por encima de su presupuesto asignado se marca como excedente
 *   (aviso, sin bloquear).
 *
 * @param {{ concepto?: string, categoria?: string, monto?: number|string, fecha?: string,
 *   jornada_id?: string }} gasto Datos del gasto, con las claves de las columnas de `gastos`.
 * @param {{ presupuesto_asignado?: number, fecha_inicio?: string, gasto_acumulado?: number }|null}
 *   [jornada] Datos de la jornada a la que se carga el gasto.
 * @returns {{ valido: boolean, errores: string[], esExcedente: boolean,
 *   mensajeExcedente: string|null }}
 */
export function validarGasto(gasto = {}, jornada = null) {
  const errores = [];
  let esExcedente = false;
  let mensajeExcedente = null;

  // 1. Concepto obligatorio (columna NOT NULL).
  if (estaVacio(gasto.concepto)) {
    errores.push("El concepto del gasto es obligatorio.");
  }

  // 2. Categoria obligatoria y dentro del enum categoria_gasto.
  if (estaVacio(gasto.categoria)) {
    errores.push("La categoria de gasto es obligatoria.");
  } else if (!CATEGORIAS_VALIDAS.includes(gasto.categoria)) {
    errores.push("La categoria seleccionada no es valida.");
  }

  // 3. Monto mayor que cero. Lo mismo exige CHECK (monto > 0) en la tabla; se adelanta aqui para
  //    dar el mensaje en el formulario en vez de esperar el rechazo de Postgres.
  const monto = Number(gasto.monto);
  const montoEsNumero = !estaVacio(gasto.monto) && !Number.isNaN(monto);
  if (!montoEsNumero || monto <= 0) {
    errores.push("El monto del gasto debe ser mayor que cero.");
  }

  // 4. Fecha: ni futura ni anterior al inicio de la jornada.
  if (estaVacio(gasto.fecha)) {
    errores.push("La fecha del gasto es obligatoria.");
  } else {
    const fecha = new Date(gasto.fecha);

    if (Number.isNaN(fecha.getTime())) {
      errores.push("La fecha proporcionada no es valida.");
    } else {
      // Fin del dia de hoy: un gasto registrado hoy no puede contar como futuro por la hora.
      const hoy = new Date();
      hoy.setHours(23, 59, 59, 999);

      if (fecha > hoy) {
        errores.push("La fecha de un gasto no puede ser posterior a hoy.");
      }

      if (jornada?.fecha_inicio) {
        const inicioDeJornada = new Date(jornada.fecha_inicio);
        inicioDeJornada.setHours(0, 0, 0, 0);

        if (fecha < inicioDeJornada) {
          errores.push("La fecha del gasto no puede ser anterior al inicio de su jornada.");
        }
      }
    }
  }

  // 5. Excedente de presupuesto: avisa, no bloquea. Una jornada en campo no se detiene porque el
  //    presupuesto se quede corto; lo que se necesita es que quede registrado.
  if (jornada && jornada.presupuesto_asignado !== undefined && montoEsNumero) {
    const acumulado = Number(jornada.gasto_acumulado ?? 0);
    const asignado = Number(jornada.presupuesto_asignado);
    const total = acumulado + monto;

    if (total > asignado) {
      esExcedente = true;
      const diferencia = total - asignado;
      mensajeExcedente =
        `Atencion: este gasto deja la jornada por encima de su presupuesto asignado por ` +
        `Q${diferencia.toFixed(2)}. El registro se permite igual.`;
    }
  }

  return {
    valido: errores.length === 0,
    errores,
    esExcedente,
    mensajeExcedente,
  };
}
