import { View, Text, StyleSheet, Pressable } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors, spacing, typography } from "@ecopac/ui-tokens";
import {
  etiquetaDeRol,
  tabsMoviles,
  MODULOS,
  puedeRegistrarMovimiento,
  rolesDelModulo,
  ROLES,
  TODOS_LOS_ROLES,
} from "@ecopac/shared";

import { useSesionCompartida } from "../contexto/SesionProvider";
import RutaProtegida from "../components/RutaProtegida";
import IconoDeModulo from "../components/IconoDeModulo";
import { ROUTES } from "./rutas";

// IMPORTACIÓN DE PANTALLAS
import LoginScreen from "../screens/LoginScreen";
import RestablecerContrasenaScreen from "../screens/RestablecerContrasenaScreen";
import InicioScreen from "../screens/InicioScreen";
import AjustesScreen from "../screens/AjustesScreen";
import SeleccionJornadaScreen from "../screens/SeleccionJornadaScreen";
import JornadaEnCursoScreen from "../screens/JornadaEnCursoScreen";
import JornadasAsignadasScreen from "../screens/JornadasAsignadasScreen";
import BusquedaPacienteScreen from "../screens/BusquedaPacienteScreen";
import FichaPacienteScreen from "../screens/FichaPacienteScreen";
import HistorialPacienteScreen from "../screens/HistorialPacienteScreen";
import RegistroPacienteScreen from "../screens/RegistroPacienteScreen";
import TriajeScreen from "../screens/TriajeScreen";
import ConsultaScreen from "../screens/ConsultaScreen";
import RecetaScreen from "../screens/RecetaScreen";
import StockScreen from "../screens/StockScreen";
import RegistroIngresoScreen from "../screens/RegistroIngresoScreen";
import ExistenciasInventarioScreen from "../screens/ExistenciasInventarioScreen";
import InventarioResumenAlertasScreen from "../screens/InventarioResumenAlertasScreen";
import MisMovimientosScreen from "../screens/MisMovimientosScreen";
import DetalleLoteScreen from "../screens/DetalleLoteScreen";
import DonacionesScreen from "../screens/DonacionesScreen";
import ProyectosScreen from "../screens/ProyectosScreen";
import PresupuestosScreen from "../screens/PresupuestosScreen";
import ColaboradoresScreen from "../screens/ColaboradoresScreen";
import FichaColaboradorScreen from "../screens/FichaColaboradorScreen";
import ComunidadesScreen from "../screens/ComunidadesScreen";

// Los cinco navegadores y los dos envoltorios se exportan para que guardaDeRol.test.js pueda
// recorrer el arbol de navegacion tal como se declara aqui, y ver fallar las dos guardas.
export {
  ROUTES,
  InicioNavigator,
  PacientesNavigator,
  JornadasNavigator,
  InventarioNavigator,
  TabsNavigator,
  conGuardaDeRol,
  conGuardaDeRoles,
};

const Root = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();
const InicioStack = createNativeStackNavigator();
const PacientesStack = createNativeStackNavigator();
const JornadasStack = createNativeStackNavigator();
const InventarioStack = createNativeStackNavigator();

// Componente para la barra del header personalizado
function CustomHeaderTitle({ title }) {
  const { perfil } = useSesionCompartida();

  return (
    <View style={styles.headerContainer}>
      <Text style={styles.headerTitleText}>{title}</Text>
      <View style={styles.userContainer}>
        <Text style={styles.nombreText} numberOfLines={1}>
          {perfil?.nombre || ""}
        </Text>
        <Text style={styles.rolText} numberOfLines={1}>
          {perfil?.rol ? etiquetaDeRol(perfil.rol) : ""}
        </Text>
      </View>
    </View>
  );
}

const opcionesStack = (title) => ({
  headerStyle: { backgroundColor: colors?.surface || colors.surface },
  headerTitle: () => <CustomHeaderTitle title={title} />,
  headerTitleContainerStyle: {
    width: "100%",
    left: 0,
  },
});

