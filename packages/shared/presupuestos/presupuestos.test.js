import { describe, it, expect } from 'vitest';
import { CAMPOS_GASTO, COLUMNAS_GASTOS_TABLA, CAMPOS_GASTO_TARJETA, FILTROS_GASTOS } from './index.js';

describe('Descriptores de Presupuestos', () => {
  it('debe exportar la estructura correcta de CAMPOS_GASTO', () => {
    expect(CAMPOS_GASTO).toBeDefined();
    expect(CAMPOS_GASTO.concepto).toHaveProperty('label');
    expect(CAMPOS_GASTO.monto).toHaveProperty('tipo', 'number');
  });

  it('debe exportar las columnas de tabla y tarjeta', () => {
    expect(Array.isArray(COLUMNAS_GASTOS_TABLA)).toBe(true);
    expect(Array.isArray(CAMPOS_GASTO_TARJETA)).toBe(true);
    expect(COLUMNAS_GASTOS_TABLA.length).toBeGreaterThan(0);
  });

  it('debe exportar los filtros de presupuesto y gastos', () => {
    expect(FILTROS_GASTOS).toBeDefined();
    expect(FILTROS_GASTOS.estado).toHaveProperty('opcionesOrigen', 'ui-tokens');
  });
});
