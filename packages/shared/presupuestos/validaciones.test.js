import { describe, it, expect } from 'vitest';
import { validarGasto } from './validaciones.js';

describe('Validaciones de Presupuestos y Gastos', () => {
  const categoriasEjemplo = ['insumos', 'transporte', 'alimentacion'];

  it('debe aprobar un gasto válido dentro del presupuesto', () => {
    const gasto = {
      concepto: 'Compra de mascarillas',
      categoria_id: 'insumos',
      monto: 150.00,
      fecha_gasto: new Date().toISOString().split('T')[0],
    };
    const jornada = {
      fecha_inicio: '2026-01-01',
      presupuesto_asignado: 1000.00,
      gasto_acumulado: 200.00,
    };

    const resultado = validarGasto(gasto, jornada, categoriasEjemplo);
    expect(resultado.valido).toBe(true);
    expect(resultado.errores.length).toBe(0);
    expect(resultado.esExcedente).toBe(false);
  });

  it('debe rechazar montos menores o iguales a cero', () => {
    const gasto = {
      concepto: 'Prueba',
      categoria_id: 'insumos',
      monto: 0,
      fecha_gasto: new Date().toISOString().split('T')[0],
    };
    const resultado = validarGasto(gasto, null, categoriasEjemplo);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores).toContain('El monto del gasto debe ser mayor que cero.');
  });

  it('debe marcar como excedente sin bloquear si supera el presupuesto de la jornada', () => {
    const gasto = {
      concepto: 'Alquiler extra de planta',
      categoria_id: 'transporte',
      monto: 500.00,
      fecha_gasto: new Date().toISOString().split('T')[0],
    };
    const jornada = {
      fecha_inicio: '2026-01-01',
      presupuesto_asignado: 1000.00,
      gasto_acumulado: 800.00,
    };

    const resultado = validarGasto(gasto, jornada, categoriasEjemplo);
    expect(resultado.valido).toBe(true); // Sigue siendo válido (no bloquea)
    expect(resultado.esExcedente).toBe(true);
    expect(resultado.mensajeExcedente).toBeDefined();
  });
});