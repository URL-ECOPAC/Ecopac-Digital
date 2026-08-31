import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { modulosVisibles } from "@ecopac/shared";
import { ROUTES } from "../navigation/rutas";
import { useSesionCompartida } from "../contexto/SesionProvider";
import UsuarioActivo from "./UsuarioActivo";

export default function MenuDrawer({ onClose, rutaActual, onNavegar }) {
  const navigation = useNavigation();
  const { perfil } = useSesionCompartida();

  const rol = perfil?.rol || "voluntario";
  const modulosPermitidos = modulosVisibles(rol, { plataforma: "mobile" });

  const tienePermiso = (idModulo) => modulosPermitidos.some((m) => m.id === idModulo);

  // Mapeo estructurado por categorías
  const estructuraMenu = [
    {
      categoria: "PRINCIPAL",
      items: [{ label: "Inicio", ruta: ROUTES.INICIO, id: "inicio", siempreVisible: true }],
    },
    {
      categoria: "ATENCIÓN MÉDICA",
      items: [
        { label: "Pacientes", ruta: ROUTES.BUSQUEDA_PACIENTE, id: "pacientes" },
        { label: "Donaciones", ruta: ROUTES.DONACIONES, id: "donaciones" },
      ],
    },
    {
      categoria: "OPERACIONES",
      items: [
        { label: "Inventario", ruta: ROUTES.STOCK, id: "inventario", badge: 2 },
        { label: "Presupuestos", ruta: ROUTES.PRESUPUESTOS, id: "presupuestos", badge: 2 },
      ],
    },
    {
      categoria: "ADMINISTRACIÓN",
      items: [
        { label: "Proyectos", ruta: ROUTES.PROYECTOS, id: "proyectos" },
        { label: "Ajustes", ruta: ROUTES.TAB_AJUSTES, id: "ajustes", siempreVisible: true },
      ],
    },
    {
      categoria: "JORNADAS",
      items: [
        { label: "Kanban Jornadas", ruta: ROUTES.SELECCION_JORNADA, id: "jornadas" },
        { label: "Voluntarios", ruta: ROUTES.VOLUNTARIOS, id: "voluntarios" },
      ],
    },
  ];

  // Filtrar ítems y categorías según los permisos del usuario
  const seccionesVisibles = estructuraMenu
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((item) => item.siempreVisible || tienePermiso(item.id)),
    }))
    .filter((sec) => sec.items.length > 0);

  const irAModulo = (ruta) => {
    onNavegar(ruta);
    navigation.navigate(ruta);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titleLogo}>
          Ecopac <Text style={{ color: "#0F172A" }}>Digital</Text>
        </Text>
        <Text style={styles.subtextLogo}>JORNADAS MÉDICAS</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {seccionesVisibles.map((sec, idx) => (
          <View key={idx} style={styles.seccionContainer}>
            <Text style={styles.categoriaTitle}>{sec.categoria}</Text>
            {sec.items.map((item, itemIdx) => {
              const activo = rutaActual === item.ruta;
              return (
                <TouchableOpacity
                  key={itemIdx}
                  style={[styles.item, activo && styles.itemActivo]}
                  onPress={() => irAModulo(item.ruta)}
                >
                  <Text style={[styles.itemTexto, activo && styles.itemTextoActivo]}>
                    {item.label}
                  </Text>
                  {item.badge !== undefined && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footerUsuario}>
        <UsuarioActivo onCloseModal={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  titleLogo: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#16A34A",
  },
  subtextLogo: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 1,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 12,
  },
  seccionContainer: {
    marginTop: 16,
  },
  categoriaTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 1,
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 2,
  },
  itemActivo: {
    backgroundColor: "#F0FDF4",
  },
  itemTexto: {
    fontSize: 14,
    fontWeight: "500",
    color: "#334155",
  },
  itemTextoActivo: {
    color: "#16A34A",
    fontWeight: "700",
  },
  badge: {
    backgroundColor: "#F97316",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
  },
  footerUsuario: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
});
