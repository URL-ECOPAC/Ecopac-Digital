// Todo selector del formulario de edicion tiene su catalogo (issue #699).
//
// POR QUE ESTA PRUEBA, Y POR QUE ES ESTATICA
//
// El formulario de edicion ofrece los once campos desde la #818, pero el selector de idioma se
// dibujaba SIN UNA SOLA OPCION: useEdicionPaciente() cargaba comunidades y sexo, y nadie habia
// notado que faltaba idiomas. El efecto en pantalla es de los que no rompen nada -- el campo se ve,
// el valor guardado simplemente no aparece seleccionado y no hay forma de cambiarlo -- y por eso
// habia sobrevivido a dos issues sobre este mismo formulario. Se encontro abriendo la ficha a mano.
//
// La comprobacion es estatica -sobre el descriptor y sobre el texto del hook- porque
// packages/shared corre vitest con environment "node": aqui no se puede montar un hook. Lo que se
// fija es el contrato que se rompio: cada `opcionesDesde` del formulario tiene que existir como
// clave de `catalogos`.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { CAMPOS_EDICION_PACIENTE } from "./useEdicionPaciente.js";

const FUENTE_DEL_HOOK = readFileSync(
  fileURLToPath(new URL("./useEdicionPaciente.js", import.meta.url)),
  "utf8",
);

/** Las claves del objeto `catalogos` que devuelve el hook, leidas de su propio codigo. */
function clavesDeCatalogos() {
  const linea = FUENTE_DEL_HOOK.match(/catalogos:\s*\{([^}]*)\}/);
  if (!linea) return [];
  return linea[1]
    .split(",")
    .map((parte) => parte.split(":")[0].trim())
    .filter(Boolean);
}

describe("catalogos del formulario de edicion de paciente", () => {
  it("cada campo que pide opciones tiene su catalogo en el hook", () => {
    const pedidos = CAMPOS_EDICION_PACIENTE.filter((campo) => campo.opcionesDesde).map(
      (campo) => campo.opcionesDesde,
    );
    const disponibles = clavesDeCatalogos();

    expect(pedidos.length).toBeGreaterThan(0);
    for (const pedido of pedidos) {
      expect(disponibles, `falta el catalogo "${pedido}"`).toContain(pedido);
    }
  });

  it("idiomas es uno de ellos: es el que faltaba", () => {
    expect(clavesDeCatalogos()).toContain("idiomas");
  });
});
