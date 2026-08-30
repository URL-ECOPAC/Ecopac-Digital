// Pruebas de iniciarSesion, cerrarSesion, obtenerSesion y del helper evaluarPerfilDeSesion.
//
// El cliente de Supabase y obtenerPerfil() se mockean: estas pruebas no deben arrastrar
// @supabase/supabase-js real ni una base de datos. Los correos y contrasenas son inventados
// (regla de confidencialidad de AGENTS.md).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./cliente.js", () => ({
  obtenerSupabase: vi.fn(),
}));

vi.mock("../usuarios/api.js", () => ({
  obtenerPerfil: vi.fn(),
}));

import { obtenerSupabase } from "./cliente.js";
import { obtenerPerfil } from "../usuarios/api.js";
import { CODIGOS_DE_ERROR_DE_SUPABASE } from "./errores-de-supabase.js";
import {
  cerrarSesion,
  evaluarPerfilDeSesion,
  iniciarSesion,
  obtenerSesion,
  requiereCerrarSesion,
} from "./sesion.js";

const CORREO = "prueba.qa@ecopac.test";
const CONTRASENA = "ClaveValida123";

const PERFIL_ACTIVO = {
  id: "11111111-1111-1111-1111-111111111111",
  nombres: "Ana",
  apellidos: "Prueba",
  rol: "medico",
  activo: true,
};

const PERFIL_DESACTIVADO = { ...PERFIL_ACTIVO, activo: false };

function sesionDeSupabase(usuario) {
  return { access_token: "token-de-prueba", user: usuario ?? { id: PERFIL_ACTIVO.id } };
}

/** Error de Auth como lo entrega supabase-js ante credenciales invalidas. */
function errorDeCredenciales() {
  return {
    __isAuthError: true,
    name: "AuthApiError",
    code: "invalid_credentials",
    status: 400,
    message: "Invalid login credentials",
  };
}

