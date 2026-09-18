// Pruebas de enrutado de App (issues #197, #198, #199, #200 y #201).
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { labels } from "@ecopac/ui-tokens";
import App from "./App";

// Extiende los matchers DOM en Vitest para habilitar toBeInTheDocument(), toHaveAttribute(), etc.
expect.extend(matchers);

// Garantiza que el DOM de React Testing Library se limpie completamente entre pruebas
afterEach(() => {
  cleanup();
});

const TEXTO_NOT_FOUND = /página no encontrada/i;

const PERFIL = {
  id: "1",
  nombres: "Ana",
  apellidos: "Lopez",
  rol: "administrador",
  area: null,
};

const { estadoSesion } = vi.hoisted(() => ({
  estadoSesion: {
    estadoRestauracion: "listo",
    haySesion: true,
    perfil: null,
    rol: null,
    usuario: null,
    sesion: { access_token: "token-mock" },
    cargando: false,
    cerrarSesion: vi.fn(),
  },
}));

// Mock del contexto local de Sesión exportando useSesionCompartida y useSesion
vi.mock("./contexto/SesionProvider", () => ({
  useSesion: () => ({
    ...estadoSesion,
    usuario: estadoSesion.perfil,
  }),
  useSesionCompartida: () => ({
    ...estadoSesion,
    usuario: estadoSesion.perfil,
  }),
  SesionProvider: ({ children }) => children,
}));

// Mock de @ecopac/shared
vi.mock("@ecopac/shared", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useSesion: () => ({
      ...estadoSesion,
      usuario: estadoSesion.perfil,
    }),
    useResumenDonaciones: () => {
      const totalesMock = {
        dinero: 0,
        especie: 0,
      };
      return {
        donaciones: [],
        donacionesRecientes: [],
        donantesFrecuentes: [],
        cargando: false,
        error: null,
        fechaInicio: "",
        setFechaInicio: vi.fn(),
        fechaFin: "",
        setFechaFin: vi.fn(),
        totalesPorTipo: totalesMock,
        resumen: {
          totalesPorTipo: totalesMock,
        },
        datos: {
          donaciones: [],
          donacionesRecientes: [],
          donantesFrecuentes: [],
          resumen: {
            totalesPorTipo: totalesMock,
          },
          totalesPorTipo: totalesMock,
        },
      };
    },
    obtenerSupabase: () => ({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
    inicializarSupabase: vi.fn(),
  };
});

// Desde la #708 las paginas se descargan por ruta con React.lazy(), asi que el primer render de
// cualquier ruta es el respaldo de <Suspense> y no la pantalla. Esperar aqui, una sola vez, es lo que
// deja intactos los cuerpos de las pruebas: siguen afirmando en seco sobre la pantalla ya montada.
async function renderEnRuta(ruta) {
  window.history.pushState({}, "", ruta);
  const resultado = render(<App />);

  await waitFor(() => expect(screen.queryByText(labels.cargandoPantalla)).not.toBeInTheDocument());

  return resultado;
}

// Función auxiliar para buscar elementos que puedan estar expuestos como "link" o "button"
function obtenerElementoNavegacion(nombreRegex) {
  const enlace = screen.queryByRole("link", { name: nombreRegex });
  if (enlace) return enlace;

  return screen.getByRole("button", { name: nombreRegex });
}

beforeEach(() => {
  estadoSesion.perfil = PERFIL;
  estadoSesion.rol = PERFIL.rol;
  estadoSesion.usuario = PERFIL;
});

// Sin esto, la espera de renderEnRuta() se cumpliria igual aunque el <Suspense> no existiera -un
// texto que nunca aparece tampoco esta al comprobarlo-, y la prueba pasaria afirmando nada. Aqui se
// ve el respaldo puesto: primero esta, despues se va.
describe("el respaldo de <Suspense> se dibuja de verdad (issue #708)", () => {
  it("la pantalla empieza con el respaldo y termina con el contenido", async () => {
    window.history.pushState({}, "", "/");
    render(<App />);

    expect(screen.getByText(labels.cargandoPantalla)).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.queryByText(labels.cargandoPantalla)).not.toBeInTheDocument(),
    );

    const mainArea = screen.getByRole("main");
    expect(within(mainArea).getByRole("heading", { name: /hola, ana/i })).toBeInTheDocument();
  });
});

