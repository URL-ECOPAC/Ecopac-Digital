import { View, Text, StyleSheet, Pressable } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors, spacing, typography } from "@ecopac/ui-tokens";
import { etiquetaDeRol, tabsMoviles, MODULOS, puedeRegistrarMovimiento } from "@ecopac/shared";

import { useSesionCompartida } from "../contexto/SesionProvider";
import RutaProtegida from "../components/RutaProtegida";
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
import DonacionesScreen from "../screens/DonacionesScreen";
import ProyectosScreen from "../screens/ProyectosScreen";
import PresupuestosScreen from "../screens/PresupuestosScreen";
import ColaboradoresScreen from "../screens/ColaboradoresScreen";
import FichaColaboradorScreen from "../screens/FichaColaboradorScreen";

export { ROUTES, InicioNavigator };

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
  headerStyle: { backgroundColor: colors?.surface || "#FFFFFF" },
  headerTitle: () => <CustomHeaderTitle title={title} />,
  headerTitleContainerStyle: {
    width: "100%",
    left: 0,
  },
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

/** Roles permitidos para un modulo, segun la definicion unica de MODULOS (issue #692). */
export function rolesDelModulo(moduloId) {
  return MODULOS.find((m) => m.id === moduloId)?.roles ?? [];
}

// React Navigation solo entrega {navigation, route} a `component`, no children: se envuelve la
// pantalla real en RutaProtegida en vez de usarla como route element (patron de apps/web).
function conGuardaDeRol(Componente, moduloId) {
  const rolesPermitidos = rolesDelModulo(moduloId);
  return function PantallaConGuarda(props) {
    return (
      <RutaProtegida rolesPermitidos={rolesPermitidos}>
        <Componente {...props} />
      </RutaProtegida>
    );
  };
}

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
        component={conGuardaDeRol(DonacionesScreen, "donaciones")}
        options={opcionesStack("Donaciones")}
      />
      <InicioStack.Screen
        name={ROUTES.PROYECTOS}
        component={conGuardaDeRol(ProyectosScreen, "proyectos")}
        options={opcionesStack("Proyectos")}
      />
      <InicioStack.Screen
        name={ROUTES.PRESUPUESTOS}
        component={conGuardaDeRol(PresupuestosScreen, "presupuestos")}
        options={opcionesStack("Presupuestos")}
      />
      <InicioStack.Screen
        name={ROUTES.COLABORADORES}
        component={conGuardaDeRol(ColaboradoresScreen, "colaboradores")}
        options={opcionesStack("Colaboradores")}
      />
      <InicioStack.Screen
        name={ROUTES.FICHA_COLABORADOR}
        component={conGuardaDeRol(FichaColaboradorScreen, "colaboradores")}
        options={opcionesStack("Ficha del personal")}
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
  const { rol } = useSesionCompartida();
  const puedeRegistrarIngreso = puedeRegistrarMovimiento(rol);

  return (
    <InventarioStack.Navigator>
      <InventarioStack.Screen
        name={ROUTES.STOCK}
        component={StockScreen}
        options={({ navigation }) => ({
          ...opcionesStack("Inventario"),
          // Punto de entrada al registro rapido de ingreso (issue #165). Se agrega aqui, en las
          // opciones de la unica pantalla que hoy cuelga del tab Inventario, y no dentro de
          // CatalogoMedicamentosScreen.js, para no tocar un archivo que #165 no necesita.
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
        })}
      />
      <InventarioStack.Screen
        name={ROUTES.REGISTRO_INGRESO}
        component={RegistroIngresoScreen}
        options={opcionesStack("Registrar ingreso")}
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

  let tabsList =
    modulosPermitidos.length > 0
      ? modulosPermitidos.map((m) => CONFIGURACION_TABS[m.tabMovil]).filter(Boolean)
      : Object.values(CONFIGURACION_TABS);

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
  botonHeaderIngreso: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  textoBotonHeaderIngreso: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors?.primary || "#16A34A",
  },
});
