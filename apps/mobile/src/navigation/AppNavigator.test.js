// La guarda de rol, montando la navegacion de verdad (issues #692 y #820).
//
// guardaDeRol.test.js comprueba la ESTRUCTURA: que ninguna Screen se registre sin envoltorio y que
// los roles de cada una sean los de su modulo. Esta comprueba el COMPORTAMIENTO: monta cada stack
// en la ruta y afirma que con un rol que no alcanza sale AccesoDenegadoScreen, y que con uno que si
// alcanza sale la pantalla. Las dos hacen falta: la marca `esGuardaDeRol` podria estar puesta y el
// guard no decidir nada.
//
// La guarda del cliente NO es el control de acceso real: quien protege es RLS. Lo que se comprueba
// aqui es que la pantalla correcta se dibuje, no que el dato este protegido.
import { render, screen } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { Text } from "react-native";
import {
  puedeAprobarMovimiento,
  puedeRegistrarMovimiento,
  ROLES,
  rolesDelModulo,
  TODOS_LOS_ROLES,
} from "@ecopac/shared";
import AppNavigator, {
  InicioNavigator,
  InventarioNavigator,
  JornadasNavigator,
  PacientesNavigator,
} from "./AppNavigator";
import { ROUTES } from "./rutas";

// El valor inicial debe ser un literal puro: jest.mock() no permite que su factory referencie una
// variable externa cuya inicializacion dependa de otro import (babel-plugin-jest-hoist).
const sesion = { perfil: { rol: "administrador" }, rol: "administrador" };
jest.mock("../contexto/RegistroSinGuardarProvider", () => ({
  useRegistroSinGuardar: () => ({ hayAlgoSinGuardar: () => false }),
}));

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => sesion,
}));

jest.mock("../screens/AccesoDenegadoScreen", () => {
  const { Text: TextoRN } = require("react-native");
  return function AccesoDenegadoFalso() {
    return <TextoRN>acceso denegado</TextoRN>;
  };
});

// Se reemplazan las pantallas hoja por dobles livianos: lo que se prueba es que la guarda decida,
// no la logica interna de cada pantalla (eso ya lo cubren sus propios tests).
function mockPantalla(nombre) {
  return function PantallaFalsa() {
    return <Text>{`contenido de ${nombre}`}</Text>;
  };
}
jest.mock("../screens/InicioScreen", () => mockPantalla("inicio"));
jest.mock("../screens/LoginScreen", () => mockPantalla("login"));
jest.mock("../screens/AjustesScreen", () => mockPantalla("ajustes"));
jest.mock("../screens/ComunidadesScreen", () => mockPantalla("comunidades"));
jest.mock("../screens/BusquedaPacienteScreen", () => mockPantalla("busqueda-paciente"));
jest.mock("../screens/FichaPacienteScreen", () => mockPantalla("ficha-paciente"));
jest.mock("../screens/RegistroPacienteScreen", () => mockPantalla("registro-paciente"));
jest.mock("../screens/HistorialPacienteScreen", () => mockPantalla("historial-paciente"));
jest.mock("../screens/ConsultaScreen", () => mockPantalla("consulta"));
jest.mock("../screens/RecetaScreen", () => mockPantalla("receta"));
jest.mock("../screens/EntregaMedicamentosScreen", () => mockPantalla("entrega-medicamentos"));
jest.mock("../screens/PacientesCronicosScreen", () => mockPantalla("pacientes-cronicos"));
jest.mock("../screens/CatalogoCondicionesScreen", () => mockPantalla("catalogo-condiciones"));
jest.mock("../screens/CatalogoDiagnosticosScreen", () => mockPantalla("catalogo-diagnosticos"));
jest.mock("../screens/SeleccionJornadaScreen", () => mockPantalla("seleccion-jornada"));
jest.mock("../screens/JornadaEnCursoScreen", () => mockPantalla("jornada-en-curso"));
jest.mock("../screens/JornadasAsignadasScreen", () => mockPantalla("jornadas-asignadas"));
jest.mock("../screens/StockScreen", () => mockPantalla("stock"));
jest.mock("../screens/RegistroIngresoScreen", () => mockPantalla("registro-ingreso"));
jest.mock("../screens/ExistenciasInventarioScreen", () => mockPantalla("existencias"));
jest.mock("../screens/InventarioResumenAlertasScreen", () => mockPantalla("resumen-alertas"));
jest.mock("../screens/MisMovimientosScreen", () => mockPantalla("mis-movimientos"));
jest.mock("../screens/DetalleLoteScreen", () => mockPantalla("detalle-lote"));
jest.mock("../screens/PrincipiosActivosScreen", () => mockPantalla("principios-activos"));
jest.mock("../screens/RegistroSalidaScreen", () => mockPantalla("registro-salida"));
jest.mock("../screens/ValidacionMovimientosScreen", () => mockPantalla("validacion-movimientos"));