function clienteFalso({ signInWithPassword, signOut, getSession } = {}) {
  return {
    auth: {
      signInWithPassword: signInWithPassword ?? vi.fn(),
      signOut: signOut ?? vi.fn().mockResolvedValue({ error: null }),
      getSession: getSession ?? vi.fn(),
      stopAutoRefresh: vi.fn(),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("iniciarSesion", () => {
  it("criterio 1: credenciales validas y perfil activo devuelven sesion, perfil y rol", async () => {
    const cliente = clienteFalso({
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: sesionDeSupabase() },
        error: null,
      }),
    });
    obtenerSupabase.mockReturnValue(cliente);
    obtenerPerfil.mockResolvedValue({ perfil: PERFIL_ACTIVO, error: null });

    const resultado = await iniciarSesion(CORREO, CONTRASENA);

    expect(resultado.error).toBeNull();
    expect(resultado.sesion).toEqual(sesionDeSupabase());
    expect(resultado.perfil).toEqual(PERFIL_ACTIVO);
    expect(resultado.rol).toBe(PERFIL_ACTIVO.rol);
    // El correo que llega a Supabase es el ya normalizado por validarCredenciales().
    expect(cliente.auth.signInWithPassword).toHaveBeenCalledWith({
      email: CORREO.toLowerCase(),
      password: CONTRASENA,
    });
  });

  it("no llama a Supabase si validarCredenciales() encuentra campos vacios", async () => {
    const cliente = clienteFalso();
    obtenerSupabase.mockReturnValue(cliente);

    const resultado = await iniciarSesion("", "");

    expect(resultado.sesion).toBeNull();
    expect(resultado.error).toBeNull();
    expect(resultado.erroresDeCampo).toHaveProperty("email");
    expect(resultado.erroresDeCampo).toHaveProperty("contrasena");
    expect(cliente.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("criterio 2: contrasena incorrecta y cuenta desactivada devuelven el MISMO error completo", async () => {
    // Caso A: Supabase rechaza las credenciales directamente.
    const clienteCredencialesMalas = clienteFalso({
      signInWithPassword: vi.fn().mockResolvedValue({ data: null, error: errorDeCredenciales() }),
    });
    obtenerSupabase.mockReturnValue(clienteCredencialesMalas);
    const resultadoCredencialesMalas = await iniciarSesion(CORREO, "otra-clave-cualquiera");

    // Caso B: credenciales correctas, pero el perfil esta desactivado.
    const clienteCuentaDesactivada = clienteFalso({
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: sesionDeSupabase() },
        error: null,
      }),
    });
    obtenerSupabase.mockReturnValue(clienteCuentaDesactivada);
    obtenerPerfil.mockResolvedValue({ perfil: PERFIL_DESACTIVADO, error: null });
    const resultadoCuentaDesactivada = await iniciarSesion(CORREO, CONTRASENA);

    expect(resultadoCredencialesMalas.sesion).toBeNull();
    expect(resultadoCuentaDesactivada.sesion).toBeNull();

    // Comparacion del objeto de error COMPLETO, no solo el mensaje: codigo, mensaje, detalle
    // y esReintentable deben ser identicos en los dos casos, o se reintroduce la enumeracion
    // de cuentas que el criterio de aceptacion prohibe (OWASP A07).
    expect(resultadoCuentaDesactivada.error).toEqual(resultadoCredencialesMalas.error);
    expect(resultadoCredencialesMalas.error.codigo).toBe(
      CODIGOS_DE_ERROR_DE_SUPABASE.CREDENCIALES_INVALIDAS,
    );

    // Y ademas cierra la sesion que ya se habia emitido para la cuenta desactivada.
    expect(clienteCuentaDesactivada.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("criterio 4: perfil desactivado no puede iniciar sesion", async () => {
    const cliente = clienteFalso({
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: sesionDeSupabase() },
        error: null,
      }),
    });
    obtenerSupabase.mockReturnValue(cliente);
    obtenerPerfil.mockResolvedValue({ perfil: PERFIL_DESACTIVADO, error: null });

    const resultado = await iniciarSesion(CORREO, CONTRASENA);

    expect(resultado.sesion).toBeNull();
    expect(resultado.perfil).toBeNull();
    expect(resultado.error).not.toBeNull();
    expect(cliente.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("criterio 4-bis: autenticacion correcta pero sin fila de perfil falla cerrado con mensaje propio", async () => {
    const cliente = clienteFalso({
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: sesionDeSupabase() },
        error: null,
      }),
    });
    obtenerSupabase.mockReturnValue(cliente);
    obtenerPerfil.mockResolvedValue({ perfil: null, error: null });

    const resultado = await iniciarSesion(CORREO, CONTRASENA);

    expect(resultado.sesion).toBeNull();
    expect(resultado.error).not.toBeNull();
    // A proposito NO es el mensaje generico de credenciales: aqui ya se demostro conocer la
    // contrasena correcta, asi que no hay enumeracion posible (decision de producto).
    expect(resultado.error.codigo).not.toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CREDENCIALES_INVALIDAS);
    expect(resultado.error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
    expect(cliente.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("un fallo transitorio leyendo el perfil no cierra la sesion recien emitida", async () => {
    const cliente = clienteFalso({
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: sesionDeSupabase() },
        error: null,
      }),
    });
    obtenerSupabase.mockReturnValue(cliente);
    obtenerPerfil.mockResolvedValue({
      perfil: null,
      error: {
        codigo: CODIGOS_DE_ERROR_DE_SUPABASE.FALLO_DE_RED,
        mensaje: "x",
        detalle: "",
        esReintentable: true,
      },
    });

    const resultado = await iniciarSesion(CORREO, CONTRASENA);

    expect(resultado.error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.FALLO_DE_RED);
    expect(cliente.auth.signOut).not.toHaveBeenCalled();
  });
});

