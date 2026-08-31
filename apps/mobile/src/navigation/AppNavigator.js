import React, { useState } from "react";
import { TouchableOpacity, Text, Modal, StyleSheet, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { modulosVisibles } from "@ecopac/shared";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "./rutas";

import MenuDrawer from "../components/MenuDrawer";

import LoginScreen from "../screens/LoginScreen";
import InicioScreen from "../screens/InicioScreen";
import BusquedaPacienteScreen from "../screens/BusquedaPacienteScreen";
import StockScreen from "../screens/StockScreen";
import SeleccionJornadaScreen from "../screens/SeleccionJornadaScreen";
import DonacionesScreen from "../screens/DonacionesScreen";
import PresupuestosScreen from "../screens/PresupuestosScreen";
import ProyectosScreen from "../screens/ProyectosScreen";
import VoluntariosScreen from "../screens/VoluntariosScreen";
import AjustesScreen from "../screens/AjustesScreen";
import AccesoDenegadoScreen from "../screens/AccesoDenegadoScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { usuario, perfil } = useSesionCompartida();
  const [menuVisible, setMenuVisible] = useState(false);
  const [rutaActual, setRutaActual] = useState(ROUTES.INICIO);

  if (!usuario) {
    return <LoginScreen />;
  }

  const rol = perfil?.rol || "voluntario";
  const modulos = modulosVisibles(rol, { plataforma: "mobile" });
  const tieneAcceso = (idModulo) => modulos.some((m) => m.id === idModulo);

  const toggleMenu = () => setMenuVisible(!menuVisible);

  return (
    <>
      <Stack.Navigator
        initialRouteName={ROUTES.INICIO}
        screenOptions={{
          headerStyle: { backgroundColor: "#FFFFFF" },
          headerTintColor: "#0F172A",
          headerTitleStyle: { fontWeight: "bold", color: "#0F172A", fontSize: 20 },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name={ROUTES.INICIO}
          component={InicioScreen}
          options={({ navigation }) => ({
            title: "Inicio",
            headerLeft: () => (
              <TouchableOpacity onPress={toggleMenu} style={styles.btnHamburguesa}>
                <Text style={styles.textoHamburguesa}>☰</Text>
              </TouchableOpacity>
            ),
          })}
        />
        <Stack.Screen
          name={ROUTES.BUSQUEDA_PACIENTE}
          component={tieneAcceso("pacientes") ? BusquedaPacienteScreen : AccesoDenegadoScreen}
          options={{ title: "Pacientes" }}
        />
        <Stack.Screen
          name={ROUTES.DONACIONES}
          component={tieneAcceso("donaciones") ? DonacionesScreen : AccesoDenegadoScreen}
          options={{ title: "Donaciones" }}
        />
        <Stack.Screen
          name={ROUTES.STOCK}
          component={tieneAcceso("inventario") ? StockScreen : AccesoDenegadoScreen}
          options={{ title: "Inventario" }}
        />
        <Stack.Screen
          name={ROUTES.PRESUPUESTOS}
          component={tieneAcceso("presupuestos") ? PresupuestosScreen : AccesoDenegadoScreen}
          options={{ title: "Presupuestos" }}
        />
        <Stack.Screen
          name={ROUTES.PROYECTOS}
          component={tieneAcceso("proyectos") ? ProyectosScreen : AccesoDenegadoScreen}
          options={{ title: "Proyectos" }}
        />
        <Stack.Screen
          name={ROUTES.SELECCION_JORNADA}
          component={tieneAcceso("jornadas") ? SeleccionJornadaScreen : AccesoDenegadoScreen}
          options={{ title: "Kanban Jornadas" }}
        />
        <Stack.Screen
          name={ROUTES.VOLUNTARIOS}
          component={tieneAcceso("voluntarios") ? VoluntariosScreen : AccesoDenegadoScreen}
          options={{ title: "Voluntarios" }}
        />
        <Stack.Screen
          name={ROUTES.TAB_AJUSTES}
          component={AjustesScreen}
          options={{ title: "Ajustes" }}
        />
      </Stack.Navigator>

      {/* Modal del Drawer */}
      <Modal visible={menuVisible} animationType="fade" transparent={true} onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.contenedorModal}>
          <View style={styles.drawerContenido}>
            <MenuDrawer
              onNavegar={(ruta) => {
                setRutaActual(ruta);
                setMenuVisible(false);
              }}
              onClose={() => setMenuVisible(false)}
              rutaActual={rutaActual}
            />
          </View>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMenuVisible(false)} />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btnHamburguesa: {
    marginRight: 15,
    padding: 5,
  },
  textoHamburguesa: {
    color: "#16A34A",
    fontSize: 22,
    fontWeight: "bold",
  },
  contenedorModal: {
    flex: 1,
    flexDirection: "row",
  },
  drawerContenido: {
    width: "80%",
    backgroundColor: "#FFFFFF",
    height: "100%",
  },
  overlay: {
    width: "20%",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    height: "100%",
  },
});