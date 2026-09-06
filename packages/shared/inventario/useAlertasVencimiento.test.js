// Prueba de la logica pura del hook de alertas de vencimiento.
//
// No se monta el hook: packages/shared corre vitest con environment "node", sin DOM (ver
// vitest.config.js). Antes de la issue #709, marcarComoAtendida() llamaba a atenderAlerta()
// con { accionTomada } -una clave que atenderAlerta() (alertas.api.js) no lee, cuya firma real
// es { accion, usuarioId, rolUsuario }-, y ademas descartaba el { error } de la respuesta,
// marcando la alerta como atendida en el estado local aunque el llamado real hubiera fallado por
// falta de usuarioId. Esta prueba cubre la traduccion que marcarComoAtendida() ahora usa para
// llamar a atenderAlerta(), con exactamente los argumentos que esa funcion declara.

import { describe, expect, it } from "vitest";

import { datosAtenderAlerta } from "./useAlertasVencimiento.js";

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
