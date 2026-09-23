// Ninguna pantalla se registra sin guarda de rol (issue #820).
//
// POR QUE ESTA PRUEBA EXISTE. La #427 construyo RutaProtegida y la #692 la conecto, pero al llegar
// la #820 solo seis de las veintitres pantallas de los cuatro stacks iban envueltas: las otras
// diecisiete se registraban con `component={Pantalla}` a secas. tabsMoviles(rol) filtra la barra de
// pestanias, asi que nadie lo veia; lo que no filtraba nada era navigation.navigate(NOMBRE).
//
// Que quede a medias otra vez no se evita con una revision mas atenta: se evita con esto. La prueba
// no lee una tabla que el codigo tambien use -eso volveria a permitir que el JSX y la tabla
// discrepen-, sino el arbol de navegacion tal como AppNavigator lo declara, y afirma tres cosas:
//
//   1. Toda Screen registrada lleva un componente marcado por conGuardaDeRol/conGuardaDeRoles.
//   2. Los roles con que quedo envuelta son los que le tocan a su modulo.
//   3. El conjunto de rutas registradas es exactamente el esperado, asi que una Screen nueva falla
//      aqui hasta que alguien decida con que roles va.
//
// La guarda del cliente NO es el control de acceso real: quien protege es RLS (capa 4 de
// docs/PERMISOS.md). Lo que se comprueba aqui es que la pantalla correcta se dibuje.

import {
  puedeAprobarMovimiento,
  puedeRegistrarMovimiento,
  ROLES,
  rolesDelModulo,
  TODOS_LOS_ROLES,
} from "@ecopac/shared";

import {
  conGuardaDeRol,
  conGuardaDeRoles,
  InicioNavigator,
  InventarioNavigator,
  JornadasNavigator,
  PacientesNavigator,
  PANTALLAS_DEL_ROOT,
  TabsNavigator,
} from "./AppNavigator";
import { ROUTES } from "./rutas";

// El valor inicial debe ser un literal puro: jest.mock() no permite que su factory referencie una
// variable externa cuya inicializacion dependa de otro import (babel-plugin-jest-hoist).
const sesion = { perfil: { rol: "administrador" }, rol: "administrador" };

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => sesion,
}));

const ROLES_QUE_REGISTRAN = TODOS_LOS_ROLES.filter(puedeRegistrarMovimiento);
const ROLES_QUE_APRUEBAN = TODOS_LOS_ROLES.filter(puedeAprobarMovimiento);

// Lo que se espera de cada ruta, escrito aqui a proposito y no importado de AppNavigator: si los
// dos leyeran la misma constante, cambiar el modulo de una pantalla no rompería nada.
const ROLES_ESPERADOS = {
  [ROUTES.INICIO]: rolesDelModulo("inicio"),
  [ROUTES.COMUNIDADES]: [ROLES.ADMINISTRADOR],

  [ROUTES.BUSQUEDA_PACIENTE]: rolesDelModulo("pacientes"),
  [ROUTES.FICHA_PACIENTE]: rolesDelModulo("pacientes"),
  [ROUTES.KANBAN_JORNADAS]: rolesDelModulo("jornadas"),
  [ROUTES.REGISTRO_PACIENTE]: rolesDelModulo("pacientes"),
  [ROUTES.HISTORIAL_PACIENTE]: rolesDelModulo("pacientes"),
  [ROUTES.CONSULTA]: rolesDelModulo("pacientes"),
  [ROUTES.RECETA]: rolesDelModulo("pacientes"),
  [ROUTES.ENTREGA_MEDICAMENTOS]: rolesDelModulo("pacientes"),
  [ROUTES.PACIENTES_CRONICOS]: rolesDelModulo("pacientes"),
  [ROUTES.CATALOGO_CONDICIONES]: rolesDelModulo("pacientes"),
  [ROUTES.CATALOGO_DIAGNOSTICOS]: rolesDelModulo("pacientes"),

  [ROUTES.SELECCION_JORNADA]: rolesDelModulo("jornadas"),
  [ROUTES.JORNADA_EN_CURSO]: rolesDelModulo("jornadas"),
  [ROUTES.JORNADAS_ASIGNADAS]: rolesDelModulo("jornadas"),

  [ROUTES.STOCK]: rolesDelModulo("inventario"),
  [ROUTES.EXISTENCIAS_INVENTARIO]: rolesDelModulo("inventario"),
  [ROUTES.RESUMEN_ALERTAS_INVENTARIO]: rolesDelModulo("inventario"),
  [ROUTES.DETALLE_LOTE]: rolesDelModulo("inventario"),
  [ROUTES.PRINCIPIOS_ACTIVOS]: rolesDelModulo("inventario"),
  // Mas estrecho que su modulo: los dos roles consultivos ven inventario pero no registran
  // movimientos (espejo de la politica de INSERT de la 00034).
  [ROUTES.REGISTRO_INGRESO]: ROLES_QUE_REGISTRAN,
  [ROUTES.MIS_MOVIMIENTOS]: ROLES_QUE_REGISTRAN,
  [ROUTES.REGISTRO_SALIDA]: ROLES_QUE_REGISTRAN,
  // Mas estrecho todavia: aprobar es exclusivo de administracion (espejo de aprobarMovimiento(),
  // validacion.api.js, y de la politica de UPDATE de la 00048).
  [ROUTES.VALIDACION_MOVIMIENTOS]: ROLES_QUE_APRUEBAN,
};