// El unico stack sin guarda de rol, y a proposito: todavia no hay sesion de la que sacar un rol.
// Lo monta AppNavigator solo cuando haySesion es false.
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name={ROUTES.LOGIN} component={LoginScreen} />
      <AuthStack.Screen
        name={ROUTES.RESTABLECER_CONTRASENA}
        component={RestablecerContrasenaScreen}
      />
    </AuthStack.Navigator>
  );
}

// React Navigation solo entrega {navigation, route} a `component`, no children: se envuelve la
// pantalla real en RutaProtegida en vez de usarla como route element (patron de apps/web).
//
// Los roles salen de rolesDelModulo() de @ecopac/shared (issue #820). Hasta ahora este archivo
// tenia su propia copia de esa funcion, que buscaba solo por `m.id` mientras la de shared acepta
// tambien `m.modulo`: la misma decision de permisos escrita dos veces dentro de una app, que es lo
// que prohibe AGENTS.md, y con una regla de busqueda distinta en cada sitio.
function conGuardaDeRol(Componente, moduloId) {
  const rolesPermitidos = rolesDelModulo(moduloId);

  // Un id que no esta en MODULOS revienta aqui, al cargar el archivo: conGuardaDeRol() se evalua
  // al construir las tablas de pantallas, asi que un error de escritura no llega a produccion ni
  // espera a que alguien navegue. Antes degradaba a una lista vacia y -con el guard anterior, que
  // fallaba abierto- abria la pantalla a los cinco roles sin decir nada.
  if (rolesPermitidos.length === 0) {
    throw new Error(
      `conGuardaDeRol: el modulo "${moduloId}" no existe en MODULOS (packages/shared/navegacion.js). ` +
        `Los ids validos son: ${MODULOS.map((m) => m.id).join(", ")}.`,
    );
  }

  return marcarComoGuarda(Componente, rolesPermitidos, `conGuardaDeRol(${moduloId})`);
}

// Variante de conGuardaDeRol() para una pantalla que no tiene entrada propia en MODULOS -como
// Comunidades (issue #756), que es de administracion y no uno de los nueve modulos del sistema, o
// las dos de movimientos, cuyo permiso es mas estrecho que el del modulo inventario- y por eso
// recibe los roles permitidos directo, no un moduloId para resolver contra ella.
function conGuardaDeRoles(Componente, rolesPermitidos) {
  if (!Array.isArray(rolesPermitidos) || rolesPermitidos.length === 0) {
    throw new Error(
      "conGuardaDeRoles: la lista de roles no puede ir vacia. Una lista vacia deniega a todo el " +
        "mundo (RutaProtegida.js), asi que la pantalla quedaria inalcanzable en silencio.",
    );
  }

  return marcarComoGuarda(Componente, rolesPermitidos, `conGuardaDeRoles(${Componente.name})`);
}

// Envuelve la pantalla y deja a la vista con que roles quedo envuelta. Las dos marcas son lo que
// lee guardaDeRol.test.js para recorrer el arbol de navegacion y afirmar que NINGUNA pantalla se
// registro a secas: sin ellas, la prueba tendria que confiar en una tabla paralela, que es
// exactamente lo que se deja de lado desde la #820.
function marcarComoGuarda(Componente, rolesPermitidos, nombre) {
  function PantallaConGuarda(props) {
    return (
      <RutaProtegida rolesPermitidos={rolesPermitidos}>
        <Componente {...props} />
      </RutaProtegida>
    );
  }

  PantallaConGuarda.displayName = nombre;
  PantallaConGuarda.esGuardaDeRol = true;
  PantallaConGuarda.rolesPermitidos = rolesPermitidos;

  return PantallaConGuarda;
}

// Registrar y corregir movimientos es mas estrecho que ver el modulo: inventario lo ven los cinco
// roles, pero puedeRegistrarMovimiento() -espejo de la politica de INSERT de la 00034- deja fuera a
// junta directiva y socio fundador. Sin esto, los dos roles consultivos llegaban a "Registrar
// ingreso" y a "Mis movimientos" para encontrarse la pantalla vaciada por dentro (el propio
// useMisMovimientos devuelve puedeVer: false). Los roles se derivan de la funcion de permisos, no
// se escriben a mano.
const ROLES_QUE_REGISTRAN_MOVIMIENTOS = TODOS_LOS_ROLES.filter(puedeRegistrarMovimiento);

