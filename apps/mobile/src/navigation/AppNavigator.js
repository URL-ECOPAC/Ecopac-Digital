import { Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors, typography } from "@ecopac/ui-tokens";
import { tabsMoviles, modulosVisibles } from "@ecopac/shared";

import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "./rutas";
import JornadaActivaBadge from "../components/JornadaActivaBadge";
import UsuarioActivo from "../components/UsuarioActivo";
import LoginScreen from "../screens/LoginScreen";
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
import DonacionesScreen from "../screens/DonacionesScreen";
import ProyectosScreen from "../screens/ProyectosScreen";
import PresupuestosScreen from "../screens/PresupuestosScreen";
import VoluntariosScreen from "../screens/VoluntariosScreen";

export { ROUTES };

const Root = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const InicioStack = createNativeStackNavigator();
const PacientesStack = createNativeStackNavigator();
const JornadasStack = createNativeStackNavigator();
const InventarioStack = createNativeStackNavigator();

// headerRight compone dos widgets que leen su propio contexto (issue #186, criterio 4: la
// jornada activa visible desde cualquier pantalla, mismo patron que UsuarioActivo ya usaba para
// la sesion). Este es el unico punto de AppNavigator que se toco para esa issue.
const opcionesStack = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  headerTitleStyle: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
  headerRight: () => (
    <>
      <JornadaActivaBadge />
      <UsuarioActivo />
    </>
  ),
};

// Mapeo entre los identificadores de tabMovil (navegacion.js) y la navegacion React Native
const CONFIGURACION_TABS = {
  Inicio: {
    routeName: ROUTES.TAB_INICIO,
    component: InicioNavigator,
    label: "Inicio",
    icon: "⌂",
  },
  Pacientes: {
    routeName: ROUTES.TAB_PACIENTES,
    component: PacientesNavigator,
    label: "Pacientes",
    icon: "𐀔",
  },
  Jornadas: {
    routeName: ROUTES.TAB_JORNADAS,
    component: JornadasNavigator,
    label: "Jornadas",
    icon: "📅",
  },
  Inventario: {
    routeName: ROUTES.TAB_INVENTARIO,
    component: InventarioNavigator,
    label: "Inventario",
    icon: "📦",
  },
};

const TAB_AJUSTES_CONFIG = {
  routeName: ROUTES.TAB_AJUSTES,
  component: AjustesScreen,
  label: "Ajustes",
  icon: "⚙",
};

function InicioNavigator() {
  const { perfil } = useSesionCompartida();
  const modulos = modulosVisibles(perfil?.rol, { plataforma: "mobile" });
  const idsVisibles = modulos.map((m) => m.id);

  return (
    <InicioStack.Navigator screenOptions={opcionesStack}>
      <InicioStack.Screen
        name={ROUTES.INICIO}
        component={InicioScreen}
        options={{ title: "Inicio" }}
      />
      {idsVisibles.includes("donaciones") && (
        <InicioStack.Screen
          name={ROUTES.DONACIONES}
          component={DonacionesScreen}
          options={{ title: "Donaciones" }}
        />
      )}
      {idsVisibles.includes("proyectos") && (
        <InicioStack.Screen
          name={ROUTES.PROYECTOS}
          component={ProyectosScreen}
          options={{ title: "Proyectos" }}
        />
      )}
      {idsVisibles.includes("presupuestos") && (
        <InicioStack.Screen
          name={ROUTES.PRESUPUESTOS}
          component={PresupuestosScreen}
          options={{ title: "Presupuestos" }}
        />
      )}
      {idsVisibles.includes("voluntarios") && (
        <InicioStack.Screen
          name={ROUTES.VOLUNTARIOS}
          component={VoluntariosScreen}
          options={{ title: "Voluntarios y medicos" }}
        />
      )}
    </InicioStack.Navigator>
  );
}

function PacientesNavigator() {
  return (
    <PacientesStack.Navigator screenOptions={opcionesStack}>
      <PacientesStack.Screen
        name={ROUTES.BUSQUEDA_PACIENTE}
        component={BusquedaPacienteScreen}
        options={{ title: "Pacientes" }}
      />
      <PacientesStack.Screen
        name={ROUTES.FICHA_PACIENTE}
        component={FichaPacienteScreen}
        options={{ title: "Ficha del paciente" }}
      />
      <PacientesStack.Screen
        name={ROUTES.REGISTRO_PACIENTE}
        component={RegistroPacienteScreen}
        options={{ title: "Registro de paciente" }}
      />
      <PacientesStack.Screen
        name={ROUTES.HISTORIAL_PACIENTE}
        component={HistorialPacienteScreen}
        options={{ title: "Historial" }}
      />
      <PacientesStack.Screen
        name={ROUTES.TRIAJE}
        component={TriajeScreen}
        options={{ title: "Triaje" }}
      />
      <PacientesStack.Screen
        name={ROUTES.CONSULTA}
        component={ConsultaScreen}
        options={{ title: "Consulta" }}
      />
      <PacientesStack.Screen
        name={ROUTES.RECETA}
        component={RecetaScreen}
        options={{ title: "Receta" }}
      />
    </PacientesStack.Navigator>
  );
}

function JornadasNavigator() {
  return (
    <JornadasStack.Navigator screenOptions={opcionesStack}>
      <JornadasStack.Screen
        name={ROUTES.SELECCION_JORNADA}
        component={SeleccionJornadaScreen}
        options={{ title: "Jornadas" }}
      />
      <JornadasStack.Screen
        name={ROUTES.JORNADA_EN_CURSO}
        component={JornadaEnCursoScreen}
        options={{ title: "Jornada en curso" }}
      />
      <JornadasStack.Screen
        name={ROUTES.JORNADAS_ASIGNADAS}
        component={JornadasAsignadasScreen}
        options={{ title: "Mis jornadas" }}
      />
    </JornadasStack.Navigator>
  );
}

function InventarioNavigator() {
  return (
    <InventarioStack.Navigator screenOptions={opcionesStack}>
      <InventarioStack.Screen
        name={ROUTES.STOCK}
        component={StockScreen}
        options={{ title: "Inventario" }}
      />
    </InventarioStack.Navigator>
  );
}

function TabsNavigator() {
  const { perfil } = useSesionCompartida();
  const modulosPermitidos = tabsMoviles(perfil?.rol);

  // Mapea los módulos autorizados y agrega Ajustes al final
  const tabsAAgregar = modulosPermitidos.map((m) => CONFIGURACION_TABS[m.tabMovil]).filter(Boolean);

  tabsAAgregar.push(TAB_AJUSTES_CONFIG);

  // Define la ruta inicial basada en la primera pestaña disponible
  const rutaInicial = tabsAAgregar[0]?.routeName || ROUTES.TAB_INICIO;

  return (
    <Tabs.Navigator
      initialRouteName={rutaInicial}
      screenOptions={({ route }) => {
        const configTab =
          Object.values(CONFIGURACION_TABS).find((c) => c.routeName === route.name) ||
          TAB_AJUSTES_CONFIG;

        return {
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarLabelStyle: { fontSize: typography.sizes.xs },
          tabBarIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size - 2, fontWeight: "bold" }}>{configTab.icon}</Text>
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
          <Root.Screen name={ROUTES.LOGIN} component={LoginScreen} />
        )}
      </Root.Navigator>
    </NavigationContainer>
  );
}
