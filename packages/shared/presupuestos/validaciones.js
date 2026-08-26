/**
 * Valida los datos de un gasto según las reglas de negocio del módulo de presupuestos.
 * 
 * Criterios de aceptación:
 * - El monto de un gasto debe ser mayor que cero.
 * - La fecha de un gasto no puede ser posterior a hoy ni anterior al inicio de su jornada.
 * - El concepto y la categoría son obligatorios, y la categoría debe existir en el enum.
 * - Un gasto que dejaría la jornada por encima de su presupuesto asignado se marca como excedente (aviso, sin bloquear).
 * 
 * @param {Object} gasto - Datos del gasto a validar.
 * @param {Object} jornada - Datos de la jornada (presupuesto asignado, fecha de inicio, acumulado actual).
 * @param {Array<string>} categoriasValidas - Lista de categorías permitidas (enum).
 * @returns {Object} Resultado con { valido, errores, esExcedente, mensajeExcedente }
 */
export function validarGasto(gasto, jornada = null, categoriasValidas = []) {
  const errores = [];
  let esExcedente = false;
  let mensajeExcedente = null;

  // 1. Concepto obligatorio
  if (!gasto.concepto || typeof gasto.concepto !== 'string' || gasto.concepto.trim() === '') {
    errores.push('El concepto del gasto es obligatorio.');
  }

  // 2. Categoría obligatoria y existente en el enum
  if (!gasto.categoria_id) {
    errores.push('La categoría de gasto es obligatoria.');
  } else if (categoriasValidas.length > 0 && !categoriasValidas.includes(gasto.categoria_id)) {
    errores.push('La categoría seleccionada no es válida.');
  }

  // 3. Monto mayor que cero
  const montoNum = Number(gasto.monto);
  if (isNaN(montoNum) || montoNum <= 0) {
    errores.push('El monto del gasto debe ser mayor que cero.');
  }

  // 4. Fechas (no posterior a hoy, ni anterior al inicio de la jornada)
  if (!gasto.fecha_gasto) {
    errores.push('La fecha del gasto es obligatoria.');
  } else {
    const fechaGasto = new Date(gasto.fecha_gasto);
    const hoy = new Date();
    // Normalizar horas para comparar solo fechas limpias
    hoy.setHours(23, 59, 59, 999);

    if (fechaGasto > hoy) {
      errores.push('La fecha de un gasto no puede ser posterior a hoy.');
    }

    if (jornada && jornada.fecha_inicio) {
      const fechaInicioJornada = new Date(jornada.fecha_inicio);
      fechaInicioJornada.setHours(0, 0, 0, 0);
      if (fechaGasto < fechaInicioJornada) {
        errores.push('La fecha del gasto no puede ser anterior al inicio de su jornada.');
      }
    }
  }

  // 5. Validación de presupuesto asignado (Excedente sin bloqueo)
  if (jornada && jornada.presupuesto_asignado !== undefined && !isNaN(montoNum)) {
    const gastadoActual = Number(jornada.gasto_acumulado || 0);
    const presupuestoAsignado = Number(jornada.presupuesto_asignado);
    const nuevoTotal = gastadoActual + montoNum;

    if (nuevoTotal > presupuestoAsignado) {
      esExcedente = true;
      const diferencia = nuevoTotal - presupuestoAsignado;
      mensajeExcedente = `Atención: Este gasto deja la jornada por encima de su presupuesto asignado por un excedente de Q${diferencia.toFixed(2)}. El registro es permitido.`;
    }
  }

  return {
    valido: errores.length === 0,
    errores,
    esExcedente,
    mensajeExcedente,
  };
}