// Las pantallas de cada stack, declaradas UNA VEZ a nivel de modulo (issue #820).
//
// No es solo orden: conGuardaDeRol() devuelve un componente nuevo en cada llamada, y hasta ahora se
// llamaba dentro del cuerpo del navegador. Cada re-render producia una identidad distinta y React
// Navigation remontaba la pantalla -InventarioNavigator re-renderiza cada vez que cambia la sesion-.
// Aqui se construyen una sola vez, al cargar el archivo.
//
// `opciones(contexto)` es para lo que no es opcionesStack(titulo) a secas; hoy solo Stock.
const PANTALLAS_INICIO = [
  { name: ROUTES.INICIO, componente: conGuardaDeRol(InicioScreen, "inicio"), titulo: "Inicio" },
  {
    name: ROUTES.DONACIONES,
    componente: conGuardaDeRol(DonacionesScreen, "donaciones"),
    titulo: "Donaciones",
  },
  {
    name: ROUTES.PROYECTOS,
    componente: conGuardaDeRol(ProyectosScreen, "proyectos"),
    titulo: "Proyectos",
  },
  {
    name: ROUTES.PRESUPUESTOS,
    componente: conGuardaDeRol(PresupuestosScreen, "presupuestos"),
    titulo: "Presupuestos",
  },
  {
    name: ROUTES.COLABORADORES,
    componente: conGuardaDeRol(ColaboradoresScreen, "colaboradores"),
    titulo: "Colaboradores",
  },
  {
    name: ROUTES.FICHA_COLABORADOR,
    componente: conGuardaDeRol(FichaColaboradorScreen, "colaboradores"),
    titulo: "Ficha del personal",
  },
  {
    name: ROUTES.COMUNIDADES,
    componente: conGuardaDeRoles(ComunidadesScreen, [ROLES.ADMINISTRADOR]),
    titulo: "Comunidades",
  },
];

const PANTALLAS_PACIENTES = [
  {
    name: ROUTES.BUSQUEDA_PACIENTE,
    componente: conGuardaDeRol(BusquedaPacienteScreen, "pacientes"),
    titulo: "Pacientes",
  },
  {
    name: ROUTES.FICHA_PACIENTE,
    componente: conGuardaDeRol(FichaPacienteScreen, "pacientes"),
    titulo: "Ficha del paciente",
  },
  {
    name: ROUTES.REGISTRO_PACIENTE,
    componente: conGuardaDeRol(RegistroPacienteScreen, "pacientes"),
    titulo: "Registro de paciente",
  },
  {
    name: ROUTES.HISTORIAL_PACIENTE,
    componente: conGuardaDeRol(HistorialPacienteScreen, "pacientes"),
    titulo: "Historial",
  },
  { name: ROUTES.TRIAJE, componente: conGuardaDeRol(TriajeScreen, "pacientes"), titulo: "Triaje" },
  {
    name: ROUTES.CONSULTA,
    componente: conGuardaDeRol(ConsultaScreen, "pacientes"),
    titulo: "Consulta",
  },
  { name: ROUTES.RECETA, componente: conGuardaDeRol(RecetaScreen, "pacientes"), titulo: "Receta" },
];

const PANTALLAS_JORNADAS = [
  {
    name: ROUTES.SELECCION_JORNADA,
    componente: conGuardaDeRol(SeleccionJornadaScreen, "jornadas"),
    titulo: "Jornadas",
  },
  {
    name: ROUTES.JORNADA_EN_CURSO,
    componente: conGuardaDeRol(JornadaEnCursoScreen, "jornadas"),
    titulo: "Jornada en curso",
  },
  {
    name: ROUTES.JORNADAS_ASIGNADAS,
    componente: conGuardaDeRol(JornadasAsignadasScreen, "jornadas"),
    titulo: "Mis jornadas",
  },
];

