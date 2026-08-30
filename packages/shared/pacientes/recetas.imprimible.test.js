import { describe, expect, it } from "vitest";

import { datosDeRecetaImprimible, ENCABEZADO_DE_RECETA } from "./recetas.imprimible.js";

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
