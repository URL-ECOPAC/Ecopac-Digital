import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/LoginScreen';
import SeleccionJornadaScreen from '../screens/SeleccionJornadaScreen';
import BusquedaPacienteScreen from '../screens/BusquedaPacienteScreen';
import RegistroPacienteScreen from '../screens/RegistroPacienteScreen';
import TriajeScreen from '../screens/TriajeScreen';
import ConsultaScreen from '../screens/ConsultaScreen';
import RecetaScreen from '../screens/RecetaScreen';
import StockScreen from '../screens/StockScreen';

const Stack = createNativeStackNavigator();

// Nombres de ruta centralizados para evitar strings sueltos en el resto de la app
export const ROUTES = {
  LOGIN: 'Login',
  SELECCION_JORNADA: 'SeleccionJornada',
  BUSQUEDA_PACIENTE: 'BusquedaPaciente',
  REGISTRO_PACIENTE: 'RegistroPaciente',
  TRIAJE: 'Triaje',
  CONSULTA: 'Consulta',
  RECETA: 'Receta',
  STOCK: 'Stock',
};

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={ROUTES.LOGIN}
        screenOptions={{ headerShown: true }}
      >
        <Stack.Screen
          name={ROUTES.LOGIN}
          component={LoginScreen}
          options={{ title: 'Iniciar sesion' }}
        />
        <Stack.Screen
          name={ROUTES.SELECCION_JORNADA}
          component={SeleccionJornadaScreen}
          options={{ title: 'Seleccion de jornada' }}
        />
        <Stack.Screen
          name={ROUTES.BUSQUEDA_PACIENTE}
          component={BusquedaPacienteScreen}
          options={{ title: 'Busqueda de paciente' }}
        />
        <Stack.Screen
          name={ROUTES.REGISTRO_PACIENTE}
          component={RegistroPacienteScreen}
          options={{ title: 'Registro de paciente' }}
        />
        <Stack.Screen
          name={ROUTES.TRIAJE}
          component={TriajeScreen}
          options={{ title: 'Triaje' }}
        />
        <Stack.Screen
          name={ROUTES.CONSULTA}
          component={ConsultaScreen}
          options={{ title: 'Consulta' }}
        />
        <Stack.Screen
          name={ROUTES.RECETA}
          component={RecetaScreen}
          options={{ title: 'Receta' }}
        />
        <Stack.Screen
          name={ROUTES.STOCK}
          component={StockScreen}
          options={{ title: 'Consulta de stock' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}