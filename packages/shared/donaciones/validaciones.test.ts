import { validarDonante, validarDonacion } from './validaciones';
import { describe, it, expect } from 'vitest';

describe('Validaciones de Donantes (#189)', () => {
  it('falla si no tiene nombre ni contacto', () => {
    const errores = validarDonante({});
    expect(errores.nombre).toBeDefined();
    expect(errores.contacto).toBeDefined();
  });

  it('pasa si tiene nombre y teléfono', () => {
    const errores = validarDonante({ nombre: 'Fundación Esperanza', telefono: '12345678' });
    expect(Object.keys(errores).length).toBe(0);
  });
});

describe('Validaciones de Donaciones (#189)', () => {
  it('rechaza fechas futuras', () => {
    const fechaFutura = new Date();
    fechaFutura.setDate(fechaFutura.getDate() + 5);

    const errores = validarDonacion({
      donanteId: 'uuid-1',
      tipo: 'DINERO',
      fecha: fechaFutura.toISOString(),
      monto: 100,
      moneda: 'GTQ',
    });

    expect(errores.fecha).toBe('La fecha de la donación no puede ser futura.');
  });

  it('exige monto y moneda si la donación es en dinero', () => {
    const errores = validarDonacion({
      donanteId: 'uuid-1',
      tipo: 'DINERO',
      fecha: new Date().toISOString(),
    });

    expect(errores.monto).toBeDefined();
    expect(errores.moneda).toBeDefined();
  });

  it('exige detalles completos si es donación de medicamentos', () => {
    const errores = validarDonacion({
      donanteId: 'uuid-1',
      tipo: 'MEDICAMENTOS',
      fecha: new Date().toISOString(),
      detallesMedicamentos: [],
    });

    expect(errores.detallesMedicamentos).toBeDefined();
  });
});