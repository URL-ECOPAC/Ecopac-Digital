// Pruebas de la barra de filtros del movil.
//
// El buscador queda a la vista y se aplica al escribir; el resto de filtros vive en un panel
// lateral que se abre con "Filtros" y se aplica con "Aplicar". Los filtros puestos se ven como
// chips que se quitan de un toque. "Limpiar filtros" (issue #864) tiene el mismo contrato que en
// la web: `onLimpiar` + `hayFiltros`. Lo que se afirma aqui es ese contrato, no el aspecto.

import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TIPOS_DE_FILTRO } from "@ecopac/shared";

import FilterBar from "./FilterBar";

const METRICAS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const BUSQUEDA = {
  id: "busqueda",
  tipo: TIPOS_DE_FILTRO.BUSQUEDA,
  label: "Buscar",
  placeholder: "Nombre",
};
const ESTADO = {
  id: "estado",
  tipo: TIPOS_DE_FILTRO.SELECT,
  label: "Estado",
  opciones: [
    { value: "activo", label: "Activo" },
    { value: "inactivo", label: "Inactivo" },
  ],
};
const CAMPOS = [BUSQUEDA, ESTADO];

function dibujar(ui) {
  return render(<SafeAreaProvider initialMetrics={METRICAS}>{ui}</SafeAreaProvider>);
}

function abrirPanel() {
  fireEvent.press(screen.getByLabelText(/^Filtros/));
}

describe("FilterBar (movil)", () => {
  it("el buscador queda a la vista y se aplica al escribir", () => {
    const onChange = jest.fn();
    dibujar(<FilterBar campos={CAMPOS} valores={{}} onChange={onChange} />);

    fireEvent.changeText(screen.getByLabelText("Buscar"), "ana");
    expect(onChange).toHaveBeenCalledWith("busqueda", "ana");
  });

  it("solo con buscador no hay boton de filtros: no habria nada en el panel", () => {
    dibujar(<FilterBar campos={[BUSQUEDA]} valores={{}} onChange={() => {}} />);
    expect(screen.queryByText("Filtros")).toBeNull();
  });

  it("lo del panel se aplica con Aplicar, no antes", () => {
    const onChange = jest.fn();
    dibujar(<FilterBar campos={CAMPOS} valores={{}} onChange={onChange} />);
    abrirPanel();

    fireEvent.press(screen.getByText("Todos"));
    fireEvent.press(screen.getByText("Inactivo"));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Aplicar"));
    expect(onChange).toHaveBeenCalledWith("estado", "inactivo");
  });

  it("un filtro puesto se ve como chip, cuenta en el boton y se quita de un toque", () => {
    const onChange = jest.fn();
    dibujar(<FilterBar campos={CAMPOS} valores={{ estado: "activo" }} onChange={onChange} />);

    expect(screen.getByText("Estado: Activo")).toBeTruthy();
    expect(screen.getByLabelText("Filtros, 1 activos")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Quitar filtro Estado"));
    expect(onChange).toHaveBeenCalledWith("estado", null);
  });

  it("sin onLimpiar no dibuja el boton: la pantalla decide si lo ofrece", () => {
    dibujar(<FilterBar campos={CAMPOS} valores={{}} onChange={() => {}} />);
    abrirPanel();

    expect(screen.queryByText("Limpiar filtros")).toBeNull();
    expect(screen.getByText("Aplicar")).toBeTruthy();
  });

  it("con filtros puestos, limpiar avisa a la pantalla", () => {
    const onLimpiar = jest.fn();
    dibujar(
      <FilterBar
        campos={CAMPOS}
        valores={{ estado: "activo" }}
        onChange={() => {}}
        onLimpiar={onLimpiar}
        hayFiltros
      />,
    );
    abrirPanel();

    fireEvent.press(screen.getByText("Limpiar filtros"));
    expect(onLimpiar).toHaveBeenCalledTimes(1);
  });

  it("sin nada que limpiar el boton esta deshabilitado", () => {
    const onLimpiar = jest.fn();
    dibujar(
      <FilterBar
        campos={CAMPOS}
        valores={{}}
        onChange={() => {}}
        onLimpiar={onLimpiar}
        hayFiltros={false}
      />,
    );
    abrirPanel();

    fireEvent.press(screen.getByText("Limpiar filtros"));
    expect(onLimpiar).not.toHaveBeenCalled();
  });

  it("cuando la pantalla limpia de verdad, el chip desaparece", () => {
    // Con estado real y no con un jest.fn suelto: lo unico que prueba algo es que el padre
    // cambie de verdad y la barra lo refleje.
    function Anfitrion() {
      const [valores, setValores] = useState({ estado: "activo" });
      return (
        <FilterBar
          campos={CAMPOS}
          valores={valores}
          onChange={() => {}}
          onLimpiar={() => setValores({})}
          hayFiltros={Boolean(valores.estado)}
        />
      );
    }

    dibujar(<Anfitrion />);
    expect(screen.getByText("Estado: Activo")).toBeTruthy();

    abrirPanel();
    fireEvent.press(screen.getByText("Limpiar filtros"));

    expect(screen.queryByText("Estado: Activo")).toBeNull();
    expect(screen.getByText("Filtros")).toBeTruthy();
  });
});
