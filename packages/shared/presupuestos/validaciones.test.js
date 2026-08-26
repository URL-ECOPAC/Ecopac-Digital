// Pruebas de las reglas de negocio de gastos (issue #296).
//
// La version anterior de estas pruebas pasaba en verde con datos que la base rechaza: usaba
// `categoria_id` y `fecha_gasto` (las columnas son `categoria` y `fecha`) y una lista de
// categorias inventada -['insumos', 'transporte', 'alimentacion']- que no esta en el enum
// categoria_gasto de 00025_presupuesto_gastos.sql. Cada caso de aqui usa las columnas y los
// valores reales.

import { describe, expect, it } from 'vitest';

import { CATEGORIAS_DE_GASTO } from './campos.js';
import { validarGasto } from './validaciones.js';

function hoy() {
  return new Date().toISOString().split('T')[0];
}

function enDias(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().split('T')[0];
}

const jornadaConPresupuesto = {
  fecha_inicio: '2026-01-01',
  presupuesto_asignado: 1000.0,
  gasto_acumulado: 200.0,
};

describe('validarGasto', () => {
  it('acepta un gasto valido dentro del presupuesto', () => {
    const resultado = validarGasto(
      {
        concepto: 'Compra de mascarillas',
        categoria: CATEGORIAS_DE_GASTO.MEDICAMENTOS,
        monto: 150.0,
        fecha: hoy(),
      },
      jornadaConPresupuesto,
    );

    expect(resultado.valido).toBe(true);
    expect(resultado.errores).toEqual([]);
    expect(resultado.esExcedente).toBe(false);
  });

  it('rechaza montos menores o iguales a cero', () => {
    const resultado = validarGasto({
      concepto: 'Prueba',
      categoria: CATEGORIAS_DE_GASTO.LOGISTICA,
      monto: 0,
      fecha: hoy(),
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.errores).toContain('El monto del gasto debe ser mayor que cero.');
  });

  it('exige concepto y categoria', () => {
    const resultado = validarGasto({ monto: 10, fecha: hoy() });

    expect(resultado.errores).toContain('El concepto del gasto es obligatorio.');
    expect(resultado.errores).toContain('La categoria de gasto es obligatoria.');
  });

  it('rechaza una categoria que no esta en el enum categoria_gasto', () => {
    const resultado = validarGasto({
      concepto: 'Alquiler de vehiculo',
      // Valor que usaba la version anterior de estas pruebas y que Postgres rechaza.
      categoria: 'transporte',
      monto: 100,
      fecha: hoy(),
    });

    expect(resultado.errores).toContain('La categoria seleccionada no es valida.');
  });

  it('rechaza una fecha posterior a hoy', () => {
    const resultado = validarGasto({
      concepto: 'Compra adelantada',
      categoria: CATEGORIAS_DE_GASTO.LOGISTICA,
      monto: 100,
      fecha: enDias(3),
    });

    expect(resultado.errores).toContain('La fecha de un gasto no puede ser posterior a hoy.');
  });

  it('rechaza una fecha anterior al inicio de la jornada', () => {
    const resultado = validarGasto(
      {
        concepto: 'Gasto previo',
        categoria: CATEGORIAS_DE_GASTO.LOGISTICA,
        monto: 100,
        fecha: '2025-12-15',
      },
      jornadaConPresupuesto,
    );

    expect(resultado.errores).toContain(
      'La fecha del gasto no puede ser anterior al inicio de su jornada.',
    );
  });

  it('marca como excedente sin bloquear si supera el presupuesto de la jornada', () => {
    const resultado = validarGasto(
      {
        concepto: 'Alquiler extra de planta',
        categoria: CATEGORIAS_DE_GASTO.INFRAESTRUCTURA,
        monto: 500.0,
        fecha: hoy(),
      },
      { ...jornadaConPresupuesto, gasto_acumulado: 800.0 },
    );

    // Sigue siendo valido: una jornada en campo no se detiene porque el presupuesto se quede
    // corto, solo tiene que quedar registrado.
    expect(resultado.valido).toBe(true);
    expect(resultado.esExcedente).toBe(true);
    expect(resultado.mensajeExcedente).toContain('Q300.00');
  });

  it('no evalua el excedente cuando la jornada no trae presupuesto asignado', () => {
    const resultado = validarGasto(
      {
        concepto: 'Insumos varios',
        categoria: CATEGORIAS_DE_GASTO.MEDICAMENTOS,
        monto: 5000,
        fecha: hoy(),
      },
      { fecha_inicio: '2026-01-01' },
    );

    expect(resultado.valido).toBe(true);
    expect(resultado.esExcedente).toBe(false);
    expect(resultado.mensajeExcedente).toBeNull();
  });
});
