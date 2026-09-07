// Verifica que las pantallas alcanzables desde Inicio con modulo restringido (issue #692)
// esten realmente envueltas en RutaProtegida dentro de AppNavigator, no solo que exista una
// tabla de datos correcta: monta InicioNavigator de verdad y navega a cada ruta protegida.
//
// La guarda del cliente NO es el control de acceso real: quien protege es RLS. Lo que se
// comprueba aqui es que la pantalla correcta se dibuje, no que el dato este protegido.

import { render, screen } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { Text } from "react-native";

import { ROLES } from "@ecopac/shared";

import { InicioNavigator, rolesDelModulo } from "./AppNavigator";
import { ROUTES } from "./rutas";

// El valor inicial debe ser un literal puro: jest.mock() no permite que su factory referencie
// una variable externa cuya inicializacion dependa de otro import (babel-plugin-jest-hoist).
const sesion = { perfil: { rol: "administrador" } };

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => sesion,
}));

const PANTALLAS_CON_GUARDA = [
  { routeName: ROUTES.DONACIONES, moduloId: "donaciones" },
  { routeName: ROUTES.PROYECTOS, moduloId: "proyectos" },
  { routeName: ROUTES.PRESUPUESTOS, moduloId: "presupuestos" },
  { routeName: ROUTES.COLABORADORES, moduloId: "colaboradores" },
  { routeName: ROUTES.FICHA_COLABORADOR, moduloId: "colaboradores" },
];

jest.mock("../screens/AccesoDenegadoScreen", () => {
  const { Text: TextoRN } = require("react-native");
  return function AccesoDenegadoFalso() {
    return <TextoRN>acceso denegado</TextoRN>;
  };
});

// Se reemplazan las pantallas hoja por dobles livianos: lo que se prueba es que la guarda
// decida, no la logica interna de cada pantalla (eso ya lo cubren sus propios tests).
function mockPantalla(nombre) {
  return function PantallaFalsa() {
    return <Text>{`contenido de ${nombre}`}</Text>;
  };
}
jest.mock("../screens/InicioScreen", () => mockPantalla("inicio"));
jest.mock("../screens/DonacionesScreen", () => mockPantalla("donaciones"));
jest.mock("../screens/ProyectosScreen", () => mockPantalla("proyectos"));
jest.mock("../screens/PresupuestosScreen", () => mockPantalla("presupuestos"));
jest.mock("../screens/ColaboradoresScreen", () => mockPantalla("colaboradores"));
jest.mock("../screens/FichaColaboradorScreen", () => mockPantalla("ficha-colaborador"));

function renderRuta(routeName) {
  return render(
    <NavigationContainer initialState={{ routes: [{ name: routeName }] }}>
      <InicioNavigator />
    </NavigationContainer>,
  );
}

describe("AppNavigator: guarda de rol en pantallas de Inicio (issue #692)", () => {
  beforeEach(() => {
    sesion.perfil = { rol: ROLES.ADMINISTRADOR };
  });

  it.each(PANTALLAS_CON_GUARDA)(
    "$routeName exige un rol permitido segun MODULOS ($moduloId)",
    ({ routeName, moduloId }) => {
      const roles = rolesDelModulo(moduloId);
      expect(roles.length).toBeGreaterThan(0);

      const rolDenegado = Object.values(ROLES).find((r) => !roles.includes(r));
      sesion.perfil = { rol: rolDenegado };
      renderRuta(routeName);

      expect(screen.getByText("acceso denegado")).toBeTruthy();
    },
  );

  it.each(PANTALLAS_CON_GUARDA)(
    "$routeName deja pasar a un rol permitido segun MODULOS ($moduloId)",
    ({ routeName, moduloId }) => {
      const [rolPermitido] = rolesDelModulo(moduloId);
      sesion.perfil = { rol: rolPermitido };
      renderRuta(routeName);

      expect(screen.queryByText("acceso denegado")).toBeNull();
    },
  );

  it("sin sesion (perfil null) ninguna pantalla protegida deja pasar", () => {
    sesion.perfil = null;
    PANTALLAS_CON_GUARDA.forEach(({ routeName }) => {
      const { unmount } = renderRuta(routeName);
      expect(screen.getByText("acceso denegado")).toBeTruthy();
      unmount();
    });
  });
});