describe("rutas de donaciones y proyectos", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("/donaciones/registro monta el formulario de registro de donacion", async () => {
    await renderEnRuta("/donaciones/registro");

    expect(screen.queryByText(TEXTO_NOT_FOUND)).not.toBeInTheDocument();

    // El header del layout (MainLayout) tambien pone un <h1> con el nombre del modulo
    // ("Donaciones"), asi que el patron tiene que apuntar al encabezado propio de la
    // pantalla de registro para no matchear los dos.
    expect(
      screen.getByRole("heading", { level: 1, name: /registro de donaci[oó]n/i }),
    ).toBeInTheDocument();
  });

  it("/donaciones/historial monta el historial de donaciones", async () => {
    await renderEnRuta("/donaciones/historial");

    expect(screen.queryByText(TEXTO_NOT_FOUND)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /historial/i })).toBeInTheDocument();
  });

  it("/donaciones/:id/constancia monta la constancia", async () => {
    await renderEnRuta("/donaciones/42/constancia");

    expect(screen.queryByText(TEXTO_NOT_FOUND)).not.toBeInTheDocument();
  });

  // Esta ruta y la de mas abajo son <Navigate replace to="/proyectos" />, asi que hay DOS pasos: el
  // primer render resuelve la redireccion y solo entonces empieza a descargarse la pantalla de
  // destino. La espera de renderEnRuta() se cumple antes de que ese segundo paso arranque -todavia
  // no hay respaldo que esperar-, asi que aqui la espera va en la propia afirmacion.
  it("/proyectos/sociales monta el listado de proyectos sociales", async () => {
    await renderEnRuta("/proyectos/sociales");

    expect(
      (await screen.findAllByRole("heading", { name: /proyectos sociales/i }))[0],
    ).toBeInTheDocument();
    expect(screen.queryByText(TEXTO_NOT_FOUND)).not.toBeInTheDocument();
  });

  it("/proyectos/:id/seguimiento monta el seguimiento del proyecto", async () => {
    await renderEnRuta("/proyectos/7/seguimiento");

    expect(screen.queryByText(TEXTO_NOT_FOUND)).not.toBeInTheDocument();
  });

  it("una ruta inventada del modulo sigue cayendo en NotFound", async () => {
    await renderEnRuta("/donaciones/registro/inventada");

    expect(screen.getByText(TEXTO_NOT_FOUND)).toBeInTheDocument();
  });
});

describe("los hubs de modulo llevan a sus pantallas", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("/donaciones enlaza al registro, al historial y a los donantes", async () => {
    await renderEnRuta("/donaciones");

    expect(obtenerElementoNavegacion(/registrar donaci[oó]n/i)).toHaveAttribute(
      "href",
      "/donaciones/registro",
    );
    expect(obtenerElementoNavegacion(/historial de donaciones/i)).toHaveAttribute(
      "href",
      "/donaciones/historial",
    );
    expect(obtenerElementoNavegacion(/donantes/i)).toHaveAttribute("href", "/donantes");
  });

  it("/proyectos enlaza o monta la vista de proyectos sociales", async () => {
    await renderEnRuta("/proyectos");

    expect(screen.queryByText(TEXTO_NOT_FOUND)).not.toBeInTheDocument();

    const headings = screen.getAllByRole("heading", { level: 1, name: /proyectos/i });
    expect(headings.length).toBeGreaterThan(0);
  });
});

describe("inicio y proyectos ya no son marcadores (#710)", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("/ ya no dice que la pantalla esta pendiente de implementar", async () => {
    await renderEnRuta("/");

    expect(screen.queryByText(/pendiente de implementar/i)).not.toBeInTheDocument();
  });

  it("/ saluda a la persona y ofrece los modulos de su rol", async () => {
    await renderEnRuta("/");

    // Restringido al contenedor 'main' para evitar ambigüedades con el sidebar
    const mainArea = screen.getByRole("main");
    expect(within(mainArea).getByRole("heading", { name: /hola, ana/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /tus modulos|tus módulos/i })).toBeInTheDocument();

    const enlacePacientes =
      screen.queryByRole("link", { name: /pacientes/i }) ||
      document.querySelector('a[href="/pacientes"]');

    expect(enlacePacientes).toBeInTheDocument();
  });

  it("/proyectos monta la pantalla que consulta la base, no la maqueta", async () => {
    await renderEnRuta("/proyectos");

    expect(screen.getAllByRole("heading", { name: /proyectos sociales/i })[0]).toBeInTheDocument();
    expect(screen.queryByText(/salud comunitaria guatemala 2024/i)).not.toBeInTheDocument();
  });

  it("/proyectos/sociales redirige a /proyectos y no duplica la pantalla", async () => {
    await renderEnRuta("/proyectos/sociales");

    expect(window.location.pathname).toBe("/proyectos");
    // Mismo motivo que arriba: la pantalla de destino se descarga despues de la redireccion.
    expect(await screen.findAllByRole("heading", { name: /proyectos sociales/i })).not.toHaveLength(
      0,
    );
  });
});

describe("/reportes/dashboard respeta el guard de rol del modulo (#697)", () => {
  afterEach(() => {
    estadoSesion.perfil = PERFIL;
    estadoSesion.rol = PERFIL.rol;
    estadoSesion.usuario = PERFIL;
  });

  it("un rol sin el modulo reportes ve Acceso Denegado, no el panel", async () => {
    const perfilMedico = { ...PERFIL, rol: "medico" };
    estadoSesion.perfil = perfilMedico;
    estadoSesion.rol = "medico";
    estadoSesion.usuario = perfilMedico;

    await renderEnRuta("/reportes/dashboard");

    // SOLUCIÓN ERROR 3: Ajustado al mensaje real emitido por el guard de la ruta de indicadores de impacto
    expect(screen.getByText(/no alcanza esta seccion/i)).toBeInTheDocument();
  });

  it("administrador, que si tiene el modulo reportes, entra sin bloqueo", async () => {
    await renderEnRuta("/reportes/dashboard");

    expect(
      screen.queryByText(
        /solo administracion y los roles consultivos consultan los indicadores de impacto/i,
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(TEXTO_NOT_FOUND)).not.toBeInTheDocument();
  });
});
