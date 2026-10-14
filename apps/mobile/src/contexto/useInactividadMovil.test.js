// Pruebas del cierre de sesion por inactividad en movil (issue #840).
//
// LO QUE DE VERDAD IMPORTA PROBAR AQUI es el camino de AppState, no el temporizador. Hasta esta
// issue movil no cerraba la sesion nunca, y el motivo por el que no bastaba con reusar
// useExpiracionPorInactividad() de shared es que en un telefono los temporizadores de JavaScript
// NO CORREN en segundo plano: un telefono guardado tres horas en una mochila volvia con la sesion
// abierta y el temporizador intacto. Ese es el caso a cubrir, y es el que se prueba primero.

import { renderHook, act } from "@testing-library/react-native";
import { AppState } from "react-native";

import { useInactividadMovil, CLAVE_ULTIMA_ACTIVIDAD_MOVIL } from "./useInactividadMovil";

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock("../almacenamiento", () => ({
  almacenamientoMovil: {
    getItem: (...args) => mockGetItem(...args),
    setItem: (...args) => mockSetItem(...args),
  },
}));

const UN_MINUTO = 60 * 1000;

/** Dispara el listener que el hook registro en AppState, como haria el sistema operativo. */
function cambiarAppState(estado) {
  const llamada = AppState.addEventListener.mock.calls.at(-1);
  return act(async () => {
    llamada[1](estado);
    // Deja correr la promesa de lectura del almacenamiento.
    await Promise.resolve();
    await Promise.resolve();
  });
}

let quitarListener;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  quitarListener = jest.fn();
  jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove: quitarListener });
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function montar({ activo = true, alVencer = jest.fn(), minutos = 60 } = {}) {
  const resultado = renderHook(() => useInactividadMovil({ activo, alVencer, minutos }));
  return { ...resultado, alVencer };
}

describe("useInactividadMovil", () => {
  describe("cuando la app vuelve del segundo plano", () => {
    it("cierra la sesion si estuvo guardada mas del limite", async () => {
      const haceDosHoras = Date.now() - 120 * UN_MINUTO;
      mockGetItem.mockResolvedValue(String(haceDosHoras));
      const { alVencer } = montar();

      await cambiarAppState("active");

      expect(alVencer).toHaveBeenCalledTimes(1);
    });

    it("no cierra la sesion si estuvo guardada menos del limite", async () => {
      const haceDiezMinutos = Date.now() - 10 * UN_MINUTO;
      mockGetItem.mockResolvedValue(String(haceDiezMinutos));
      const { alVencer } = montar();

      await cambiarAppState("active");

      expect(alVencer).not.toHaveBeenCalled();
    });

    it("anota la hora al irse a segundo plano, que es lo unico que sobrevive", async () => {
      montar();

      await cambiarAppState("background");

      expect(mockSetItem).toHaveBeenCalledWith(
        CLAVE_ULTIMA_ACTIVIDAD_MOVIL,
        expect.stringMatching(/^\d+$/),
      );
    });

    // iOS pasa por "inactive" al bajar el centro de control o al cambiar de app; si no se anotara
    // ahi, ese camino perderia la marca.
    it("tambien anota la hora en el estado intermedio de iOS", async () => {
      montar();

      await cambiarAppState("inactive");

      expect(mockSetItem).toHaveBeenCalled();
    });
  });

  // Ante un dato corrupto se prefiere no interrumpir a quien esta trabajando: sacar a alguien de
  // la sesion a media captura por un reloj movido a mano es peor que el riesgo que se cubre.
  describe("con una marca de tiempo que no se puede creer", () => {
    it.each([
      ["ilegible", "no es un numero"],
      ["vacia", ""],
      ["del futuro", String(Date.now() + 10 * UN_MINUTO)],
    ])("una marca %s no cierra la sesion", async (_caso, guardada) => {
      mockGetItem.mockResolvedValue(guardada);
      const { alVencer } = montar();

      await cambiarAppState("active");

      expect(alVencer).not.toHaveBeenCalled();
    });

    it("un fallo del almacenamiento tampoco cierra la sesion", async () => {
      mockGetItem.mockRejectedValue(new Error("SecureStore no disponible"));
      const { alVencer } = montar();

      await cambiarAppState("active");

      expect(alVencer).not.toHaveBeenCalled();
    });
  });

  describe("con la app en primer plano", () => {
    it("cierra la sesion tras el limite sin navegar a ningun lado", () => {
      const { alVencer } = montar({ minutos: 60 });

      act(() => jest.advanceTimersByTime(61 * UN_MINUTO));

      expect(alVencer).toHaveBeenCalledTimes(1);
    });

    it("navegar reinicia la cuenta", () => {
      const { result, alVencer } = montar({ minutos: 60 });

      act(() => jest.advanceTimersByTime(50 * UN_MINUTO));
      act(() => result.current.registrarActividad());
      act(() => jest.advanceTimersByTime(50 * UN_MINUTO));

      expect(alVencer).not.toHaveBeenCalled();
    });

    // Aunque el temporizador siga corriendo, alVencer no puede llamarse dos veces: logout() se
    // dispararia otra vez sobre una sesion ya cerrada.
    it("avisa una sola vez aunque el temporizador siga corriendo", () => {
      const { alVencer } = montar({ minutos: 60 });

      act(() => jest.advanceTimersByTime(200 * UN_MINUTO));

      expect(alVencer).toHaveBeenCalledTimes(1);
    });
  });

  // La issue pide avisar antes de cerrar, igual que la web: un cierre sin aviso a media captura
  // obliga a volver a escribir todo con el paciente enfrente.
  describe("el aviso previo", () => {
    it("aparece en el ultimo minuto y no antes", () => {
      const { result } = montar({ minutos: 60 });

      act(() => jest.advanceTimersByTime(58 * UN_MINUTO));
      expect(result.current.avisoVisible).toBe(false);

      act(() => jest.advanceTimersByTime(90 * 1000));
      expect(result.current.avisoVisible).toBe(true);
      expect(result.current.venceEn).toEqual(expect.any(Number));
    });

    it("seguir conectado lo esconde y aleja el cierre", () => {
      const { result, alVencer } = montar({ minutos: 60 });

      act(() => jest.advanceTimersByTime(59 * UN_MINUTO + 30 * 1000));
      expect(result.current.avisoVisible).toBe(true);

      act(() => result.current.seguirConectado());
      expect(result.current.avisoVisible).toBe(false);

      act(() => jest.advanceTimersByTime(30 * UN_MINUTO));
      expect(alVencer).not.toHaveBeenCalled();
    });
  });

  it("sin sesion abierta no vigila nada", () => {
    const { alVencer } = montar({ activo: false, minutos: 60 });

    act(() => jest.advanceTimersByTime(200 * UN_MINUTO));

    expect(alVencer).not.toHaveBeenCalled();
  });

  it("al desmontar suelta el temporizador y el listener", () => {
    const { unmount, alVencer } = montar({ minutos: 60 });

    unmount();
    act(() => jest.advanceTimersByTime(200 * UN_MINUTO));

    expect(quitarListener).toHaveBeenCalled();
    expect(alVencer).not.toHaveBeenCalled();
  });
});
