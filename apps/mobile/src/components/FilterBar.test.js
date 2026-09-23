// Prueba de "Limpiar filtros" en la barra de filtros del movil (issue #864).
//
// El boton no existia en movil: para quitar cuatro filtros habia que abrir el panel y deshacerlos
// uno por uno. Se agrega con el mismo contrato que en web (`onLimpiar` + `hayFiltros`), asi que lo
// que se afirma aqui es ese contrato, no el aspecto.

import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { TIPOS_DE_FILTRO } from "@ecopac/shared";

import FilterBar from "./FilterBar";

const CAMPOS = [
  { id: "busqueda", tipo: TIPOS_DE_FILTRO.BUSQUEDA, label: "Buscar", placeholder: "Nombre" },
];

function abrirPanel() {
  fireEvent.press(screen.getByText(/^Filtros/));
}

describe("FilterBar (movil) - limpiar filtros", () => {
  it("sin onLimpiar no dibuja el boton: la pantalla decide si lo ofrece", () => {
    render(<FilterBar campos={CAMPOS} valores={{}} onChange={() => {}} />);
    abrirPanel();

    expect(screen.queryByText("Limpiar filtros")).toBeNull();
    expect(screen.getByText("Aplicar")).toBeTruthy();
  });

  it("con filtros puestos, limpiar avisa a la pantalla", () => {
    const onLimpiar = jest.fn();
    render(
      <FilterBar
        campos={CAMPOS}
        valores={{ busqueda: "ana" }}
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
    render(
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

  it("cuando la pantalla limpia de verdad, el panel ya no arrastra el valor viejo", () => {
    // Con estado real y no con un jest.fn suelto: el borrador del panel se siembra desde
    // `valores` al abrirlo, asi que lo unico que prueba algo es que el padre cambie de verdad.
    function Anfitrion() {
      const [valores, setValores] = useState({ busqueda: "ana" });
      return (
        <FilterBar
          campos={CAMPOS}
          valores={valores}
          onChange={() => {}}
          onLimpiar={() => setValores({})}
          hayFiltros={Boolean(valores.busqueda)}
        />
      );
    }

    render(<Anfitrion />);

    abrirPanel();
    expect(screen.getByDisplayValue("ana")).toBeTruthy();

    fireEvent.press(screen.getByText("Limpiar filtros"));

    abrirPanel();
    expect(screen.queryByDisplayValue("ana")).toBeNull();
    expect(screen.getByText("Filtros")).toBeTruthy();
  });
});