// Punto de entrada al registro rapido de ingreso (issue #165). Se agrega aqui, en las opciones de
// la pantalla que cuelga del tab Inventario, y no dentro de CatalogoMedicamentosScreen.js.
//
// El boton se sigue dibujando solo para quien puede registrar, y eso NO es la guarda: la barrera es
// conGuardaDeRoles() sobre la pantalla de destino. Esto es la afordancia -ofrecer un boton que
// aterriza en "Acceso denegado" seria peor que no ofrecerlo-.
const opcionesDeStock =
  ({ puedeRegistrarIngreso }) =>
  ({ navigation }) => ({
    ...opcionesStack("Inventario"),
    headerRight: puedeRegistrarIngreso
      ? () => (
          <Pressable
            onPress={() => navigation.navigate(ROUTES.REGISTRO_INGRESO)}
            style={styles.botonHeaderIngreso}
            accessibilityRole="button"
          >
            <Text style={styles.textoBotonHeaderIngreso}>+ Ingreso</Text>
          </Pressable>
        )
      : undefined,
  });

const PANTALLAS_INVENTARIO = [
  {
    name: ROUTES.STOCK,
    componente: conGuardaDeRol(StockScreen, "inventario"),
    titulo: "Inventario",
    opciones: opcionesDeStock,
  },
  {
    name: ROUTES.REGISTRO_INGRESO,
    componente: conGuardaDeRoles(RegistroIngresoScreen, ROLES_QUE_REGISTRAN_MOVIMIENTOS),
    titulo: "Registrar ingreso",
  },
  {
    name: ROUTES.EXISTENCIAS_INVENTARIO,
    componente: conGuardaDeRol(ExistenciasInventarioScreen, "inventario"),
    titulo: "Existencias",
  },
  {
    name: ROUTES.RESUMEN_ALERTAS_INVENTARIO,
    componente: conGuardaDeRol(InventarioResumenAlertasScreen, "inventario"),
    titulo: "Resumen y alertas",
  },
  {
    name: ROUTES.MIS_MOVIMIENTOS,
    componente: conGuardaDeRoles(MisMovimientosScreen, ROLES_QUE_REGISTRAN_MOVIMIENTOS),
    titulo: "Mis movimientos",
  },
  {
    name: ROUTES.DETALLE_LOTE,
    componente: conGuardaDeRol(DetalleLoteScreen, "inventario"),
    titulo: "Detalle del lote",
  },
];

/** Dibuja las Screen de un stack a partir de su tabla. */
function pantallasDe(Stack, pantallas, contexto = {}) {
  return pantallas.map(({ name, componente, titulo, opciones }) => (
    <Stack.Screen
      key={name}
      name={name}
      component={componente}
      options={opciones ? opciones(contexto) : opcionesStack(titulo)}
    />
  ));
}

function InicioNavigator() {
  return (
    <InicioStack.Navigator>{pantallasDe(InicioStack, PANTALLAS_INICIO)}</InicioStack.Navigator>
  );
}

function PacientesNavigator() {
  return (
    <PacientesStack.Navigator>
      {pantallasDe(PacientesStack, PANTALLAS_PACIENTES)}
    </PacientesStack.Navigator>
  );
}

function JornadasNavigator() {
  return (
    <JornadasStack.Navigator>
      {pantallasDe(JornadasStack, PANTALLAS_JORNADAS)}
    </JornadasStack.Navigator>
  );
}

function InventarioNavigator() {
  const { rol } = useSesionCompartida();

  return (
    <InventarioStack.Navigator>
      {pantallasDe(InventarioStack, PANTALLAS_INVENTARIO, {
        puedeRegistrarIngreso: puedeRegistrarMovimiento(rol),
      })}
    </InventarioStack.Navigator>
  );
}

const CONFIGURACION_TABS = {
  Inicio: {
    routeName: ROUTES.TAB_INICIO,
    component: InicioNavigator,
    label: "Inicio",
    icono: "Home",
  },
  Pacientes: {
    routeName: ROUTES.TAB_PACIENTES,
    component: PacientesNavigator,
    label: "Pacientes",
    icono: "Users",
  },
  Jornadas: {
    routeName: ROUTES.TAB_JORNADAS,
    component: JornadasNavigator,
    label: "Jornadas",
    icono: "Calendar",
  },
  Inventario: {
    routeName: ROUTES.TAB_INVENTARIO,
    component: InventarioNavigator,
    label: "Inventario",
    icono: "Package",
  },
};

