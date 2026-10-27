import { describe, expect, it } from "vitest";

import {
  datosDeRecetaImprimible,
  datosDeRecetaMedica,
  describirCantidadRecetada,
  describirUso,
  DOCUMENTO_RECETA_MEDICA,
  ENCABEZADO_DE_RECETA,
  formatearPeso,
  formatearTalla,
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

describe("datosDeRecetaMedica", () => {
  const CON_TRIAJE = { ...RECETA, peso: 62.5, talla: 158 };

  it("no lleva comunidad ni ficha, y si peso y talla con sus unidades", () => {
    const datos = datosDeRecetaMedica({ receta: CON_TRIAJE, paciente: PACIENTE });

    expect(datos.documento).toBe(DOCUMENTO_RECETA_MEDICA);
    expect(datos.paciente).not.toHaveProperty("comunidad");
    expect(datos.paciente).not.toHaveProperty("numeroFicha");
    expect(datos.paciente.peso).toBe("62.5 kg (137.8 lb)");
    expect(datos.paciente.talla).toBe("158 cm");
  });

  it("un medicamento sale en tres lineas: titulo, cantidad y uso", () => {
    const datos = datosDeRecetaMedica({ receta: CON_TRIAJE, paciente: PACIENTE });

    expect(datos.medicamentos).toEqual([
      {
        id: "d-1",
        numero: 1,
        titulo: "Amoxicilina 500 mg",
        cantidad: "# 21 capsulas",
        uso: "tomar 1 capsula cada 8 horas por 7 días.",
      },
    ]);
  });

  it("varios medicamentos se numeran y completan la frase de lo que se escribio corto", () => {
    const datos = datosDeRecetaMedica({
      receta: {
        ...RECETA,
        detalle: [
          {
            id: "d-1",
            medicamento: "Ibuprofeno",
            concentracion: "400 mg",
            presentacion: "Tableta",
            dosis: "1",
            frecuencia: "8 horas",
            duracion: "3 dias",
            cantidadEntregada: 10,
          },
          {
            id: "d-2",
            medicamento: "Acetaminofén",
            concentracion: "120 mg/5 ml",
            presentacion: "Jarabe",
            dosis: "5 ml",
            frecuencia: "Cada 6 horas",
            duracion: "por 5 dias",
            cantidadEntregada: 1,
          },
          {
            id: "d-3",
            medicamento: "Clotrimazol",
            concentracion: "1%",
            presentacion: "Pomada",
            dosis: "una capa delgada",
            frecuencia: "c/12 horas",
            duracion: "una semana",
            // La corregida manda, como en el formato de siempre (00128).
            cantidadEntregada: 1,
            cantidadAjustada: 2,
          },
        ],
      },
      paciente: PACIENTE,
    });

    expect(datos.medicamentos.map((m) => [m.numero, m.titulo, m.cantidad, m.uso])).toEqual([
      [1, "Ibuprofeno 400 mg", "# 10 tabletas", "tomar 1 tableta cada 8 horas por 3 días."],
      [
        2,
        "Acetaminofén 120 mg/5 ml",
        "# 1 frasco de jarabe",
        "tomar 5 ml cada 6 horas por 5 días.",
      ],
      [
        3,
        "Clotrimazol 1%",
        "# 2 tubos de pomada",
        "aplicar una capa delgada cada 12 horas por una semana.",
      ],
    ]);
  });

  it("con datos incompletos omite lo que falta sin dejar la frase rota", () => {
    const datos = datosDeRecetaMedica({
      receta: {
        ...RECETA,
        indicacionesGenerales: "  ",
        detalle: [
          {
            id: "d-1",
            medicamento: "Loratadina",
            presentacion: "Tableta",
            frecuencia: "cada 24 horas",
          },
          { id: "d-2", medicamento: "Suero oral" },
        ],
      },
      paciente: { nombres: "Ana" },
    });

    expect(datos.paciente.peso).toBeNull();
    expect(datos.paciente.talla).toBeNull();
    expect(datos.paciente.edad).toBeNull();
    expect(datos.indicacionesGenerales).toBeNull();
    // Sin cantidad, la presentacion se queda en el titulo.
    expect(datos.medicamentos[0]).toMatchObject({
      titulo: "Loratadina Tableta",
      cantidad: null,
      uso: "tomar cada 24 horas.",
    });
    expect(datos.medicamentos[1]).toMatchObject({
      titulo: "Suero oral",
      cantidad: null,
      uso: null,
    });
  });

  it("devuelve null sin receta", () => {
    expect(datosDeRecetaMedica()).toBeNull();
  });
});

describe("describirCantidadRecetada", () => {
  it("pluraliza segun la cantidad", () => {
    expect(describirCantidadRecetada(1, "Tableta")).toBe("# 1 tableta");
    expect(describirCantidadRecetada(3, "Unidad")).toBe("# 3 unidades");
    expect(describirCantidadRecetada(2, "Gotas oftálmicas")).toBe(
      "# 2 frascos de gotas oftálmicas",
    );
    expect(describirCantidadRecetada(4, null)).toBe("# 4");
    expect(describirCantidadRecetada(null, "Tableta")).toBeNull();
  });
});

describe("describirUso", () => {
  it("cuenta en piezas una dosis numerica solo donde la pieza es clara", () => {
    expect(describirUso({ dosis: "2", presentacion: "Cápsula" })).toBe("tomar 2 cápsulas.");
    expect(describirUso({ dosis: "5", presentacion: "Jarabe" })).toBe("tomar 5.");
  });
});

describe("formatearPeso y formatearTalla", () => {
  it("ignoran lo que no es numero", () => {
    expect(formatearPeso("62.50")).toBe("62.5 kg (137.8 lb)");
    expect(formatearPeso("")).toBeNull();
    expect(formatearTalla("abc")).toBeNull();
  });
});
