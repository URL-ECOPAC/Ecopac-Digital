// Pruebas de los descriptores de categoria y de los filtros del buzon (issue #755).

import { describe, expect, it } from "vitest";
import { colors } from "@ecopac/ui-tokens";

import { CATEGORIAS_NOTIFICACION } from "../enums.js";
import {
  agruparPorCategoria,
  DESCRIPTORES_CATEGORIA_NOTIFICACION,
  descriptorDeCategoria,
} from "./categorias.js";
import { avisarCambioDelBuzon, suscribirCambiosDelBuzon } from "./eventos.js";
import {
  FILTROS_NOTIFICACIONES,
  FILTROS_NOTIFICACIONES_VACIOS,
  filtrarNotificaciones,
  hayFiltrosDeNotificaciones,
} from "./filtros.js";

describe("DESCRIPTORES_CATEGORIA_NOTIFICACION", () => {
  it("cubre cada valor de categoria_notificacion, ni uno mas", () => {
    expect(DESCRIPTORES_CATEGORIA_NOTIFICACION.map((d) => d.categoria).sort()).toEqual(
      Object.values(CATEGORIAS_NOTIFICACION).sort(),
    );
  });

  // Un tono que no existe en ui-tokens no avisa: en la web var(--color-x) no pinta nada y en el
  // movil colors[x] es undefined (docs/DISENO.md, issue #819).
  it.each(DESCRIPTORES_CATEGORIA_NOTIFICACION.map((d) => [d.categoria, d.tono]))(
    "el tono de %s (%s) es un color de @ecopac/ui-tokens",
    (_, tono) => {
      expect(colors[tono]).toEqual(expect.any(String));
    },
  );

  it("validacion y presupuestos no tienen pantalla movil: su destino movil es null", () => {
    expect(descriptorDeCategoria("validacion").destinoMovil).toBeNull();
    expect(descriptorDeCategoria("presupuestos").destinoMovil).toBeNull();
  });
});

describe("descriptorDeCategoria", () => {
  it("una categoria que no existe revienta en vez de devolver un descriptor vacio", () => {
    expect(() => descriptorDeCategoria("otra")).toThrow(/desconocida/);
  });
});

describe("agruparPorCategoria", () => {
  const notificaciones = [
    { id: "1", categoria: "validacion", leida: false },
    { id: "2", categoria: "caducidad", leida: true },
    { id: "3", categoria: "validacion", leida: true },
    { id: "4", categoria: "caducidad", leida: false },
  ];

  it("ordena los grupos por categoria y conserva el orden de llegada dentro de cada uno", () => {
    const grupos = agruparPorCategoria(notificaciones);

    expect(grupos.map((g) => g.categoria)).toEqual(["caducidad", "validacion"]);
    expect(grupos[0].notificaciones.map((n) => n.id)).toEqual(["2", "4"]);
    expect(grupos[1].notificaciones.map((n) => n.id)).toEqual(["1", "3"]);
  });

  it("cuenta las no leidas de cada grupo y omite los grupos vacios", () => {
    const grupos = agruparPorCategoria(notificaciones);

    expect(grupos.map((g) => [g.categoria, g.noLeidas])).toEqual([
      ["caducidad", 1],
      ["validacion", 1],
    ]);
    expect(agruparPorCategoria([])).toEqual([]);
  });
});

describe("eventos del buzon", () => {
  it("avisa a cada suscriptor y deja de avisar al que cancela", () => {
    const avisos = [];
    const cancelar = suscribirCambiosDelBuzon(() => avisos.push("a"));
    suscribirCambiosDelBuzon(() => avisos.push("b"))();

    avisarCambioDelBuzon();
    cancelar();
    avisarCambioDelBuzon();

    expect(avisos).toEqual(["a"]);
  });
});

describe("filtrarNotificaciones", () => {
  const lista = [
    {
      id: "1",
      categoria: "caducidad",
      leida: false,
      titulo: "Lote vencido: Acetaminofen",
      cuerpo: "L-1",
    },
    { id: "2", categoria: "stock", leida: true, titulo: "Sin stock: Ibuprofeno", cuerpo: "" },
    {
      id: "3",
      categoria: "caducidad",
      leida: true,
      titulo: "Lote por vencer: Loratadina",
      cuerpo: "L-3",
    },
  ];

  it("sin filtros devuelve todo, en el mismo orden", () => {
    expect(filtrarNotificaciones(lista, FILTROS_NOTIFICACIONES_VACIOS).map((n) => n.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(hayFiltrosDeNotificaciones(FILTROS_NOTIFICACIONES_VACIOS)).toBe(false);
  });

  it("filtra por una sola categoria", () => {
    const filtros = { ...FILTROS_NOTIFICACIONES_VACIOS, categoria: "caducidad" };
    expect(filtrarNotificaciones(lista, filtros).map((n) => n.id)).toEqual(["1", "3"]);
    expect(hayFiltrosDeNotificaciones(filtros)).toBe(true);
  });

  it("filtra por estado de lectura y por texto, combinados", () => {
    expect(
      filtrarNotificaciones(lista, { busqueda: "", categoria: null, estado: "sin-leer" }).map(
        (n) => n.id,
      ),
    ).toEqual(["1"]);
    expect(
      filtrarNotificaciones(lista, {
        busqueda: "lorat",
        categoria: "caducidad",
        estado: "leidas",
      }).map((n) => n.id),
    ).toEqual(["3"]);
  });

  it("la categoria del filtro ofrece las cuatro del enum", () => {
    const categoria = FILTROS_NOTIFICACIONES.find((f) => f.id === "categoria");
    expect(categoria.opciones.map((o) => o.value)).toEqual([
      "caducidad",
      "stock",
      "validacion",
      "presupuestos",
    ]);
  });
});
