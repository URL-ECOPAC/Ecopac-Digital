// Pruebas del catalogo de condiciones cronicas: permisos, descriptores y la decision de que
// hacer con un nombre escrito a mano (issue #850, migracion 00140).
//
// Lo que NO esta aqui: que la base conceda de verdad esos privilegios. Un doble del cliente no
// conoce ningun GRANT ni ninguna politica, asi que eso vive en
// supabase/tests/database/escritura_catalogo_condiciones.sql y en el recorrido e2e. Es la leccion
// de la #662, anotada en docs/PLAN-DE-PRUEBAS.md.

import { describe, expect, it } from "vitest";

import { ROLES, TODOS_LOS_ROLES } from "../usuarios/roles.js";
import {
  COLUMNAS_CATALOGO_CONDICIONES,
  ESTADOS_CONDICION_CATALOGO,
} from "./condiciones.columnas.js";
import {
  FILTROS_CATALOGO_CONDICIONES,
  FILTROS_CATALOGO_CONDICIONES_VACIOS,
} from "./condiciones.filtros.js";
import {
  puedeCrearCondicionDelCatalogo,
  puedeMantenerCatalogoCondiciones,
  puedeVerCatalogoDeCondiciones,
} from "./condiciones.permisos.js";
import { resolverCondicionEscrita } from "./useAltaDeCondicionEnLinea.js";
import { hayFiltrosDeCatalogoCondiciones } from "./useCatalogoCondiciones.js";

describe("quien escribe el catalogo de condiciones (espejo de la 00140)", () => {
  it("los tres roles que atienden dan de alta", () => {
    for (const rol of [ROLES.ADMINISTRADOR, ROLES.MEDICO, ROLES.VOLUNTARIO]) {
      expect(puedeCrearCondicionDelCatalogo(rol)).toBe(true);
    }
  });

  it("los dos roles consultivos no, porque no tocan filas clinicas (regla de la 00054)", () => {
    for (const rol of [ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR]) {
      expect(puedeCrearCondicionDelCatalogo(rol)).toBe(false);
    }
  });

  it("dar de alta y mantener no son el mismo permiso: solo el administrador renombra y retira", () => {
    expect(puedeMantenerCatalogoCondiciones(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeMantenerCatalogoCondiciones(ROLES.MEDICO)).toBe(false);
    expect(puedeMantenerCatalogoCondiciones(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("un rol desconocido no escribe de ninguna de las dos formas", () => {
    expect(puedeCrearCondicionDelCatalogo(undefined)).toBe(false);
    expect(puedeMantenerCatalogoCondiciones("pediatra")).toBe(false);
  });

  it("leer el catalogo lo puede cualquier rol conocido, y nadie mas", () => {
    for (const rol of TODOS_LOS_ROLES) expect(puedeVerCatalogoDeCondiciones(rol)).toBe(true);
    expect(puedeVerCatalogoDeCondiciones(undefined)).toBe(false);
  });

  it("quien mantiene el catalogo es siempre un subconjunto de quien lo da de alta", () => {
    // Si esto deja de cumplirse, hay un rol al que la interfaz le ofrece "Retirar" sin ofrecerle
    // "Nueva condicion", que no es un estado que ninguna de las dos politicas de la 00140 produzca.
    for (const rol of TODOS_LOS_ROLES) {
      if (puedeMantenerCatalogoCondiciones(rol)) {
        expect(puedeCrearCondicionDelCatalogo(rol)).toBe(true);
      }
    }
  });
});

describe("resolverCondicionEscrita (anti duplicados del alta en linea)", () => {
  const opciones = [
    { value: "id-hipertension", label: "Hipertensión" },
    { value: "id-diabetes", label: "Diabetes" },
  ];

  it("un nombre vacio se rechaza antes de tocar el servidor", () => {
    const resuelto = resolverCondicionEscrita(opciones, "   ");
    expect(resuelto.accion).toBe("rechazar");
    expect(resuelto.errores).toHaveProperty("nombre");
  });

  it("escribir una que ya existe la elige, no la duplica", () => {
    const resuelto = resolverCondicionEscrita(opciones, "Hipertensión");
    expect(resuelto.accion).toBe("elegir");
    expect(resuelto.existente.value).toBe("id-hipertension");
  });

  it("ignora mayusculas, acentos y espacios alrededor, igual que el indice de la 00140", () => {
    for (const escrito of ["hipertension", "  HIPERTENSION  ", "Hipertension"]) {
      const resuelto = resolverCondicionEscrita(opciones, escrito);
      expect(resuelto.accion).toBe("elegir");
      expect(resuelto.existente.value).toBe("id-hipertension");
    }
  });

  it("un nombre que no esta en el catalogo si se crea", () => {
    expect(resolverCondicionEscrita(opciones, "Artritis reumatoide").accion).toBe("crear");
  });

  it("sin catalogo cargado todavia, crear es lo unico que puede decidir", () => {
    expect(resolverCondicionEscrita([], "Hipertensión").accion).toBe("crear");
  });
});

describe("descriptores de la pantalla de catalogo", () => {
  it("cada filtro tiene contraparte en el estado vacio", () => {
    for (const filtro of FILTROS_CATALOGO_CONDICIONES) {
      expect(FILTROS_CATALOGO_CONDICIONES_VACIOS).toHaveProperty(filtro.id);
    }
  });

  it("hayFiltrosDeCatalogoCondiciones distingue el estado vacio del que tiene busqueda", () => {
    expect(hayFiltrosDeCatalogoCondiciones(FILTROS_CATALOGO_CONDICIONES_VACIOS)).toBe(false);
    expect(hayFiltrosDeCatalogoCondiciones({})).toBe(false);
    expect(hayFiltrosDeCatalogoCondiciones({ busqueda: "   " })).toBe(false);
    expect(hayFiltrosDeCatalogoCondiciones({ busqueda: "diabetes" })).toBe(true);
  });

  it("la columna de estado sale de es_vigente y se traduce por catalogo", () => {
    // Sin `desde` leeria una columna `estado` que la tabla no tiene, y sin `etiquetasDesde`
    // DataList pintaria el booleano crudo.
    const estado = COLUMNAS_CATALOGO_CONDICIONES.find((columna) => columna.id === "estado");
    expect(estado.desde).toBe("esVigente");
    expect(estado.etiquetasDesde).toBe("estadoCondicionCatalogo");
  });

  it("el catalogo de estado trae value booleano y clave de statusColors", () => {
    expect(ESTADOS_CONDICION_CATALOGO.map((opcion) => opcion.value)).toEqual([true, false]);
    for (const opcion of ESTADOS_CONDICION_CATALOGO) {
      expect(typeof opcion.clave).toBe("string");
      expect(typeof opcion.label).toBe("string");
    }
  });
});
