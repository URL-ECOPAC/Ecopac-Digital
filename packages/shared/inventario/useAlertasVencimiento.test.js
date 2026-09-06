// Prueba de la logica pura del hook de alertas de vencimiento.
//
// No se monta el hook: packages/shared corre vitest con environment "node", sin DOM (ver
// vitest.config.js). Por eso las dos piezas que se prueban aqui se exportan aparte del hook.
//
// calcularDiasRestantes() (issue #694): antes calculaba con new Date(fechaVencimiento) -
// new Date() en milisegundos, es decir interpretaba una cadena AAAA-MM-DD como medianoche UTC
// (un dia adelantado en Guatemala, UTC-6) y comparaba contra el instante actual en vez del dia
// de calendario. Un lote que vence exactamente hoy salia con dias negativos, es decir VENCIDO.
//
// datosAtenderAlerta() (issue #709): marcarComoAtendida() llamaba a atenderAlerta() con
// { accionTomada } -una clave que atenderAlerta() (alertas.api.js) no lee, cuya firma real es
// { accion, usuarioId, rolUsuario }-, y ademas descartaba el { error } de la respuesta, marcando
// la alerta como atendida en el estado local aunque el llamado real hubiera fallado por falta de
// usuarioId. Esta prueba cubre la traduccion que marcarComoAtendida() ahora usa para llamar a
// atenderAlerta(), con exactamente los argumentos que esa funcion declara.

import { describe, expect, it } from "vitest";

import { calcularDiasRestantes, datosAtenderAlerta } from "./useAlertasVencimiento.js";

/** "AAAA-MM-DD" del dia de calendario LOCAL de hoy (no UTC: toISOString() se corre de dia). */
function hoyComoTexto() {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

describe("calcularDiasRestantes", () => {
  it("un lote que vence exactamente hoy da 0 dias, no negativo", () => {
    expect(calcularDiasRestantes(hoyComoTexto())).toBe(0);
  });

  it("un lote sin fecha de vencimiento no calcula nada", () => {
    expect(calcularDiasRestantes(null)).toBeNull();
    expect(calcularDiasRestantes("")).toBeNull();
  });

  it("invalida un lote cuya fecha de vencimiento es anterior a su fecha de ingreso", () => {
    expect(calcularDiasRestantes("2026-01-01", "2026-06-01")).toBeNull();
  });

  it("acepta un lote cuya fecha de vencimiento coincide con la de ingreso", () => {
    expect(calcularDiasRestantes("2026-06-01", "2026-06-01")).not.toBeNull();
  });
});

describe("datosAtenderAlerta", () => {
  it("arma los argumentos de atenderAlerta con accion, usuarioId y rolUsuario de la sesion actual", () => {
    const resultado = datosAtenderAlerta("Despachado a bodega central", {
      usuarioId: "user-1",
      rolUsuario: "administrador",
    });

    expect(resultado).toEqual({
      accion: "Despachado a bodega central",
      usuarioId: "user-1",
      rolUsuario: "administrador",
    });
  });

  it("no inventa un usuarioId ni un rolUsuario si la sesion no los trae", () => {
    const resultado = datosAtenderAlerta("Descartado", {});

    expect(resultado.usuarioId).toBeUndefined();
    expect(resultado.rolUsuario).toBeUndefined();
  });
});