// Las dos pantallas del stack de autenticacion no llevan guarda a proposito: se montan cuando no
// hay sesion, asi que no hay rol del que decidir nada.
const RUTAS_SIN_GUARDA = [ROUTES.LOGIN, ROUTES.RESTABLECER_CONTRASENA];

/** Recorre un elemento de React y devuelve cada {name, componente} que encuentre registrado. */
function pantallasRegistradas(elemento, encontradas = []) {
  if (Array.isArray(elemento)) {
    elemento.forEach((hijo) => pantallasRegistradas(hijo, encontradas));
    return encontradas;
  }
  if (!elemento || typeof elemento !== "object") return encontradas;

  const props = elemento.props || {};
  if (typeof props.name === "string" && props.component) {
    encontradas.push({ name: props.name, componente: props.component });
  }
  if (props.children) pantallasRegistradas(props.children, encontradas);

  return encontradas;
}

const STACKS = {
  Inicio: InicioNavigator,
  Pacientes: PacientesNavigator,
  Jornadas: JornadasNavigator,
  Inventario: InventarioNavigator,
};

function pantallasDeLosStacks() {
  return Object.values(STACKS).flatMap((Navegador) => pantallasRegistradas(Navegador()));
}

describe("guarda de rol en el arbol de navegacion (issue #820)", () => {
  it("ninguna pantalla de los cuatro stacks se registra sin guarda", () => {
    const sinGuarda = pantallasDeLosStacks()
      .filter(({ componente }) => componente.esGuardaDeRol !== true)
      .map(({ name }) => name);

    expect(sinGuarda).toEqual([]);
  });

  it("cada pantalla queda envuelta con los roles de su modulo", () => {
    for (const { name, componente } of pantallasDeLosStacks()) {
      expect(ROLES_ESPERADOS[name]).toBeDefined();
      expect([...componente.rolesPermitidos].sort()).toEqual([...ROLES_ESPERADOS[name]].sort());
    }
  });

  it("los cuatro stacks registran exactamente las rutas esperadas, sin repetir ninguna", () => {
    const registradas = pantallasDeLosStacks().map(({ name }) => name);

    expect(registradas.length).toBe(new Set(registradas).size);
    expect(registradas.sort()).toEqual(Object.keys(ROLES_ESPERADOS).sort());
  });

  it("toda ruta de ROUTES que sea una pantalla esta registrada en algun stack", () => {
    // ROUTES declara ademas los contenedores (Auth, Tabs) y los cinco nombres de tab, que no son
    // pantallas. Todo lo demas tiene que estar registrado: un nombre de ruta que nadie registra es
    // un navigate() que no llega a ningun sitio.
    const contenedores = [
      ROUTES.AUTH,
      ROUTES.TABS,
      ROUTES.TAB_INICIO,
      ROUTES.TAB_PACIENTES,
      ROUTES.TAB_JORNADAS,
      ROUTES.TAB_INVENTARIO,
      ROUTES.TAB_AJUSTES,
      ...RUTAS_SIN_GUARDA,
      ROUTES.ACCESO_DENEGADO,
    ];
    const pantallas = Object.values(ROUTES).filter((ruta) => !contenedores.includes(ruta));
    const registradas = [
      ...pantallasDeLosStacks().map(({ name }) => name),
      ...PANTALLAS_DEL_ROOT.map(({ name }) => name),
    ];

    expect(registradas.sort()).toEqual(pantallas.sort());
  });

  // Issue #755: la ventana de notificaciones vive en el Root, encima de las pestanas, y se abre
  // desde la campana de cualquier cabecera. Lleva guarda igual que las de los stacks; la abre
  // cualquier rol, porque a quien le llega que lo decide la base.
  it("las pantallas del Root tambien van con guarda", () => {
    expect(PANTALLAS_DEL_ROOT.map(({ name }) => name)).toEqual([ROUTES.NOTIFICACIONES]);
    for (const { componente } of PANTALLAS_DEL_ROOT) {
      expect(componente.esGuardaDeRol).toBe(true);
      expect([...componente.rolesPermitidos].sort()).toEqual([...TODOS_LOS_ROLES].sort());
    }
  });

  it("Ajustes, la unica hoja que cuelga de una tab, tambien va con guarda", () => {
    const navegadores = Object.values(STACKS);
    const hojas = pantallasRegistradas(TabsNavigator()).filter(
      ({ componente }) => !navegadores.includes(componente),
    );

    expect(hojas.map(({ name }) => name)).toEqual([ROUTES.TAB_AJUSTES]);
    expect(hojas[0].componente.esGuardaDeRol).toBe(true);
    expect([...hojas[0].componente.rolesPermitidos].sort()).toEqual([...TODOS_LOS_ROLES].sort());
  });

  it("las cuatro tabs restantes son los navegadores, que guardan pantalla por pantalla", () => {
    const tabs = pantallasRegistradas(TabsNavigator()).filter(
      ({ name }) => name !== ROUTES.TAB_AJUSTES,
    );

    // Sin orden: el de la barra lo decide tabsMoviles() segun MODULOS, y no es lo que se afirma
    // aqui (eso ya lo cubre navegacionPorRol.test.js).
    expect(new Set(tabs.map(({ componente }) => componente))).toEqual(
      new Set(Object.values(STACKS)),
    );
  });
});