const ROLES_QUE_REGISTRAN = TODOS_LOS_ROLES.filter(puedeRegistrarMovimiento);
const ROLES_QUE_APRUEBAN = TODOS_LOS_ROLES.filter(puedeAprobarMovimiento);

const PANTALLAS = [
  { routeName: ROUTES.INICIO, navegador: "Inicio", roles: rolesDelModulo("inicio") },
  { routeName: ROUTES.COMUNIDADES, navegador: "Inicio", roles: [ROLES.ADMINISTRADOR] },
  {
    routeName: ROUTES.BUSQUEDA_PACIENTE,
    navegador: "Pacientes",
    roles: rolesDelModulo("pacientes"),
  },
  { routeName: ROUTES.FICHA_PACIENTE, navegador: "Pacientes", roles: rolesDelModulo("pacientes") },
  {
    routeName: ROUTES.REGISTRO_PACIENTE,
    navegador: "Pacientes",
    roles: rolesDelModulo("pacientes"),
  },
  {
    routeName: ROUTES.HISTORIAL_PACIENTE,
    navegador: "Pacientes",
    roles: rolesDelModulo("pacientes"),
  },
  { routeName: ROUTES.CONSULTA, navegador: "Pacientes", roles: rolesDelModulo("pacientes") },
  { routeName: ROUTES.RECETA, navegador: "Pacientes", roles: rolesDelModulo("pacientes") },
  {
    routeName: ROUTES.ENTREGA_MEDICAMENTOS,
    navegador: "Pacientes",
    roles: rolesDelModulo("pacientes"),
  },
  {
    routeName: ROUTES.PACIENTES_CRONICOS,
    navegador: "Pacientes",
    roles: rolesDelModulo("pacientes"),
  },
  {
    routeName: ROUTES.CATALOGO_CONDICIONES,
    navegador: "Pacientes",
    roles: rolesDelModulo("pacientes"),
  },
  {
    routeName: ROUTES.CATALOGO_DIAGNOSTICOS,
    navegador: "Pacientes",
    roles: rolesDelModulo("pacientes"),
  },
  { routeName: ROUTES.SELECCION_JORNADA, navegador: "Jornadas", roles: rolesDelModulo("jornadas") },
  { routeName: ROUTES.JORNADA_EN_CURSO, navegador: "Jornadas", roles: rolesDelModulo("jornadas") },
  {
    routeName: ROUTES.JORNADAS_ASIGNADAS,
    navegador: "Jornadas",
    roles: rolesDelModulo("jornadas"),
  },
  { routeName: ROUTES.STOCK, navegador: "Inventario", roles: rolesDelModulo("inventario") },
  { routeName: ROUTES.REGISTRO_INGRESO, navegador: "Inventario", roles: ROLES_QUE_REGISTRAN },
  {
    routeName: ROUTES.EXISTENCIAS_INVENTARIO,
    navegador: "Inventario",
    roles: rolesDelModulo("inventario"),
  },
  {
    routeName: ROUTES.RESUMEN_ALERTAS_INVENTARIO,
    navegador: "Inventario",
    roles: rolesDelModulo("inventario"),
  },
  { routeName: ROUTES.MIS_MOVIMIENTOS, navegador: "Inventario", roles: ROLES_QUE_REGISTRAN },
  { routeName: ROUTES.DETALLE_LOTE, navegador: "Inventario", roles: rolesDelModulo("inventario") },
  {
    routeName: ROUTES.PRINCIPIOS_ACTIVOS,
    navegador: "Inventario",
    roles: rolesDelModulo("inventario"),
  },
  { routeName: ROUTES.REGISTRO_SALIDA, navegador: "Inventario", roles: ROLES_QUE_REGISTRAN },
  {
    routeName: ROUTES.VALIDACION_MOVIMIENTOS,
    navegador: "Inventario",
    roles: ROLES_QUE_APRUEBAN,
  },
];

const NAVEGADORES = {
  Inicio: InicioNavigator,
  Pacientes: PacientesNavigator,
  Jornadas: JornadasNavigator,
  Inventario: InventarioNavigator,
};

// Las pantallas que algun rol NO puede abrir. Inicio, jornadas e inventario los ven los cinco
// roles, asi que para esas no hay rol denegado que probar (lo que si se prueba, abajo, es que sin
// perfil tampoco entran).
const PANTALLAS_RESTRINGIDAS = PANTALLAS.filter(
  ({ roles }) => roles.length < TODOS_LOS_ROLES.length,
);

