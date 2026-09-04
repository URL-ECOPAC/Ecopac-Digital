// Pruebas de la guarda de rol de la app movil (issues #427 y #702).
//
// Es la primera prueba de apps/mobile: hasta la #702 el workspace no tenia ninguna ni script
// `test`, y `npm test --workspaces --if-present` lo saltaba en silencio, asi que el CI pasaba en
// verde sin haber ejecutado una sola linea de las 7.363 de esta app.
//
// Se elige esta pieza a proposito: es la que decide que ve cada rol, y ademas es codigo que hoy
// no monta nadie (issue #692, que la conecta a la navegacion). Una prueba aqui fija el
// comportamiento antes de que se conecte, en vez de despues.
//
// La guarda del cliente NO es el control de acceso real: quien protege es RLS. Lo que se
// comprueba aqui es que la pantalla correcta se dibuje, no que el dato este protegido.

import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { ROLES } from "@ecopac/shared";

import RutaProtegida from "./RutaProtegida";

const sesion = { perfil: null };

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => sesion,
}));

// AccesoDenegadoScreen arrastra la navegacion y los tokens; para esta prueba basta con saber
// que la guarda decidio dibujarla en vez de los hijos.
jest.mock("../screens/AccesoDenegadoScreen", () => {
  const { Text: TextoRN } = require("react-native");
  return function AccesoDenegadoFalso() {
    return <TextoRN>acceso denegado</TextoRN>;
  };
});

function contenidoProtegido(rolesPermitidos) {
  return render(
    <RutaProtegida rolesPermitidos={rolesPermitidos}>
      <Text>contenido protegido</Text>
    </RutaProtegida>,
  );
}

describe("RutaProtegida", () => {
  beforeEach(() => {
    sesion.perfil = null;
  });

  it("sin sesion no deja pasar, aunque la lista de roles este vacia", () => {
    contenidoProtegido([]);

    expect(screen.getByText("acceso denegado")).toBeTruthy();
    expect(screen.queryByText("contenido protegido")).toBeNull();
  });

  it("deja pasar al rol que esta en la lista", () => {
    sesion.perfil = { rol: ROLES.MEDICO };

    contenidoProtegido([ROLES.MEDICO, ROLES.ADMINISTRADOR]);

    expect(screen.getByText("contenido protegido")).toBeTruthy();
  });

  it("no deja pasar a un rol que no esta en la lista", () => {
    sesion.perfil = { rol: ROLES.VOLUNTARIO };

    contenidoProtegido([ROLES.ADMINISTRADOR]);

    expect(screen.getByText("acceso denegado")).toBeTruthy();
    expect(screen.queryByText("contenido protegido")).toBeNull();
  });

  it("con la lista vacia deja pasar a cualquier rol conocido", () => {
    sesion.perfil = { rol: ROLES.VOLUNTARIO };

    contenidoProtegido([]);

    expect(screen.getByText("contenido protegido")).toBeTruthy();
  });

  it("un rol que no existe en el enum no pasa", () => {
    sesion.perfil = { rol: "coordinador" };

    contenidoProtegido([ROLES.ADMINISTRADOR, ROLES.MEDICO]);

    expect(screen.getByText("acceso denegado")).toBeTruthy();
  });
});
