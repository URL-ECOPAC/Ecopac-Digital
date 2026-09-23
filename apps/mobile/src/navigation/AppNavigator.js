import { View, Text, StyleSheet, Pressable } from "react-native";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors, spacing, typography } from "@ecopac/ui-tokens";
import {
  etiquetaDeRol,
  tabsMoviles,
  MODULOS,
  puedeAprobarMovimiento,
  puedeRegistrarMovimiento,
  rolesDelModulo,
  ROLES,
  TODOS_LOS_ROLES,
  useContadorNotificaciones,
} from "@ecopac/shared";
import { useCallback } from "react";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ContadorDeNotificacionesProvider } from "../contexto/NotificacionesProvider";
import AvisosDelSistema from "../components/AvisosDelSistema";
import BotonCerrarSesion from "../components/BotonCerrarSesion";
import CampanaNotificaciones from "../components/CampanaNotificaciones";
import RutaProtegida from "../components/RutaProtegida";
import IconoDeModulo from "../components/IconoDeModulo";
import { ROUTES } from "./rutas";

// IMPORTACIÓN DE PANTALLAS —  Ya está bien
import LoginScreen from "../screens/LoginScreen";
import RestablecerContrasenaScreen from "../screens/RestablecerContrasenaScreen";
import InicioScreen from "../screens/InicioScreen";
import AccesoDenegadoScreen from "../screens/AccesoDenegadoScreen"; //  Bien importado
import AjustesScreen from "../screens/AjustesScreen";
import SeleccionJornadaScreen from "../screens/SeleccionJornadaScreen";
import JornadaEnCursoScreen from "../screens/JornadaEnCursoScreen";
import JornadasAsignadasScreen from "../screens/JornadasAsignadasScreen";
import KanbanJornadasScreen from "../screens/KanbanJornadasScreen";
import BusquedaPacienteScreen from "../screens/BusquedaPacienteScreen";
import FichaPacienteScreen from "../screens/FichaPacienteScreen";
import HistorialPacienteScreen from "../screens/HistorialPacienteScreen";
import RegistroPacienteScreen from "../screens/RegistroPacienteScreen";
import ConsultaScreen from "../screens/ConsultaScreen";
import RecetaScreen from "../screens/RecetaScreen";
import StockScreen from "../screens/StockScreen";
import RegistroIngresoScreen from "../screens/RegistroIngresoScreen";
import ExistenciasInventarioScreen from "../screens/ExistenciasInventarioScreen";
import InventarioResumenAlertasScreen from "../screens/InventarioResumenAlertasScreen";
import MisMovimientosScreen from "../screens/MisMovimientosScreen";
import DetalleLoteScreen from "../screens/DetalleLoteScreen";
import PrincipiosActivosScreen from "../screens/PrincipiosActivosScreen";
import RegistroSalidaScreen from "../screens/RegistroSalidaScreen";
import ValidacionMovimientosScreen from "../screens/ValidacionMovimientosScreen";
import EntregaMedicamentosScreen from "../screens/EntregaMedicamentosScreen";
import PacientesCronicosScreen from "../screens/PacientesCronicosScreen";
import CatalogoCondicionesScreen from "../screens/CatalogoCondicionesScreen";
import CatalogoDiagnosticosScreen from "../screens/CatalogoDiagnosticosScreen";
import ComunidadesScreen from "../screens/ComunidadesScreen";
import NotificacionesScreen from "../screens/NotificacionesScreen";