function darSesion(rol) {
  sesion.perfil = rol ? { rol } : null;
  sesion.rol = rol ?? null;
}

function renderRuta({ routeName, navegador }) {
  const Navegador = NAVEGADORES[navegador];
  return render(
    <NavigationContainer initialState={{ routes: [{ name: routeName }] }}>
      <Navegador />
    </NavigationContainer>,
  );
}

describe("AppNavigator: la guarda de rol decide en cada pantalla (issue #820)", () => {
  beforeEach(() => {
    darSesion(ROLES.ADMINISTRADOR);
  });

  // 21: Presupuestos se retiro en la #754 y Triaje en la #840 (los signos son un paso de la
  // consulta, no una pantalla aparte).
  it("todas las pantallas de los cuatro stacks estan en la tabla de esta prueba", () => {
    expect(PANTALLAS).toHaveLength(24);
    expect(PANTALLAS_RESTRINGIDAS.length).toBeGreaterThan(0);
  });

  it.each(PANTALLAS_RESTRINGIDAS)(
    "$routeName no deja pasar a un rol que su modulo no incluye",
    ({ routeName, navegador, roles }) => {
      // Buscar un rol que NO tenga permiso, o usar uno inexistente como respaldo
      const rolDenegado = TODOS_LOS_ROLES.find((r) => !roles.includes(r)) ?? "rol-inexistente";
      darSesion(rolDenegado);
      renderRuta({ routeName, navegador });
      expect(screen.getByText("acceso denegado")).toBeTruthy();
    },
  );

  it.each(PANTALLAS)(
    "$routeName deja pasar a un rol permitido, y dibuja la pantalla",
    ({ routeName, navegador, roles }) => {
      darSesion(roles[0]);
      renderRuta({ routeName, navegador });
      expect(screen.queryByText("acceso denegado")).toBeNull();
      // No basta con que no salga el aviso: la guarda tiene que devolver los children. Los dobles
      // de arriba dibujan todos "contenido de <pantalla>".
      expect(screen.getByText(/^contenido de /)).toBeTruthy();
    },
  );

  it.each(PANTALLAS)("$routeName no deja pasar sin perfil", ({ routeName, navegador }) => {
    darSesion(null);
    renderRuta({ routeName, navegador });
    expect(screen.getByText("acceso denegado")).toBeTruthy();
  });

  it.each(PANTALLAS)(
    "$routeName no deja pasar a un rol que no existe en el enum",
    ({ routeName, navegador }) => {
      darSesion("coordinador-inexistente");
      renderRuta({ routeName, navegador });
      expect(screen.getByText("acceso denegado")).toBeTruthy();
    },
  );
});

// Hallazgo de la issue #755: el Root no declaraba initialRouteName y React Navigation arrancaba en
// la primera pantalla registrada, AccesoDenegado. La app movil abria siempre en "acceso denegado".
describe("AppNavigator: el punto de entrada", () => {
  it("sin sesion abre el login, no el acceso denegado", () => {
    darSesion(null);
    render(<AppNavigator haySesion={false} />);
    expect(screen.getByText("contenido de login")).toBeTruthy();
    expect(screen.queryByText("acceso denegado")).toBeNull();
  });

  it("al iniciar sesion pasa del login a Inicio, no al acceso denegado", () => {
    darSesion(null);
    const { rerender } = render(<AppNavigator haySesion={false} />);
    darSesion(ROLES.ADMINISTRADOR);
    rerender(<AppNavigator haySesion />);
    expect(screen.getByText("contenido de inicio")).toBeTruthy();
    expect(screen.queryByText("acceso denegado")).toBeNull();
  });

  // Lo que de verdad pasa al iniciar sesion: la sesion llega antes que el perfil. En ese instante
  // no hay rol, y la guarda tiene que esperar (cargando) en vez de pintar "acceso denegado".
  it("al iniciar sesion, mientras el perfil carga, no pinta acceso denegado", () => {
    darSesion(null);
    const { rerender } = render(<AppNavigator haySesion={false} />);

    sesion.cargando = true;
    rerender(<AppNavigator haySesion />);
    expect(screen.queryByText("acceso denegado")).toBeNull();
    sesion.cargando = false;
  });

  it("con sesion abre las pestanas en Inicio, no el acceso denegado", () => {
    darSesion(ROLES.ADMINISTRADOR);
    render(<AppNavigator haySesion />);
    expect(screen.getByText("contenido de inicio")).toBeTruthy();
    expect(screen.queryByText("acceso denegado")).toBeNull();
  });
});
