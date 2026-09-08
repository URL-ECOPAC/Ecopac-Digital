// Prueba de la pantalla de Ajustes / perfil propio de la app movil (issue #645).

import { fireEvent, render, screen } from "@testing-library/react-native";
import { TIPOS_DE_CAMPO } from "@ecopac/shared";

import AjustesScreen from "./AjustesScreen";

const mockSesion = {
  usuario: { id: "u1" },
  perfil: {
    nombres: "Ana",
    apellidos: "Perez",
    email: "ana@ecopac.test",
    telefono: "",
    rol: "medico",
  },
  refrescarPerfil: jest.fn(),
  logout: jest.fn(),
};

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => mockSesion,
}));

const mockRegistro = {
  hayAlgoSinGuardar: jest.fn(() => false),
  registrar: jest.fn(),
  desregistrar: jest.fn(),
};

jest.mock("../contexto/RegistroSinGuardarProvider", () => ({
  useRegistroSinGuardar: () => mockRegistro,
}));

const CAMPO_ROL_SOLO_LECTURA = {
  id: "rol",
  label: "Rol",
  tipo: TIPOS_DE_CAMPO.SELECT,
  opciones: [
    { value: "medico", label: "Medico" },
    { value: "administrador", label: "Administradora" },
  ],
  editable: false,
};

const CAMPOS_BASE = [
  { id: "nombres", label: "Nombres", tipo: TIPOS_DE_CAMPO.TEXTO, editable: true },
  { id: "apellidos", label: "Apellidos", tipo: TIPOS_DE_CAMPO.TEXTO, editable: true },
  { id: "email", label: "Correo electronico", tipo: TIPOS_DE_CAMPO.EMAIL, editable: false },
  { id: "telefono", label: "Telefono", tipo: TIPOS_DE_CAMPO.TELEFONO, editable: true },
  CAMPO_ROL_SOLO_LECTURA,
  {
    id: "especialidades",
    label: "Especialidades",
    tipo: TIPOS_DE_CAMPO.ETIQUETAS,
    editable: false,
  },
];

const mockEstadoHook = {
  campos: CAMPOS_BASE,
  valores: {
    nombres: "Ana",
    apellidos: "Perez",
    email: "ana@ecopac.test",
    telefono: "",
    rol: "medico",
  },
  setCampo: jest.fn(),
  erroresDeCampo: {},
  guardando: false,
  errorGlobal: null,
  guardadoExitoso: false,
  guardarPerfil: jest.fn(),
  especialidades: ["Pediatria"],
  cargandoEspecialidades: false,
  contrasena: { actual: "", nueva: "", confirmarNueva: "" },
  setCampoDeContrasena: jest.fn(),
  erroresDeContrasena: {},
  cambiandoContrasena: false,
  errorGlobalDeContrasena: null,
  contrasenaCambiada: false,
  cambiarContrasena: jest.fn(),
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  usePerfilPropio: jest.fn(() => mockEstadoHook),
}));

const { usePerfilPropio } = jest.requireMock("@ecopac/shared");

function pantalla() {
  return render(<AjustesScreen />);
}

describe("AjustesScreen", () => {
  beforeEach(() => {
    mockEstadoHook.campos = CAMPOS_BASE;
    mockEstadoHook.valores = {
      nombres: "Ana",
      apellidos: "Perez",
      email: "ana@ecopac.test",
      telefono: "",
      rol: "medico",
    };
    mockEstadoHook.guardando = false;
    mockEstadoHook.errorGlobal = null;
    mockEstadoHook.guardadoExitoso = false;
    mockEstadoHook.contrasena = { actual: "", nueva: "", confirmarNueva: "" };
    mockEstadoHook.cambiandoContrasena = false;
    mockEstadoHook.errorGlobalDeContrasena = null;
    mockEstadoHook.contrasenaCambiada = false;
    mockRegistro.hayAlgoSinGuardar.mockReturnValue(false);
    usePerfilPropio.mockClear();
    mockEstadoHook.guardarPerfil.mockClear();
    mockEstadoHook.cambiarContrasena.mockClear();
    mockRegistro.registrar.mockClear();
    mockRegistro.desregistrar.mockClear();
    mockSesion.logout.mockClear();
  });

  it("pinta los datos del perfil y sus especialidades", () => {
    pantalla();

    expect(screen.getByDisplayValue("Ana")).toBeTruthy();
    expect(screen.getByDisplayValue("Perez")).toBeTruthy();
    expect(screen.getByDisplayValue("ana@ecopac.test")).toBeTruthy();
    expect(screen.getByText("Pediatria")).toBeTruthy();
  });

  it("un rol de solo lectura se dibuja como campo deshabilitado, no como selector", () => {
    pantalla();

    // El rol de solo lectura sale con etiquetaDeRol(): "Medico", dentro de un TextField real.
    expect(screen.getByDisplayValue("Medico")).toBeTruthy();
  });

  it("un rol editable (administradora) se dibuja como Selector, no como TextField", () => {
    mockEstadoHook.campos = CAMPOS_BASE.map((campo) =>
      campo.id === "rol" ? { ...campo, editable: true } : campo,
    );
    pantalla();

    // Ya no hay un TextInput real con ese valor: el Selector lo dibuja como boton accesible con
    // el mismo texto, no como un campo de texto editable a mano.
    expect(screen.queryByDisplayValue("Medico")).toBeNull();
    expect(screen.getByRole("button", { name: "Medico" })).toBeTruthy();
  });

  it("el boton Guardar cambios dispara guardarPerfil", () => {
    pantalla();

    fireEvent.press(screen.getByText("Guardar cambios"));

    expect(mockEstadoHook.guardarPerfil).toHaveBeenCalled();
  });

  it("el boton Cambiar contraseña dispara cambiarContrasena y muestra el error si lo hay", () => {
    mockEstadoHook.errorGlobalDeContrasena = "La contrasena actual no es correcta.";
    pantalla();

    fireEvent.press(screen.getByRole("button", { name: "Cambiar contraseña" }));

    expect(mockEstadoHook.cambiarContrasena).toHaveBeenCalled();
    expect(screen.getByText("La contrasena actual no es correcta.")).toBeTruthy();
  });

  it("con cambios pendientes en el perfil, se registra en el aviso de cambios sin guardar", () => {
    mockEstadoHook.valores = { ...mockEstadoHook.valores, nombres: "Otro nombre" };
    pantalla();

    expect(mockRegistro.registrar).toHaveBeenCalledWith("perfil-propio");
  });

  it("sin cambios pendientes, no se registra en el aviso de cambios sin guardar", () => {
    pantalla();

    expect(mockRegistro.registrar).not.toHaveBeenCalled();
  });

  it("cerrar sesion sin cambios pendientes no muestra el modal de aviso", () => {
    pantalla();

    fireEvent.press(screen.getByText("Cerrar sesión"));

    expect(mockSesion.logout).toHaveBeenCalled();
    expect(screen.queryByText("Hay cambios sin guardar")).toBeNull();
  });

  it("cerrar sesion con algo sin guardar en otra pantalla muestra el modal (issue #110)", () => {
    mockRegistro.hayAlgoSinGuardar.mockReturnValue(true);
    pantalla();

    fireEvent.press(screen.getByText("Cerrar sesión"));

    expect(mockSesion.logout).not.toHaveBeenCalled();
    expect(screen.getByText("Hay cambios sin guardar")).toBeTruthy();
  });
});