export {
  ROUTES,
  InicioNavigator,
  PacientesNavigator,
  JornadasNavigator,
  InventarioNavigator,
  TabsNavigator,
  PANTALLAS_DEL_ROOT,
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

function CustomHeaderTitle({ title }) {
  const { perfil } = useSesionCompartida();
  return (
    <View style={styles.headerContainer}>
      <Text style={styles.headerTitleText}>{title}</Text>
      <View style={styles.cabeceraDerecha}>
        <View style={styles.userContainer}>
          <Text style={styles.nombreText} numberOfLines={1}>
            {perfil?.nombre || ""}
          </Text>
          <Text style={styles.rolText} numberOfLines={1}>
            {perfil?.rol ? etiquetaDeRol(perfil.rol) : ""}
          </Text>
        </View>
        {/* Notificaciones (issue #755): a la par del nombre y el rol, en todas las pestanas. */}
        <CampanaNotificaciones />
        <BotonCerrarSesion />
      </View>
    </View>
  );
}

const opcionesStack = (title) => ({
  headerStyle: { backgroundColor: colors?.surface || colors.surface },
  headerTitle: () => <CustomHeaderTitle title={title} />,
  headerTitleContainerStyle: { width: "100%", left: 0 },
});

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

function conGuardaDeRol(Componente, moduloId) {
  const rolesPermitidos = rolesDelModulo(moduloId);
  if (rolesPermitidos.length === 0) {
    throw new Error(
      `conGuardaDeRol: el modulo "${moduloId}" no existe en MODULOS. ` +
        `Los ids validos son: ${MODULOS.map((m) => m.id).join(", ")}.`,
    );
  }
  return marcarComoGuarda(Componente, rolesPermitidos, `conGuardaDeRol(${moduloId})`);
}

function conGuardaDeRoles(Componente, rolesPermitidos) {
  if (!Array.isArray(rolesPermitidos) || rolesPermitidos.length === 0) {
    throw new Error("conGuardaDeRoles: la lista de roles no puede ir vacia.");
  }
  return marcarComoGuarda(Componente, rolesPermitidos, `conGuardaDeRoles(${Componente.name})`);
}

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

const ROLES_QUE_REGISTRAN_MOVIMIENTOS = TODOS_LOS_ROLES.filter(puedeRegistrarMovimiento);
const ROLES_QUE_APRUEBAN_MOVIMIENTOS = TODOS_LOS_ROLES.filter(puedeAprobarMovimiento);

// ==================================================
// PANTALLAS
// ==================================================
const PANTALLAS_INICIO = [
  { name: ROUTES.INICIO, componente: conGuardaDeRol(InicioScreen, "inicio"), titulo: "Inicio" },
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
  {
    name: ROUTES.CONSULTA,
    componente: conGuardaDeRol(ConsultaScreen, "pacientes"),
    titulo: "Consulta",
  },
  { name: ROUTES.RECETA, componente: conGuardaDeRol(RecetaScreen, "pacientes"), titulo: "Receta" },
  {
    name: ROUTES.ENTREGA_MEDICAMENTOS,
    componente: conGuardaDeRol(EntregaMedicamentosScreen, "pacientes"),
    titulo: "Entrega de medicamentos",
  },
  {
    name: ROUTES.PACIENTES_CRONICOS,
    componente: conGuardaDeRol(PacientesCronicosScreen, "pacientes"),
    titulo: "Pacientes cronicos",
  },
  {
    name: ROUTES.CATALOGO_CONDICIONES,
    componente: conGuardaDeRol(CatalogoCondicionesScreen, "pacientes"),
    titulo: "Condiciones cronicas",
  },
  {
    name: ROUTES.CATALOGO_DIAGNOSTICOS,
    componente: conGuardaDeRol(CatalogoDiagnosticosScreen, "pacientes"),
    titulo: "Diagnosticos",
  },
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
  {
    name: ROUTES.KANBAN_JORNADAS,
    componente: conGuardaDeRol(KanbanJornadasScreen, "jornadas"),
    titulo: "Tablero de Jornadas",
  },
];

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
  {
    name: ROUTES.PRINCIPIOS_ACTIVOS,
    componente: conGuardaDeRol(PrincipiosActivosScreen, "inventario"),
    titulo: "Principios activos",
  },
  {
    name: ROUTES.REGISTRO_SALIDA,
    componente: conGuardaDeRoles(RegistroSalidaScreen, ROLES_QUE_REGISTRAN_MOVIMIENTOS),
    titulo: "Registrar salida",
  },
  {
    name: ROUTES.VALIDACION_MOVIMIENTOS,
    componente: conGuardaDeRoles(ValidacionMovimientosScreen, ROLES_QUE_APRUEBAN_MOVIMIENTOS),
    titulo: "Por aprobar",
  },
];

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

const TAB_AJUSTES_CONFIG = {
  routeName: ROUTES.TAB_AJUSTES,
  component: conGuardaDeRoles(AjustesScreen, TODOS_LOS_ROLES),
  label: "Ajustes",
  icono: "Settings",
};

