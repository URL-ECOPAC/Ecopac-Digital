import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, statusColors, typography } from "@ecopac/ui-tokens";

/**
 * Chip de estado. Espejo de apps/web/src/components/StatusChip.jsx.
 *
 * `status` debe ser exactamente un valor de un enum de la base de datos y se usa tal cual
 * como indice de statusColors. Sin tabla de traduccion propia a proposito: dos listas de
 * estados terminarian divergiendo de la migracion.
 *
 * En web el color sale de la variable --estado-* que publica theme.js; aqui se lee
 * statusColors directamente, que es la misma fuente.
 *
 * `uppercase` (issue #864) lo pide quien lo usa, no lo decide el chip: los estados de un
 * historial se leen en caja alta, pero un chip que muestra un nombre propio -- el rol de una
 * persona, una especialidad -- no. Es `textTransform` y no `.toUpperCase()` sobre el texto, para
 * no cambiar lo que anuncia el lector de pantalla. Mismo criterio que el StatusChip de la web.
 */
/**
 * Simbolo opcional del chip (issue #840). Espejo de ICONOS en el StatusChip de web: el catalogo
 * del descriptor trae el nombre generico "si"/"no" y cada app lo traduce a su libreria.
 */
const ICONOS = { si: "checkmark", no: "close" };

export default function StatusChip({ status, label, icono, uppercase = false }) {
  if (status === null || status === undefined || status === "") return null;

  // React Native tampoco pinta booleanos: la columna de estado de COLUMNAS_USUARIO lee el
  // campo activo, y sin convertirlo el chip saldria vacio.
  const texto = label ?? String(status);
  const fondo = statusColors[status] ?? colors.secondary;
  const nombreDeIcono = ICONOS[icono];

  return (
    <View style={[styles.chip, { backgroundColor: fondo }]}>
      {/* El simbolo acompaña al texto, no lo sustituye: por si solo no se lee en voz alta ni se
          distingue sin color. */}
      {nombreDeIcono && (
        <Ionicons name={nombreDeIcono} size={12} color={colors.surface} aria-hidden />
      )}
      <Text style={[styles.texto, uppercase && styles.textoEnCajaAlta]}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radii.pill,
  },
  texto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.surface,
  },
  textoEnCajaAlta: {
    textTransform: "uppercase",
  },
});
