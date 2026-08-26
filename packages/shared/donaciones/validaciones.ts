import { DonanteInput, DonacionInput, ErroresValidacion } from '../types/donaciones';

/**
 * Valida que el donante tenga nombre y al menos un dato de contacto (teléfono o correo).
 */
export function validarDonante(donante: Partial<DonanteInput>): ErroresValidacion {
  const errores: ErroresValidacion = {};

  if (!donante.nombre || donante.nombre.trim() === '') {
    errores.nombre = 'El nombre del donante es obligatorio.';
  }

  const tieneTelefono = Boolean(donante.telefono && donante.telefono.trim() !== '');
  const tieneCorreo = Boolean(donante.correo && donante.correo.trim() !== '');

  if (!tieneTelefono && !tieneCorreo) {
    errores.contacto = 'Debe proporcionar al menos un dato de contacto (teléfono o correo).';
  }

  return errores;
}

/**
 * Valida las reglas de negocio de una donación:
 * - Fecha no futura.
 * - Si es MEDICAMENTOS: exige al menos 1 renglón con cantidad > 0 y vencimiento válido.
 * - Si es DINERO: exige monto > 0 y moneda.
 */
export function validarDonacion(donacion: Partial<DonacionInput>): ErroresValidacion {
  const errores: ErroresValidacion = {};

  if (!donacion.donanteId) {
    errores.donanteId = 'Debe seleccionar un donante válido.';
  }

  if (!donacion.tipo) {
    errores.tipo = 'El tipo de donación es obligatorio.';
  }

  // 1. Validación de fecha no futura
  if (!donacion.fecha) {
    errores.fecha = 'La fecha de la donación es obligatoria.';
  } else {
    const fechaDonacion = new Date(donacion.fecha);
    const hoy = new Date();
    
    // Normalizar a fin del día actual para evitar falsos positivos por horas
    hoy.setHours(23, 59, 59, 999);

    if (isNaN(fechaDonacion.getTime())) {
      errores.fecha = 'La fecha proporcionada no es válida.';
    } else if (fechaDonacion > hoy) {
      errores.fecha = 'La fecha de la donación no puede ser futura.';
    }
  }

  // 2. Validación de detalle coherente según tipo de donación
  if (donacion.tipo === 'DINERO') {
    if (donacion.monto === undefined || donacion.monto === null || donacion.monto <= 0) {
      errores.monto = 'Una donación en dinero exige un monto mayor a cero.';
    }
    if (!donacion.moneda || donacion.moneda.trim() === '') {
      errores.moneda = 'Debe especificar la moneda para la donación en dinero.';
    }
  }

  if (donacion.tipo === 'MEDICAMENTOS') {
    if (!donacion.detallesMedicamentos || donacion.detallesMedicamentos.length === 0) {
      errores.detallesMedicamentos = 'Una donación de medicamentos exige al menos un renglón de detalle.';
    } else {
      donacion.detallesMedicamentos.forEach((item, index) => {
        if (!item.cantidad || item.cantidad <= 0) {
          errores[`detallesMedicamentos_${index}_cantidad`] = `El renglón ${index + 1} debe incluir una cantidad mayor a cero.`;
        }
        if (!item.fechaVencimiento || isNaN(new Date(item.fechaVencimiento).getTime())) {
          errores[`detallesMedicamentos_${index}_vencimiento`] = `El renglón ${index + 1} exige una fecha de vencimiento válida.`;
        }
      });
    }
  }

  return errores;
}