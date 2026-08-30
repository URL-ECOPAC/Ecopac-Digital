import { Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors, typography } from "@ecopac/ui-tokens";

import { ROUTES } from "./rutas";
import UsuarioActivo from "../components/UsuarioActivo";
import LoginScreen from "../screens/LoginScreen";
import InicioScreen from "../screens/InicioScreen";
import AjustesScreen from "../screens/AjustesScreen";
import SeleccionJornadaScreen from "../screens/SeleccionJornadaScreen";
import JornadaEnCursoScreen from "../screens/JornadaEnCursoScreen";
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

const opcionesStack = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  headerTitleStyle: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
  headerRight: () => <UsuarioActivo />,
};

function InicioNavigator() {
  return (
    <InicioStack.Navigator screenOptions={opcionesStack}>
      <InicioStack.Screen
        name={ROUTES.INICIO}
        component={InicioScreen}
        options={{ title: "Inicio" }}
      />
      <InicioStack.Screen
        name={ROUTES.DONACIONES}
        component={DonacionesScreen}
        options={{ title: "Donaciones" }}
      />
      <InicioStack.Screen
        name={ROUTES.PROYECTOS}
        component={ProyectosScreen}
        options={{ title: "Proyectos" }}
      />
      <InicioStack.Screen
        name={ROUTES.PRESUPUESTOS}
        component={PresupuestosScreen}
        options={{ title: "Presupuestos" }}
      />
      <InicioStack.Screen
        name={ROUTES.VOLUNTARIOS}
        component={VoluntariosScreen}
        options={{ title: "Voluntarios y medicos" }}
      />
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
  return (
    <Tabs.Navigator
      initialRouteName={ROUTES.TAB_INICIO}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: typography.sizes.xs },
        tabBarIcon: ({ color, size }) => {
          let simbolo;
          switch (route.name) {
            case ROUTES.TAB_INICIO:
              simbolo = "⌂";
              break;
            case ROUTES.TAB_PACIENTES:
              simbolo = "𐀔";
              break;
            case ROUTES.TAB_JORNADAS:
              simbolo = "📅";
              break;
            case ROUTES.TAB_INVENTARIO:
              simbolo = "📦";
              break;
            case ROUTES.TAB_AJUSTES:
              simbolo = "⚙";
              break;
            default:
              simbolo = "•";
          }
          return <Text style={{ color, fontSize: size - 2, fontWeight: "bold" }}>{simbolo}</Text>;
        },
      })}
    >
      <Tabs.Screen
        name={ROUTES.TAB_INICIO}
        component={InicioNavigator}
        options={{ tabBarLabel: "Inicio" }}
      />
      <Tabs.Screen
        name={ROUTES.TAB_PACIENTES}
        component={PacientesNavigator}
        options={{ tabBarLabel: "Pacientes" }}
      />
      <Tabs.Screen
        name={ROUTES.TAB_JORNADAS}
        component={JornadasNavigator}
        options={{ tabBarLabel: "Jornadas" }}
      />
      <Tabs.Screen
        name={ROUTES.TAB_INVENTARIO}
        component={InventarioNavigator}
        options={{ tabBarLabel: "Inventario" }}
      />
      <Tabs.Screen
        name={ROUTES.TAB_AJUSTES}
        component={AjustesScreen}
        options={{ tabBarLabel: "Ajustes" }}
      />
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