describe("cerrarSesion", () => {
  it("criterio 3: no lanza y detiene el autorefresco aunque signOut rechace la promesa", async () => {
    const signOut = vi.fn().mockRejectedValue(new Error("la red no responde"));
    const cliente = clienteFalso({ signOut });
    obtenerSupabase.mockReturnValue(cliente);

    await expect(cerrarSesion()).resolves.toBeUndefined();

    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(cliente.auth.stopAutoRefresh).toHaveBeenCalled();
  });

  it("llama a stopAutoRefresh tambien cuando signOut resuelve sin error", async () => {
    const cliente = clienteFalso();
    obtenerSupabase.mockReturnValue(cliente);

    await cerrarSesion();

    expect(cliente.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(cliente.auth.stopAutoRefresh).toHaveBeenCalled();
  });
});

describe("obtenerSesion", () => {
  it("devuelve la forma de 'sin sesion' cuando no hay sesion, nunca null a secas", async () => {
    const cliente = clienteFalso({
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    });
    obtenerSupabase.mockReturnValue(cliente);

    const resultado = await obtenerSesion();

    expect(resultado).toEqual({ sesion: null, perfil: null, rol: null, error: null });
  });

  it("trae perfil y rol cuando hay una sesion valida con perfil activo", async () => {
    const cliente = clienteFalso({
      getSession: vi.fn().mockResolvedValue({ data: { session: sesionDeSupabase() }, error: null }),
    });
    obtenerSupabase.mockReturnValue(cliente);
    obtenerPerfil.mockResolvedValue({ perfil: PERFIL_ACTIVO, error: null });

    const resultado = await obtenerSesion();

    expect(resultado.sesion).toEqual(sesionDeSupabase());
    expect(resultado.perfil).toEqual(PERFIL_ACTIVO);
    expect(resultado.rol).toBe(PERFIL_ACTIVO.rol);
  });

  it("aplica la misma regla de fallo cerrado que iniciarSesion() ante un perfil ausente", async () => {
    const cliente = clienteFalso({
      getSession: vi.fn().mockResolvedValue({ data: { session: sesionDeSupabase() }, error: null }),
    });
    obtenerSupabase.mockReturnValue(cliente);
    obtenerPerfil.mockResolvedValue({ perfil: null, error: null });

    const resultado = await obtenerSesion();

    expect(resultado.sesion).toBeNull();
    expect(resultado.error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
    expect(cliente.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("muestra el mensaje ESPECIFICO de cuenta desactivada (aqui no hay enumeracion posible)", async () => {
    const cliente = clienteFalso({
      getSession: vi.fn().mockResolvedValue({ data: { session: sesionDeSupabase() }, error: null }),
    });
    obtenerSupabase.mockReturnValue(cliente);
    obtenerPerfil.mockResolvedValue({ perfil: PERFIL_DESACTIVADO, error: null });

    const resultado = await obtenerSesion();

    expect(resultado.error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CUENTA_DESACTIVADA);
  });
});

describe("evaluarPerfilDeSesion / requiereCerrarSesion", () => {
  it("requiereCerrarSesion() es verdadero solo para cuenta desactivada y perfil ausente", () => {
    expect(requiereCerrarSesion({ codigo: CODIGOS_DE_ERROR_DE_SUPABASE.CUENTA_DESACTIVADA })).toBe(
      true,
    );
    expect(requiereCerrarSesion({ codigo: CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO })).toBe(
      true,
    );
    expect(requiereCerrarSesion({ codigo: CODIGOS_DE_ERROR_DE_SUPABASE.FALLO_DE_RED })).toBe(false);
    expect(requiereCerrarSesion(null)).toBe(false);
  });

  it("evaluarPerfilDeSesion() no cierra sesion por si sola: eso lo decide quien llama", async () => {
    obtenerPerfil.mockResolvedValue({ perfil: PERFIL_DESACTIVADO, error: null });
    const cliente = clienteFalso();
    obtenerSupabase.mockReturnValue(cliente);

    await evaluarPerfilDeSesion({ id: PERFIL_ACTIVO.id });

    expect(cliente.auth.signOut).not.toHaveBeenCalled();
  });
});

describe("es la unica implementacion de la autenticacion (issue #512)", () => {
  // El camino de la pantalla web es LoginPage -> useInicioSesion -> este iniciarSesion. No se
  // monta el hook para comprobarlo: packages/shared corre vitest con environment "node" y sin
  // testing-library, a proposito (ver useDesactivacionUsuario.test.js). Lo que si se puede fijar
  // -y es lo que fallaba- es que no exista una segunda puerta con el mismo nombre.
  it("el modulo de usuarios ya no ofrece un iniciarSesion alternativo", async () => {
    const usuarios = await import("../usuarios/api.js");

    expect(Object.keys(usuarios)).not.toContain("iniciarSesion");
    expect(Object.keys(usuarios)).not.toContain("cerrarSesion");
  });

  it("el hook de la pantalla web consume esta implementacion, no otra", async () => {
    // Si alguna vez vuelve a haber dos, el barril las recibiria por dos estrellas y ESM las
    // dejaria en undefined (bug #365): esta comprobacion lo caza como un fallo de prueba en vez
    // de como un TypeError en produccion.
    const barril = await import("../index.js");

    expect(typeof barril.iniciarSesion).toBe("function");
    expect(typeof barril.cerrarSesion).toBe("function");
  });
});