function TabsNavigator() {
  const { perfil } = useSesionCompartida();
  const modulosPermitidos = tabsMoviles(perfil?.rol) || [];
  const tabsList = modulosPermitidos.map((m) => CONFIGURACION_TABS[m.tabMovil]).filter(Boolean);
  if (!tabsList.some((tab) => tab?.routeName === ROUTES.TAB_INICIO))
    tabsList.unshift(CONFIGURACION_TABS.Inicio);
  if (!tabsList.some((tab) => tab?.routeName === ROUTES.TAB_AJUSTES))
    tabsList.push(TAB_AJUSTES_CONFIG);
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

// Las pestanas con lo que comparten todas sus cabeceras (issue #755): el contador de no leidas,
// contado una sola vez aqui y repartido por contexto a cada CampanaNotificaciones, y los avisos
// del sistema del telefono cuando ese numero sube. Va aparte de TabsNavigator porque
// guardaDeRol.test.js recorre el arbol llamando a TabsNavigator() como funcion, y un hook aqui
// dentro reventaria fuera de un render.
function TabsConContador({ navigation }) {
  const { perfil } = useSesionCompartida();
  const { cantidad, recargar } = useContadorNotificaciones({ perfilId: perfil?.id });
  const abrirNotificaciones = useCallback(
    () => navigation.navigate(ROUTES.NOTIFICACIONES),
    [navigation],
  );

  return (
    <ContadorDeNotificacionesProvider value={{ cantidad }}>
      <AvisosDelSistema
        perfilId={perfil?.id}
        cantidad={cantidad}
        onAbrir={abrirNotificaciones}
        onVolverAlFrente={recargar}
      />
      <TabsNavigator />
    </ContadorDeNotificacionesProvider>
  );
}

// Pantallas del Root que se abren encima de las pestanas, desde cualquiera de ellas. Llevan la
// misma guarda que las de los stacks (guardaDeRol.test.js lo comprueba).
const PANTALLAS_DEL_ROOT = [
  {
    name: ROUTES.NOTIFICACIONES,
    componente: conGuardaDeRoles(NotificacionesScreen, TODOS_LOS_ROLES),
    titulo: "Notificaciones",
  },
];

//  AQUÍ ESTABA EL FALTO — se agregó la pantalla
//
// Hallazgo de la issue #755: AccesoDenegado estaba declarada PRIMERA, y React Navigation toma la
// primera pantalla como punto de entrada en dos momentos: al montar, y cuando la pantalla actual
// deja de existir -al iniciar sesion desaparece Auth y aparece Tabs-. La app abria siempre en
// "acceso denegado", y volvia a el justo despues de iniciar sesion. Ahora va ULTIMA: sigue
// registrada -la guarda de rol navega a ella desde cualquier pantalla- pero nunca es la entrada.
// initialRouteName lo deja ademas escrito.
export function rutaInicialDelRoot(haySesion) {
  return haySesion ? ROUTES.TABS : ROUTES.AUTH;
}

// El fondo de la navegacion es el de todas las pantallas (issue #755): mientras un stack monta la
// pantalla siguiente se ve este color, y el de React Navigation por defecto no es el de la paleta.
const TEMA_DE_NAVEGACION = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.background },
};

export default function AppNavigator({ haySesion }) {
  const { registrarActividad } = useSesionCompartida();

  return (
    // `onStateChange` es la senal de actividad: cada vez que alguien navega, la cuenta de
    // inactividad vuelve a cero (issue #840). No se escuchan toques sueltos a proposito -- en un
    // telefono, dejar la pantalla encendida sin navegar a ningun lado ES estar inactivo.
    <NavigationContainer theme={TEMA_DE_NAVEGACION} onStateChange={registrarActividad}>
      <Root.Navigator
        initialRouteName={rutaInicialDelRoot(haySesion)}
        screenOptions={{ headerShown: false }}
      >
        {haySesion ? (
          <>
            <Root.Screen name={ROUTES.TABS} component={TabsConContador} />
            {PANTALLAS_DEL_ROOT.map(({ name, componente, titulo }) => (
              <Root.Screen
                key={name}
                name={name}
                component={componente}
                options={{
                  headerShown: true,
                  title: titulo,
                  headerStyle: { backgroundColor: colors.surface },
                  headerTintColor: colors.text,
                }}
              />
            ))}
          </>
        ) : (
          <Root.Screen name={ROUTES.AUTH} component={AuthNavigator} />
        )}

        {/*  Ruta de Acceso Denegado — SIEMPRE disponible, y siempre la ultima (ver arriba) */}
        <Root.Screen name={ROUTES.ACCESO_DENEGADO} component={AccesoDenegadoScreen} />
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
  cabeceraDerecha: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
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
