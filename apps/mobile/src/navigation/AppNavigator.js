import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors } from "@ecopac/ui-tokens";
import { tabsMoviles } from "@ecopac/shared";

import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "./rutas";

// IMPORTACIÓN DE PANTALLAS
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

// Componente para la barra del header personalizado
function CustomHeaderTitle({ title }) {
  const { perfil } = useSesionCompartida();

  return (
    <View style={styles.headerContainer}>
      <Text style={styles.headerTitleText}>{title}</Text>
      <View style={styles.userContainer}>
        <Text style={styles.nombreText} numberOfLines={1}>
          {perfil?.nombre || "Administradora..."}
        </Text>
        <Text style={styles.rolText} numberOfLines={1}>
          {perfil?.rol || "Administradora"}
        </Text>
      </View>
    </View>
  );
}

const opcionesStack = (title) => ({
  headerStyle: { backgroundColor: colors?.surface || "#FFFFFF" },
  headerTitle: () => <CustomHeaderTitle title={title} />,
  headerTitleContainerStyle: {
    width: "100%",
    left: 0,
  },
});

function InicioNavigator() {
  return (
    <InicioStack.Navigator>
      <InicioStack.Screen
        name={ROUTES.INICIO}
        component={InicioScreen}
        options={opcionesStack("Inicio")}
      />
      <InicioStack.Screen
        name={ROUTES.DONACIONES}
        component={DonacionesScreen}
        options={opcionesStack("Donaciones")}
      />
      <InicioStack.Screen
        name={ROUTES.PROYECTOS}
        component={ProyectosScreen}
        options={opcionesStack("Proyectos")}
      />
      <InicioStack.Screen
        name={ROUTES.PRESUPUESTOS}
        component={PresupuestosScreen}
        options={opcionesStack("Presupuestos")}
      />
      <InicioStack.Screen
        name={ROUTES.VOLUNTARIOS}
        component={VoluntariosScreen}
        options={opcionesStack("Voluntarios y médicos")}
      />
    </InicioStack.Navigator>
  );
}

function PacientesNavigator() {
  return (
    <PacientesStack.Navigator>
      <PacientesStack.Screen
        name={ROUTES.BUSQUEDA_PACIENTE}
        component={BusquedaPacienteScreen}
        options={opcionesStack("Pacientes")}
      />
      <PacientesStack.Screen
        name={ROUTES.FICHA_PACIENTE}
        component={FichaPacienteScreen}
        options={opcionesStack("Ficha del paciente")}
      />
      <PacientesStack.Screen
        name={ROUTES.REGISTRO_PACIENTE}
        component={RegistroPacienteScreen}
        options={opcionesStack("Registro de paciente")}
      />
      <PacientesStack.Screen
        name={ROUTES.HISTORIAL_PACIENTE}
        component={HistorialPacienteScreen}
        options={opcionesStack("Historial")}
      />
      <PacientesStack.Screen
        name={ROUTES.TRIAJE}
        component={TriajeScreen}
        options={opcionesStack("Triaje")}
      />
      <PacientesStack.Screen
        name={ROUTES.CONSULTA}
        component={ConsultaScreen}
        options={opcionesStack("Consulta")}
      />
      <PacientesStack.Screen
        name={ROUTES.RECETA}
        component={RecetaScreen}
        options={opcionesStack("Receta")}
      />
    </PacientesStack.Navigator>
  );
}

function JornadasNavigator() {
  return (
    <JornadasStack.Navigator>
      <JornadasStack.Screen
        name={ROUTES.SELECCION_JORNADA}
        component={SeleccionJornadaScreen}
        options={opcionesStack("Jornadas")}
      />
      <JornadasStack.Screen
        name={ROUTES.JORNADA_EN_CURSO}
        component={JornadaEnCursoScreen}
        options={opcionesStack("Jornada en curso")}
      />
      <JornadasStack.Screen
        name={ROUTES.JORNADAS_ASIGNADAS}
        component={JornadasAsignadasScreen}
        options={opcionesStack("Mis jornadas")}
      />
    </JornadasStack.Navigator>
  );
}

function InventarioNavigator() {
  return (
    <InventarioStack.Navigator>
      <InventarioStack.Screen
        name={ROUTES.STOCK}
        component={StockScreen}
        options={opcionesStack("Inventario")}
      />
    </InventarioStack.Navigator>
  );
}

const CONFIGURACION_TABS = {
  Inicio: { routeName: ROUTES.TAB_INICIO, component: InicioNavigator, label: "Inicio", icon: "⌂" },
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

function TabsNavigator() {
  const { perfil } = useSesionCompartida();
  const modulosPermitidos = tabsMoviles(perfil?.rol) || [];

  let tabsAAgregar =
    modulosPermitidos.length > 0
      ? modulosPermitidos.map((m) => CONFIGURACION_TABS[m.tabMovil]).filter(Boolean)
      : Object.values(CONFIGURACION_TABS);

  if (!tabsAAgregar.some((tab) => tab?.routeName === ROUTES.TAB_INICIO)) {
    tabsAAgregar.unshift(CONFIGURACION_TABS.Inicio);
  }
  if (!tabsAAgregar.some((tab) => tab?.routeName === ROUTES.TAB_AJUSTES)) {
    tabsAAgregar.push(TAB_AJUSTES_CONFIG);
  }

  return (
    <Tabs.Navigator
      initialRouteName={ROUTES.TAB_INICIO}
      screenOptions={({ route }) => {
        const configTab =
          Object.values(CONFIGURACION_TABS).find((c) => c.routeName === route.name) ||
          TAB_AJUSTES_CONFIG;

        return {
          headerShown: false,
          tabBarActiveTintColor: colors?.primary || "#16A34A",
          tabBarInactiveTintColor: colors?.textMuted || "#94A3B8",
          tabBarStyle: { backgroundColor: colors?.surface || "#FFFFFF" },
          tabBarLabelStyle: { fontSize: 10 },
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
    color: "#0F172A",
  },
  userContainer: {
    alignItems: "flex-end",
  },
  nombreText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1E293B",
  },
  rolText: {
    fontSize: 10,
    color: "#64748B",
  },
});
