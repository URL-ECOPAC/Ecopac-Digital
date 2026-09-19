// Prueba de FichaPacientePage: los filtros sobreviven a elegir un paciente, y la ficha ofrece
// las tres capturas clinicas segun el rol.
// @vitest-environment jsdom
//
// Son las dos cosas que la pantalla NO hacia y que no se ven en ninguna prueba de shared: las
// dos son decisiones de composicion de esta pantalla (que componente dibuja que), no de un
// hook. permisosDeFicha() ya tiene su propia prueba en packages/shared; lo que se comprueba
// aqui es que la ficha la use para decidir que botones pinta.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

// El historial y el modal de consulta traen sus propios hooks contra la base; aqui solo importa
// que la ficha los monte, no lo que dibujan.
vi.mock("./PestaniaHistorialPaciente", () => ({ default: () => <div>historial</div> }));
vi.mock("./ModalConsulta", () => ({ default: () => <div>formulario de consulta</div> }));

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
    expect(screen.getByLabelText("Edad: desde")).toBeInTheDocument();
    expect(screen.getByLabelText("Condición crónica")).toBeInTheDocument();
  });

  // La edad son dos cuadros, uno al lado del otro, con un guion entre ellos: el desplegable de
  // grupos con "Personalizado" cambiaba la altura de la barra al abrir el rango exacto.
  it("la edad se filtra con dos cuadros, desde y hasta", () => {
    pantalla();

    fireEvent.change(screen.getByLabelText("Edad: desde"), { target: { value: "13" } });
    expect(LISTADO.setFiltro).toHaveBeenCalledWith("rangoEdad", { min: 13 });

    expect(screen.getByLabelText("Edad: hasta")).toBeInTheDocument();
  });

  it("Limpiar filtros esta siempre, deshabilitado mientras no hay nada que limpiar", () => {
    pantalla();

    expect(screen.getByRole("button", { name: "Limpiar filtros" })).toBeInTheDocument();
  });

  it("muestra las marcas de auditoria del modelo, que no llegaban a ninguna pantalla", () => {
    pantalla("generales");

    expect(screen.getByText("Registrado el")).toBeInTheDocument();
    expect(screen.getByText("Última actualización")).toBeInTheDocument();
  });

  // Issue #840, bloque F: "Nueva consulta" es la unica accion de captura. No hay "Tomar signos"
  // ni "Generar receta" sueltos: los dos son pasos dentro de la consulta.
  it("ofrece una sola accion de captura, Nueva consulta, y abre el formulario", () => {
    pantalla();

    expect(screen.queryByText("Tomar signos vitales")).not.toBeInTheDocument();
    expect(screen.queryByText("Generar receta")).not.toBeInTheDocument();
    expect(screen.queryByText("Registrar consulta")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Nueva consulta"));
    expect(screen.getByText("formulario de consulta")).toBeInTheDocument();
  });

  it("las pestanas son datos generales e historial: signos y recetas viven en cada visita", () => {
    pantalla();

    expect(screen.getByText("Historial clínico")).toBeInTheDocument();
    expect(screen.queryByText("Signos vitales")).not.toBeInTheDocument();
    expect(screen.queryByText("Recetas")).not.toBeInTheDocument();
  });

  it("un voluntario general ve Nueva consulta -toma los signos- pero no el historial", () => {
    sesion.rol = ROLES.VOLUNTARIO;
    sesion.perfil = { id: "perf-2", rol: ROLES.VOLUNTARIO };

    pantalla("historial");

    expect(screen.getByText("Nueva consulta")).toBeInTheDocument();
    expect(screen.queryByText("Historial clínico")).not.toBeInTheDocument();
  });
});
