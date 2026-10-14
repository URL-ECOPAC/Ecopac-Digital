// Pruebas de la observabilidad del lado movil (issue #762): el aviso de sin conexion, el hook que
// lo alimenta y el limite de error. Espejo de apps/web/src/components/UniformidadYObservabilidad.test.jsx.

import { act, fireEvent, render, renderHook, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { __emitir } from "@react-native-community/netinfo";
import { configurarDestinoDeErrores } from "@ecopac/shared";

import AvisoSinConexion from "./AvisoSinConexion";
import LimiteDeError from "./LimiteDeError";
import { estaEnLinea, useEnLinea } from "../useEnLinea";

const METRICAS = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function conMargenes(ui) {
  return <SafeAreaProvider initialMetrics={METRICAS}>{ui}</SafeAreaProvider>;
}

describe("estaEnLinea", () => {
  it("no avisa mientras NetInfo todavia no sabe (null al arrancar)", () => {
    expect(estaEnLinea(null)).toBe(true);
    expect(estaEnLinea({ isConnected: null, isInternetReachable: null })).toBe(true);
  });

  it("sin red de ningun tipo es sin conexion", () => {
    expect(estaEnLinea({ isConnected: false, isInternetReachable: null })).toBe(false);
  });

  it("conectado a una red que no llega a internet tambien es sin conexion", () => {
    // El caso comun en jornada: el wifi del centro de salud, sin salida.
    expect(estaEnLinea({ isConnected: true, isInternetReachable: false })).toBe(false);
  });

  it("con red e internet es en linea", () => {
    expect(estaEnLinea({ isConnected: true, isInternetReachable: true })).toBe(true);
  });
});

describe("useEnLinea", () => {
  it("sigue lo que avisa el sistema al perder y recuperar la senal", () => {
    const { result } = renderHook(() => useEnLinea());
    expect(result.current).toBe(true);

    act(() => __emitir({ isConnected: false, isInternetReachable: false }));
    expect(result.current).toBe(false);

    act(() => __emitir({ isConnected: true, isInternetReachable: true }));
    expect(result.current).toBe(true);
  });
});

describe("AvisoSinConexion (movil)", () => {
  it("no pinta nada con red", () => {
    render(conMargenes(<AvisoSinConexion enLinea />));
    expect(screen.queryByText(/Sin conexión/)).toBeNull();
  });

  it("sin red dice que lo que se guarde no llegara", () => {
    render(conMargenes(<AvisoSinConexion enLinea={false} />));
    expect(screen.getByText(/Sin conexión/)).toBeTruthy();
    expect(screen.getByText(/no llegará a la base de datos/)).toBeTruthy();
  });
});

describe("LimiteDeError (movil)", () => {
  const reportes = [];

  beforeEach(() => {
    reportes.length = 0;
    configurarDestinoDeErrores((reporte) => reportes.push(reporte));
    // React vuelve a lanzar el error a la consola al atraparlo; aqui no aporta nada.
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    configurarDestinoDeErrores(null);
    console.error.mockRestore();
  });

  function Revienta({ debeFallar }) {
    if (debeFallar) {
      throw new Error("Fallo al pintar al paciente 0a1b2c3d-1111-2222-3333-444455556666");
    }
    const { Text } = require("react-native");
    return <Text>Pantalla sana</Text>;
  }

  it("atrapa el error, lo reporta sin el UUID y ofrece reintentar", () => {
    let debeFallar = true;
    const { rerender } = render(
      <LimiteDeError>
        <Revienta debeFallar={debeFallar} />
      </LimiteDeError>,
    );

    expect(screen.getByText("Algo salió mal en esta pantalla")).toBeTruthy();
    expect(reportes).toHaveLength(1);
    expect(reportes[0].origen).toBe("render");
    expect(reportes[0].mensaje).not.toMatch(/0a1b2c3d/);
    expect(reportes[0].mensaje).toContain("[id]");

    debeFallar = false;
    rerender(
      <LimiteDeError>
        <Revienta debeFallar={debeFallar} />
      </LimiteDeError>,
    );
    fireEvent.press(screen.getByText("Reintentar"));
    expect(screen.getByText("Pantalla sana")).toBeTruthy();
  });

  it("sin a donde volver no ofrece 'Volver al inicio'", () => {
    render(
      <LimiteDeError>
        <Revienta debeFallar />
      </LimiteDeError>,
    );
    expect(screen.queryByText("Volver al inicio")).toBeNull();
  });
});
