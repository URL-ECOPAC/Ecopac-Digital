import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors, typography } from '@ecopac/ui-tokens';

import LoginScreen from '../screens/LoginScreen';
import InicioScreen from '../screens/InicioScreen';
import AjustesScreen from '../screens/AjustesScreen';
import SeleccionJornadaScreen from '../screens/SeleccionJornadaScreen';
import JornadaEnCursoScreen from '../screens/JornadaEnCursoScreen';
import BusquedaPacienteScreen from '../screens/BusquedaPacienteScreen';
import RegistroPacienteScreen from '../screens/RegistroPacienteScreen';
import TriajeScreen from '../screens/TriajeScreen';
import ConsultaScreen from '../screens/ConsultaScreen';
import RecetaScreen from '../screens/RecetaScreen';
import StockScreen from '../screens/StockScreen';
import DonacionesScreen from '../screens/DonacionesScreen';
import ProyectosScreen from '../screens/ProyectosScreen';
import PresupuestosScreen from '../screens/PresupuestosScreen';
import VoluntariosScreen from '../screens/VoluntariosScreen';

// Nombres de ruta centralizados para evitar strings sueltos en el resto de la app.
export const ROUTES = {
  LOGIN: 'Login',
  TABS: 'Tabs',

  // Tabs (los cinco destinos del diseno)
  TAB_INICIO: 'Inicio',
  TAB_PACIENTES: 'Pacientes',
  TAB_JORNADAS: 'Jornadas',
  TAB_INVENTARIO: 'Inventario',
  TAB_AJUSTES: 'Ajustes',

  // Pantallas dentro de cada stack
  INICIO: 'InicioPanel',
  DONACIONES: 'Donaciones',
  PROYECTOS: 'Proyectos',
  PRESUPUESTOS: 'Presupuestos',
  VOLUNTARIOS: 'Voluntarios',
  BUSQUEDA_PACIENTE: 'BusquedaPaciente',
  REGISTRO_PACIENTE: 'RegistroPaciente',
  TRIAJE: 'Triaje',
  CONSULTA: 'Consulta',
  RECETA: 'Receta',
  SELECCION_JORNADA: 'SeleccionJornada',
  JORNADA_EN_CURSO: 'JornadaEnCurso',
  STOCK: 'Stock',
};

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
};

// El tab de Inicio concentra los modulos administrativos que no tienen tab propio:
// el diseno los alcanza desde el grid de modulos de la pantalla de inicio.
// Reportes no aparece: ese modulo existe unicamente en la version web.
function InicioNavigator() {
  return (
    <InicioStack.Navigator screenOptions={opcionesStack}>
      <InicioStack.Screen name={ROUTES.INICIO} component={InicioScreen} options={{ title: 'Inicio' }} />
      <InicioStack.Screen name={ROUTES.DONACIONES} component={DonacionesScreen} options={{ title: 'Donaciones' }} />
      <InicioStack.Screen name={ROUTES.PROYECTOS} component={ProyectosScreen} options={{ title: 'Proyectos' }} />
      <InicioStack.Screen name={ROUTES.PRESUPUESTOS} component={PresupuestosScreen} options={{ title: 'Presupuestos' }} />
      <InicioStack.Screen name={ROUTES.VOLUNTARIOS} component={VoluntariosScreen} options={{ title: 'Voluntarios y medicos' }} />
    </InicioStack.Navigator>
  );
}

function PacientesNavigator() {
  return (
    <PacientesStack.Navigator screenOptions={opcionesStack}>
      <PacientesStack.Screen name={ROUTES.BUSQUEDA_PACIENTE} component={BusquedaPacienteScreen} options={{ title: 'Pacientes' }} />
      <PacientesStack.Screen name={ROUTES.REGISTRO_PACIENTE} component={RegistroPacienteScreen} options={{ title: 'Registro de paciente' }} />
      <PacientesStack.Screen name={ROUTES.TRIAJE} component={TriajeScreen} options={{ title: 'Triaje' }} />
      <PacientesStack.Screen name={ROUTES.CONSULTA} component={ConsultaScreen} options={{ title: 'Consulta' }} />
      <PacientesStack.Screen name={ROUTES.RECETA} component={RecetaScreen} options={{ title: 'Receta' }} />
    </PacientesStack.Navigator>
  );
}

function JornadasNavigator() {
  return (
    <JornadasStack.Navigator screenOptions={opcionesStack}>
      <JornadasStack.Screen name={ROUTES.SELECCION_JORNADA} component={SeleccionJornadaScreen} options={{ title: 'Jornadas' }} />
      <JornadasStack.Screen name={ROUTES.JORNADA_EN_CURSO} component={JornadaEnCursoScreen} options={{ title: 'Jornada en curso' }} />
    </JornadasStack.Navigator>
  );
}

function InventarioNavigator() {
  return (
    <InventarioStack.Navigator screenOptions={opcionesStack}>
      <InventarioStack.Screen name={ROUTES.STOCK} component={StockScreen} options={{ title: 'Inventario' }} />
    </InventarioStack.Navigator>
  );
}

function TabsNavigator() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: typography.sizes.xs },
      }}
    >
      <Tabs.Screen name={ROUTES.TAB_INICIO} component={InicioNavigator} />
      <Tabs.Screen name={ROUTES.TAB_PACIENTES} component={PacientesNavigator} />
      <Tabs.Screen name={ROUTES.TAB_JORNADAS} component={JornadasNavigator} />
      <Tabs.Screen name={ROUTES.TAB_INVENTARIO} component={InventarioNavigator} />
      <Tabs.Screen name={ROUTES.TAB_AJUSTES} component={AjustesScreen} />
    </Tabs.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Root.Navigator initialRouteName={ROUTES.LOGIN} screenOptions={{ headerShown: false }}>
        <Root.Screen name={ROUTES.LOGIN} component={LoginScreen} />
        <Root.Screen name={ROUTES.TABS} component={TabsNavigator} />
      </Root.Navigator>
    </NavigationContainer>
  );
}
