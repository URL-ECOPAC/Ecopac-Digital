import { describe, expect, it } from "vitest";

import {
  datosDeRecetaImprimible,
  ENCABEZADO_DE_RECETA,
  escaparHtml,
  htmlDeRecetaImprimible,
} from "./recetas.imprimible.js";

const RECETA = {
  id: "r-1",
  folio: "REC-000012",
  estado: "emitida",
  anulada: false,
  medico: "Luis Perez",
  jornada: "Jornada Chuicutama",
  fechaDeJornada: "2026-05-10",
  createdAt: "2026-05-10T16:00:00Z",
  indicacionesGenerales: "Tomar con alimentos",
  motivoAnulacion: null,
  detalle: [
    {
      id: "d-1",
      medicamento: "Amoxicilina",
      concentracion: "500 mg",
      presentacion: "capsula",
      dosis: "1 capsula",
      frecuencia: "cada 8 horas",
      duracion: "7 dias",
      cantidadEntregada: 21,
    },
  ],
};

const PACIENTE = {
  nombres: "Maria",
  apellidos: "Chun Tzoc",
  fechaNacimiento: "1990-03-15",
  sexo: "Femenino",
  comunidad: { nombre: "Chuicutama" },
  expediente: { numeroFicha: "EXP-000042" },
};

describe("datosDeRecetaImprimible", () => {
  it("trae los cinco datos que exige el criterio 1", () => {
    const datos = datosDeRecetaImprimible({ receta: RECETA, paciente: PACIENTE });

    expect(datos.paciente.nombre).toBe("Maria Chun Tzoc");
    expect(datos.medico).toBe("Luis Perez");
    expect(datos.jornada).toBe("Jornada Chuicutama");
    expect(datos.folio).toBe("REC-000012");
    expect(datos.fecha).toBe("2026-05-10T16:00:00Z");
  });

  it("identifica el documento y la organizacion", () => {
    const datos = datosDeRecetaImprimible({ receta: RECETA, paciente: PACIENTE });

    expect(datos.organizacion).toBe(ENCABEZADO_DE_RECETA.organizacion);
    expect(datos.documento).toBe(ENCABEZADO_DE_RECETA.documento);
  });

  it("agrega ficha, edad, sexo y comunidad del paciente", () => {
    const datos = datosDeRecetaImprimible({ receta: RECETA, paciente: PACIENTE });

    expect(datos.paciente.numeroFicha).toBe("EXP-000042");
    expect(datos.paciente.edad).toBeTruthy();
    expect(datos.paciente.sexo).toBe("Femenino");
    expect(datos.paciente.comunidad).toBe("Chuicutama");
  });

  it("arma cada medicamento con su descripcion y posologia", () => {
    const [medicamento] = datosDeRecetaImprimible({
      receta: RECETA,
      paciente: PACIENTE,
    }).medicamentos;

    expect(medicamento.descripcion).toBe("Amoxicilina 500 mg capsula");
    expect(medicamento.posologia).toBe("1 capsula, cada 8 horas, 7 dias");
    expect(medicamento.cantidadEntregada).toBe(21);
  });

  it("conserva la anulacion, para que el papel no contradiga al sistema", () => {
    const datos = datosDeRecetaImprimible({
      receta: { ...RECETA, anulada: true, estado: "anulada", motivoAnulacion: "Error de dosis" },
      paciente: PACIENTE,
    });

    expect(datos.anulada).toBe(true);
    expect(datos.motivoAnulacion).toBe("Error de dosis");
  });

  it("no inventa datos si el paciente llega incompleto", () => {
    const datos = datosDeRecetaImprimible({ receta: RECETA, paciente: {} });

    expect(datos.paciente.nombre).toBeNull();
    expect(datos.paciente.numeroFicha).toBeNull();
    expect(datos.paciente.edad).toBeNull();
  });

  it("una receta sin medicamentos da una lista vacia", () => {
    expect(
      datosDeRecetaImprimible({ receta: { ...RECETA, detalle: [] }, paciente: PACIENTE })
        .medicamentos,
    ).toEqual([]);
  });

  it("es null sin receta", () => {
    expect(datosDeRecetaImprimible({ paciente: PACIENTE })).toBeNull();
    expect(datosDeRecetaImprimible()).toBeNull();
  });
});

describe("htmlDeRecetaImprimible (issue #866)", () => {
  it("sin receta no devuelve documento", () => {
    expect(htmlDeRecetaImprimible({ receta: null, paciente: PACIENTE })).toBeNull();
  });

  it("lleva los mismos datos que la version de la web", () => {
    const html = htmlDeRecetaImprimible({ receta: RECETA, paciente: PACIENTE });

    expect(html).toContain(ENCABEZADO_DE_RECETA.organizacion);
    expect(html).toContain(ENCABEZADO_DE_RECETA.documento);
    expect(html).toContain("REC-000012");
    expect(html).toContain("Maria Chun Tzoc");
    expect(html).toContain("EXP-000042");
    expect(html).toContain("Chuicutama");
    expect(html).toContain("Luis Perez");
    expect(html).toContain("Amoxicilina");
    expect(html).toContain("Tomar con alimentos");
  });

  it("imprime la cantidad entregada vigente, no la original", () => {
    const html = htmlDeRecetaImprimible({
      receta: {
        ...RECETA,
        detalle: [{ ...RECETA.detalle[0], cantidadEntregada: 21, cantidadAjustada: 14 }],
      },
      paciente: PACIENTE,
    });

    expect(html).toContain("Cantidad entregada: 14");
    expect(html).not.toContain("Cantidad entregada: 21");
  });

  it("marca la receta anulada con su motivo", () => {
    const html = htmlDeRecetaImprimible({
      receta: { ...RECETA, anulada: true, motivoAnulacion: "Error de transcripcion" },
      paciente: PACIENTE,
    });

    expect(html).toContain("RECETA ANULADA");
    expect(html).toContain("Error de transcripcion");
  });

  it("una receta sin folio lo dice, no deja el hueco", () => {
    const html = htmlDeRecetaImprimible({ receta: { ...RECETA, folio: null }, paciente: PACIENTE });

    expect(html).toContain("sin folio");
  });

  it("escapa el contenido: un nombre con < no puede cerrar una etiqueta", () => {
    const html = htmlDeRecetaImprimible({
      receta: RECETA,
      paciente: { ...PACIENTE, nombres: "<script>alert(1)</script>" },
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escaparHtml deja pasar el texto normal y convierte los cinco caracteres", () => {
    expect(escaparHtml("Paracetamol 500 mg")).toBe("Paracetamol 500 mg");
    expect(escaparHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
    expect(escaparHtml(null)).toBe("");
  });
});