// Ajustes es la unica pantalla hoja que cuelga directamente de una tab: las otras cuatro tabs son
// navegadores, y quien guarda ahi es cada Screen de su stack. La ve cualquier sesion con un rol del
// enum -es donde se cierra sesion-, y eso se escribe con TODOS_LOS_ROLES en vez de dejarla suelta.
const TAB_AJUSTES_CONFIG = {
  routeName: ROUTES.TAB_AJUSTES,
  component: conGuardaDeRoles(AjustesScreen, TODOS_LOS_ROLES),
  label: "Ajustes",
  icono: "Settings",
};

function TabsNavigator() {
  const { perfil } = useSesionCompartida();
  const modulosPermitidos = tabsMoviles(perfil?.rol) || [];

  // Sin fallback a Object.values(CONFIGURACION_TABS) (issue #820): cuando tabsMoviles() devolvia
  // vacio -un perfil sin rol, o un rol que no esta en el enum- se dibujaban las cinco pestanias,
  // que es el mismo fallo abierto que tenia el guard, en la barra de navegacion. Sin el, quedan
  // las dos que anaden los `if` de abajo: Inicio y Ajustes.
  const tabsList = modulosPermitidos.map((m) => CONFIGURACION_TABS[m.tabMovil]).filter(Boolean);

  if (!tabsList.some((tab) => tab?.routeName === ROUTES.TAB_INICIO)) {
    tabsList.unshift(CONFIGURACION_TABS.Inicio);
  }
  if (!tabsList.some((tab) => tab?.routeName === ROUTES.TAB_AJUSTES)) {
    tabsList.push(TAB_AJUSTES_CONFIG);
  }

  // Deduplicar rutas por routeName para prevenir keys duplicadas en React Navigation
  const tabsAAgregar = Array.from(new Map(tabsList.map((item) => [item.routeName, item])).values());

  return (
    <Tabs.Navigator
      initialRouteName={ROUTES.TAB_INICIO}
      screenOptions={({ route }) => {
        const configTab =
          Object.values(CONFIGURACION_TABS).find((c) => c.routeName === route.name) ||
          TAB_AJUSTES_CONFIG;

        return {
          headerShown: false,
          tabBarActiveTintColor: colors?.primary || colors.primary,
          tabBarInactiveTintColor: colors?.textMuted || colors.textMuted,
          tabBarStyle: { backgroundColor: colors?.surface || colors.surface },
          tabBarLabelStyle: { fontSize: 10 },
          // El icono sale del vocabulario que declara packages/shared/navegacion.js, traducido
          // por IconoDeModulo (issue #700). Antes eran cinco glifos escritos a mano, dos de ellos
          // emoji y uno un ideograma Lineal B que Android no sabia dibujar.
          tabBarIcon: ({ color, size }) => (
            <IconoDeModulo nombre={configTab.icono} color={color} size={size} />
          ),
        };
      }}
    >
      {tabsAAgregar.map((tab) => (
        <Tabs.Screen
          key={tab.routeName}
          name={tab.routeName}
          component={tab.component}
          options={{ tabBarLabel: tab.label }}
        />
      ))}
    </Tabs.Navigator>
  );
}

export default function AppNavigator({ haySesion }) {
  return (
    <NavigationContainer>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {haySesion ? (
          <Root.Screen name={ROUTES.TABS} component={TabsNavigator} />
        ) : (
          <Root.Screen name={ROUTES.AUTH} component={AuthNavigator} />
        )}
      </Root.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingRight: 16,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.text,
  },
  userContainer: {
    alignItems: "flex-end",
  },
  nombreText: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.text,
  },
  rolText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  botonHeaderIngreso: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  textoBotonHeaderIngreso: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors?.primary || colors.primary,
  },
});