// Las dos guardas del envoltorio, vistas fallar: una guarda que no se ha visto fallar no se sabe si
// comprueba algo. Las dos lanzan al construir la tabla de pantallas, es decir al importar el
// archivo, no cuando alguien navega.
describe("conGuardaDeRol y conGuardaDeRoles revientan en vez de degradar", () => {
  function PantallaFalsa() {
    return null;
  }

  it("un moduloId que no existe en MODULOS lanza, y el mensaje dice cuales valen", () => {
    expect(() => conGuardaDeRol(PantallaFalsa, "inventarios")).toThrow(/no existe en MODULOS/);
    expect(() => conGuardaDeRol(PantallaFalsa, "inventarios")).toThrow(/inventario/);
  });

  it("una lista de roles vacia lanza: dejaria la pantalla inalcanzable en silencio", () => {
    expect(() => conGuardaDeRoles(PantallaFalsa, [])).toThrow(/no puede ir vacia/);
  });

  it("un modulo real devuelve la pantalla envuelta y marcada", () => {
    const envuelta = conGuardaDeRol(PantallaFalsa, "pacientes");

    expect(envuelta.esGuardaDeRol).toBe(true);
    expect(envuelta.rolesPermitidos).toEqual(rolesDelModulo("pacientes"));
  });
});
