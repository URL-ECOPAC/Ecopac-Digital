// Prueba de FichaPacientePage: los filtros sobreviven a elegir un paciente, y la ficha ofrece
// las tres capturas clinicas segun el rol.
// @vitest-environment jsdom
//
// Son las dos cosas que la pantalla NO hacia y que no se ven en ninguna prueba de shared: las
// dos son decisiones de composicion de esta pantalla (que componente dibuja que), no de un
// hook. permisosDeFicha() ya tiene su propia prueba en packages/shared; lo que se comprueba
// aqui es que la ficha la use para decidir que botones pinta.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { ROLES } from "@ecopac/shared";

import FichaPacientePage from "./FichaPacientePage";

const PACIENTE = {
  id: "pac-1",
  nombres: "Rosa",
  apellidos: "Cotzojay",
  fechaNacimiento: "2018-04-02",
  sexo: "femenino",
  dpi: null,
  telefonoContacto: "5555-0000",
  expediente: { id: "exp-1", numeroFicha: "EXP-000042" },
  comunidad: { nombre: "Aldea Vista Hermosa" },
  condicionesCronicas: [],
  createdAt: "2026-01-10T15:30:00Z",
  updatedAt: "2026-02-11T09:00:00Z",
};

const LISTADO = {
  filas: [{ id: "pac-1", nombreCompleto: "Rosa Cotzojay", edad: 8, sexo: "femenino" }],
  filtros: {},
  setFiltro: vi.fn(),
  limpiarFiltros: vi.fn(),
  hayFiltros: false,
  cargando: false,
  error: null,
  total: 1,
  hayMas: false,
  cargarMas: vi.fn(),
  catalogos: { comunidades: [], sexo: [], condicionesCronicas: [] },
  recargar: vi.fn(),
};

const sesion = { rol: ROLES.MEDICO, perfil: { id: "perf-1", rol: ROLES.MEDICO } };

vi.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => sesion,
}));

vi.mock("@ecopac/shared", async (importarOriginal) => {
  const original = await importarOriginal();
  return {
    ...original,
    usePaciente: () => ({ paciente: PACIENTE, cargando: false, error: null, recargar: vi.fn() }),
    usePacientesListado: () => LISTADO,
    useFusionesDelPaciente: () => ({ fusiones: [], permitido: false }),
  };
});

// Las tres pestanias traen sus propios hooks contra la base; aqui solo importa que la ficha las
// monte, no lo que dibujan.
vi.mock("./PestaniaHistorialPaciente", () => ({ default: () => <div>historial</div> }));
vi.mock("./PestaniaSignosPaciente", () => ({ default: () => <div>signos</div> }));
vi.mock("./PestaniaRecetasPaciente", () => ({ default: () => <div>recetas</div> }));

function pantalla(pestania) {
  const ruta = pestania ? `/pacientes/pac-1?pestania=${pestania}` : "/pacientes/pac-1";
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/pacientes/:id" element={<FichaPacientePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sesion.rol = ROLES.MEDICO;
  sesion.perfil = { id: "perf-1", rol: ROLES.MEDICO };
});

afterEach(() => {
  cleanup();
});

describe("FichaPacientePage", () => {
  it("sigue mostrando los filtros del listado con un paciente elegido", () => {
    pantalla();

    // Los cinco filtros de FILTROS_PACIENTE. Antes desaparecian al entrar a la ficha, porque
    // esta pantalla montaba la lista sin la barra de filtros.
    expect(screen.getByLabelText("Buscar paciente")).toBeInTheDocument();
    expect(screen.getByLabelText("Lugar")).toBeInTheDocument();
    expect(screen.getByLabelText("Sexo")).toBeInTheDocument();
    expect(screen.getByText("Rango de edad")).toBeInTheDocument();
    expect(screen.getByLabelText("Condicion cronica")).toBeInTheDocument();
  });

  it("el rango de edad va como un solo control, con sus dos extremos etiquetados", () => {
    pantalla();

    expect(screen.getByLabelText("Rango de edad: desde")).toBeInTheDocument();
    expect(screen.getByLabelText("Rango de edad: hasta")).toBeInTheDocument();
  });

  it("muestra las marcas de auditoria del modelo, que no llegaban a ninguna pantalla", () => {
    pantalla("generales");

    expect(screen.getByText("Registrado el")).toBeInTheDocument();
    expect(screen.getByText("Ultima actualizacion")).toBeInTheDocument();
  });

  it("ofrece registrar una consulta desde el historial clinico", () => {
    pantalla("historial");
    expect(screen.getByText("Registrar consulta")).toBeInTheDocument();
  });

  it("ofrece tomar signos vitales", () => {
    pantalla("signos");
    expect(screen.getByText("Tomar signos vitales")).toBeInTheDocument();
  });

  it("ofrece generar una receta", () => {
    pantalla("recetas");
    expect(screen.getByText("Generar receta")).toBeInTheDocument();
  });

  it("un voluntario general no ve las pestanias clinicas ni sus acciones", () => {
    sesion.rol = ROLES.VOLUNTARIO;
    sesion.perfil = { id: "perf-2", rol: ROLES.VOLUNTARIO };

    // resolverPestaniaDeFicha() cae a "generales" para un rol sin datos clinicos, asi que pedir
    // la pestania de recetas no la abre. Lo que se comprueba es que no aparezca la accion.
    pantalla("recetas");

    expect(screen.queryByText("Generar receta")).not.toBeInTheDocument();
    expect(screen.queryByText("Registrar consulta")).not.toBeInTheDocument();
    expect(screen.queryByText("Historial clinico")).not.toBeInTheDocument();
  });
});
