// Pruebas de la guarda de rol de la app movil (issues #427, #702 y #820).
// @vitest-environment jsdom
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
    sesion.cargando = false;
  });

  // Issue #840: justo despues de iniciar sesion hay usuario y el perfil se esta leyendo. Negar el
  // acceso ahi era el error que se veia un instante en cada login.
  it("mientras el perfil se esta leyendo no niega el acceso ni muestra el contenido", () => {
    sesion.cargando = true;

    contenidoProtegido([ROLES.MEDICO]);

    expect(screen.queryByText("acceso denegado")).toBeNull();
    expect(screen.queryByText("contenido protegido")).toBeNull();
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

  // Esta prueba afirmaba lo contrario hasta la #820 ("con la lista vacia deja pasar a cualquier rol
  // conocido"), y afirmaba bien: describia el comportamiento que tenia el guard. Lo que estaba mal
  // era el comportamiento. Una lista vacia es lo que devuelve rolesDelModulo() cuando el modulo no
  // existe, asi que "vacio deja pasar" convertia un id mal escrito en una pantalla abierta a todos.
  it("con la lista vacia no deja pasar a nadie, ni a un rol del enum", () => {
    sesion.perfil = { rol: ROLES.VOLUNTARIO };

    contenidoProtegido([]);

    expect(screen.getByText("acceso denegado")).toBeTruthy();
    expect(screen.queryByText("contenido protegido")).toBeNull();
  });

  it("sin rolesPermitidos tampoco deja pasar: el valor por defecto es la lista vacia", () => {
    sesion.perfil = { rol: ROLES.ADMINISTRADOR };

    render(
      <RutaProtegida>
        <Text>contenido protegido</Text>
      </RutaProtegida>,
    );

    expect(screen.getByText("acceso denegado")).toBeTruthy();
  });

  it("un rol que no existe en el enum no pasa", () => {
    sesion.perfil = { rol: "coordinador" };

    contenidoProtegido([ROLES.ADMINISTRADOR, ROLES.MEDICO]);

    expect(screen.getByText("acceso denegado")).toBeTruthy();
  });
});
