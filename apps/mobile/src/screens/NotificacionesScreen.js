import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";
import {
  DESTINOS_MOVILES_NOTIFICACION,
  descriptorDeCategoria,
  FILTROS_NOTIFICACIONES,
  formatearFechaConHora,
  useBuzonNotificaciones,
} from "@ecopac/shared";

import {
  ErrorState,
  FilterBar,
  LoadingState,
  ScreenContainer,
  SecondaryButton,
  Tabs,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";

// Ventana dedicada de notificaciones en movil (issue #755). Espejo de
// apps/web/src/pages/NotificacionesPage.jsx: mismo hook, mismos filtros (texto, una categoria en
// especial, estado de lectura) y mismas dos vistas (por llegada / por categoria). Se abre desde la
// campana de la cabecera de cualquier pestana y desde Ajustes. El color de cada categoria es un
// nombre de token (`tono`) que aqui se lee como colors[tono]; la pantalla no escribe ningun color.
//
// A DONDE LLEVA
//
// La web navega al `enlace` de la notificacion. El movil no tiene esas rutas: traduce
// `destinoMovil` a su navegador. Validacion y presupuestos no tienen pantalla movil -la bandeja de
// validacion y la de gastos existen solo en la web-, asi que tocarlas las marca como leidas y lo
// dice, en vez de llevar a una pantalla que no es.

const VISTA_LLEGADA = "llegada";
const VISTA_CATEGORIA = "categoria";

const VISTAS = [
  { id: VISTA_LLEGADA, label: "Por llegada" },
  { id: VISTA_CATEGORIA, label: "Por categoría" },
];

const RUTA_DE_DESTINO = {
  [DESTINOS_MOVILES_NOTIFICACION.ALERTAS_DE_INVENTARIO]: ROUTES.RESUMEN_ALERTAS_INVENTARIO,
  [DESTINOS_MOVILES_NOTIFICACION.EXISTENCIAS]: ROUTES.EXISTENCIAS_INVENTARIO,
};

function ItemDeNotificacion({ notificacion, onAbrir }) {
  const { etiqueta, tono } = descriptorDeCategoria(notificacion.categoria);
  const acento = colors[tono];

  return (
    <Pressable
      onPress={() => onAbrir(notificacion)}
      accessibilityRole="button"
      accessibilityLabel={`${notificacion.leida ? "" : "Sin leer. "}${notificacion.titulo}`}
      style={({ pressed }) => [
        styles.item,
        { borderLeftColor: acento },
        !notificacion.leida && styles.itemSinLeer,
        pressed && styles.itemPresionado,
      ]}
    >
      <View style={styles.itemCabecera}>
        <Text style={[styles.chip, { color: acento, borderColor: acento }]}>{etiqueta}</Text>
        <Text style={styles.fecha}>{formatearFechaConHora(notificacion.createdAt)}</Text>
      </View>
      <View style={styles.filaTitulo}>
        {!notificacion.leida ? <View style={styles.punto} /> : null}
        <Text style={[styles.titulo, !notificacion.leida && styles.tituloSinLeer]}>
          {notificacion.titulo}
        </Text>
      </View>
      <Text style={styles.cuerpo}>{notificacion.cuerpo}</Text>
    </Pressable>
  );
}

export default function NotificacionesScreen({ navigation }) {
  const { perfil } = useSesionCompartida();
  const {
    notificaciones,
    total,
    grupos,
    filtros,
    setFiltro,
    agrupar,
    setAgrupar,
    noLeidas,
    cargando,
    error,
    errorAccion,
    recargar,
    abrir,
    marcarTodas,
  } = useBuzonNotificaciones({ perfilId: perfil?.id });
  const [avisoSoloWeb, setAvisoSoloWeb] = useState(null);

  const alAbrir = async (notificacion) => {
    setAvisoSoloWeb(null);
    const marcada = await abrir(notificacion);
    if (!marcada) return;

    const ruta = RUTA_DE_DESTINO[descriptorDeCategoria(notificacion.categoria).destinoMovil];
    if (ruta) {
      // Esta pantalla vive en el Root, encima de las pestanas: la ruta va completa, Tabs >
      // Inventario > pantalla.
      navigation.navigate(ROUTES.TABS, {
        screen: ROUTES.TAB_INVENTARIO,
        params: { screen: ruta },
      });
      return;
    }
    setAvisoSoloWeb(`"${notificacion.titulo}" se atiende desde la versión web.`);
  };

  const lista = (items) =>
    items.map((notificacion) => (
      <ItemDeNotificacion key={notificacion.id} notificacion={notificacion} onAbrir={alAbrir} />
    ));

  let contenido;
  if (cargando && total === 0) {
    contenido = <LoadingState message="Cargando notificaciones..." />;
  } else if (error) {
    contenido = <ErrorState message={error.mensaje} onRetry={recargar} />;
  } else if (total === 0) {
    contenido = <Text style={styles.vacio}>No tienes notificaciones.</Text>;
  } else if (notificaciones.length === 0) {
    contenido = <Text style={styles.vacio}>Ninguna notificación coincide con los filtros.</Text>;
  } else if (agrupar) {
    contenido = grupos.map((grupo) => (
      <View key={grupo.categoria} style={styles.grupo}>
        <View style={styles.grupoTitulo}>
          <View style={[styles.grupoPunto, { backgroundColor: colors[grupo.tono] }]} />
          <Text style={styles.grupoTexto}>
            {grupo.etiqueta} ({grupo.notificaciones.length})
            {grupo.noLeidas > 0 ? ` · ${grupo.noLeidas} sin leer` : ""}
          </Text>
        </View>
        {lista(grupo.notificaciones)}
      </View>
    ));
  } else {
    contenido = lista(notificaciones);
  }

  return (
    <ScreenContainer contentContainerStyle={styles.pantalla}>
      <Text style={styles.resumen}>{noLeidas > 0 ? `${noLeidas} sin leer` : "Todo al día"}</Text>
      {errorAccion ? <ErrorState message={errorAccion.mensaje} /> : null}
      {avisoSoloWeb ? <Text style={styles.aviso}>{avisoSoloWeb}</Text> : null}
      {noLeidas > 0 ? (
        <SecondaryButton
          title="Marcar todas como leídas"
          onPress={marcarTodas}
          style={styles.marcarTodas}
        />
      ) : null}
      <FilterBar campos={FILTROS_NOTIFICACIONES} valores={filtros} onChange={setFiltro} />
      <Tabs
        tabs={VISTAS}
        activo={agrupar ? VISTA_CATEGORIA : VISTA_LLEGADA}
        onChange={(vista) => setAgrupar(vista === VISTA_CATEGORIA)}
      >
        <View style={styles.lista}>{contenido}</View>
      </Tabs>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  resumen: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
  },
  lista: {
    gap: spacing.sm,
  },
  item: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  itemSinLeer: {
    backgroundColor: colors.background,
  },
  itemPresionado: {
    opacity: 0.7,
  },
  itemCabecera: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  fecha: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
  },
  filaTitulo: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  punto: {
    backgroundColor: colors.info,
    borderRadius: radii.pill,
    height: 8,
    width: 8,
  },
  titulo: {
    color: colors.text,
    flexShrink: 1,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
  },
  tituloSinLeer: {
    fontWeight: typography.weights.semibold,
  },
  cuerpo: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
  },
  grupo: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  grupoTitulo: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  grupoPunto: {
    borderRadius: radii.pill,
    height: 8,
    width: 8,
  },
  grupoTexto: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  vacio: {
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderStyle: "dashed",
    borderWidth: 1,
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    padding: spacing.md,
  },
  aviso: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  marcarTodas: {
    marginBottom: spacing.sm,
  },
});
