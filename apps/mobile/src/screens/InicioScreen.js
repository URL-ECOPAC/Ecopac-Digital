import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, moduleAccents, radii, shadows, spacing, typography } from "@ecopac/ui-tokens";
import {
  ETIQUETAS_ESTADO_JORNADA,
  etiquetaDeRol,
  formatearFechaLarga,
  usePanelDeInicio,
} from "@ecopac/shared";

import ErrorState from "../components/ErrorState";
import IconoDeModulo from "../components/IconoDeModulo";
import LoadingState from "../components/LoadingState";
import ScreenContainer from "../components/ScreenContainer";
import StatusChip from "../components/StatusChip";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";

// Pantalla de inicio de la app movil. Espejo de apps/web/src/pages/HomePage.jsx: mismo hook
// (usePanelDeInicio), mismas tres partes -- saludo, jornadas en curso, accesos a los modulos --
// y las mismas descripciones, que salen de MODULOS (navegacion.js) y no de aqui.
//
// QUE HABIA ANTES Y POR QUE SE FUE (issue #838)
//
// 1. Un banner de producto: "Salud que llega a cada comunidad" mas un parrafo describiendo la
//    plataforma. Es texto de folleto, para quien todavia no la usa. Quien abre la app ya inicio
//    sesion; lo que necesita es saber que dia es, que rol tiene y donde esta su jornada. La web
//    ya lo resolvia asi y la movil decia otra cosa.
// 2. NUMEROS INVENTADOS. Cada tarjeta de modulo mostraba un valor fijo escrito en el archivo
//    ("9" pacientes, "Q 553,800" en donaciones, "2" alertas, "47%" de ejecucion). No salian de
//    ninguna consulta: eran los mismos para cualquier cuenta y cualquier dia. Es el mismo defecto
//    que la issue #687 ya habia quitado de los paneles de metricas de esta pantalla, sobrevivido
//    en las tarjetas. Un dato inventado en la pantalla de inicio de un sistema de salud no es un
//    detalle estetico. Donde habia un numero falso va ahora la descripcion real del modulo.
// 3. Una lista de modulos armada a mano (MODULOS_FIGMA) que se cruzaba con la de verdad: incluia
//    entradas como "Reportes", que en movil no existe, y un color propio por modulo en vez de
//    moduleAccents. Ahora la lista es la que devuelve el hook, y nada mas.

/** El acceso que corresponde a un modulo dentro del navegador movil. */
function destinoDelModulo(modulo) {
  if (modulo.tabMovil) return { tipo: "tab", nombre: modulo.tabMovil };

  const RUTAS_POR_MODULO = {
    donaciones: ROUTES.DONACIONES,
    proyectos: ROUTES.PROYECTOS,
    colaboradores: ROUTES.COLABORADORES,
  };

  const ruta = RUTAS_POR_MODULO[modulo.id];
  return ruta ? { tipo: "pantalla", nombre: ruta } : null;
}

export default function InicioScreen({ navigation }) {
  const { perfil } = useSesionCompartida();
  const rol = perfil?.rol;

  const {
    accesos,
    accesosEnOtraPlataforma,
    jornadasEnCurso,
    puedeVerJornadaEnCurso,
    cargando,
    error,
    recargar,
  } = usePanelDeInicio({ rol, plataforma: "mobile" });

  const saludo = perfil?.nombres ? `Hola, ${perfil.nombres}` : "Hola";

  // Un modulo sin destino en el navegador movil no se dibuja: una tarjeta que no lleva a ningun
  // lado es peor que una tarjeta de menos.
  const accesosNavegables = accesos
    .map((modulo) => ({ ...modulo, destino: destinoDelModulo(modulo) }))
    .filter((modulo) => modulo.destino !== null);

  return (
    <ScreenContainer>
      <View style={estilos.banner}>
        <Text style={estilos.saludo}>{saludo}</Text>
        <Text style={estilos.frase}>Este es el resumen de tu día en Ecopac Digital</Text>

        <View style={estilos.chips}>
          <View style={estilos.chip}>
            <Ionicons name="calendar-outline" size={13} color={colors.surface} />
            <Text style={estilos.chipTexto}>{formatearFechaLarga(new Date())}</Text>
          </View>
          {rol ? (
            <View style={estilos.chip}>
              <Ionicons name="shield-checkmark-outline" size={13} color={colors.surface} />
              <Text style={estilos.chipTexto}>{etiquetaDeRol(rol)}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {puedeVerJornadaEnCurso ? (
        <View style={estilos.seccion}>
          <Text style={estilos.tituloSeccion}>Jornadas en curso</Text>

          {cargando ? <LoadingState message="Buscando jornadas en curso..." /> : null}

          {!cargando && error ? <ErrorState message={error.mensaje} onRetry={recargar} /> : null}

          {!cargando && !error && jornadasEnCurso.length === 0 ? (
            <View style={estilos.vacio}>
              <Text style={estilos.vacioTexto}>
                No hay ninguna jornada en curso ahora mismo. Cuando empiece una, aparecerá aquí.
              </Text>
            </View>
          ) : null}

          {!cargando && !error
            ? jornadasEnCurso.map((jornada) => (
                <Pressable
                  key={jornada.id}
                  style={({ pressed }) => [estilos.jornada, pressed && estilos.pulsada]}
                  accessibilityRole="button"
                  onPress={() =>
                    navigation.navigate(ROUTES.TAB_JORNADAS, {
                      screen: ROUTES.JORNADAS_ASIGNADAS,
                    })
                  }
                >
                  <View style={estilos.jornadaTextos}>
                    <Text style={estilos.jornadaNombre}>{jornada.nombre}</Text>
                    <Text style={estilos.jornadaDetalle}>
                      {[jornada.comunidad?.nombre, formatearFechaLarga(jornada.fecha)]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <StatusChip
                    status={jornada.estado}
                    label={ETIQUETAS_ESTADO_JORNADA[jornada.estado] ?? jornada.estado}
                  />
                </Pressable>
              ))
            : null}
        </View>
      ) : null}

      <View style={estilos.seccion}>
        <Text style={estilos.tituloSeccion}>Tus módulos</Text>
        <Text style={estilos.notaSeccion}>Lo que tu rol puede abrir</Text>

        {/* ISSUE #864. Cuando no hay ni una tarjeta se dice por que, en vez de dejar el hueco.
            Pasa con junta directiva y socio fundador: su unico modulo es Reportes, que no tiene
            pantalla en movil (`soloWeb` en navegacion.js), asi que abrian la app y encontraban
            esta seccion en blanco. Un vacio sin explicacion se lee como una app rota. */}
        {accesosNavegables.length === 0 ? (
          <View style={estilos.sinAccesos}>
            <Text style={estilos.sinAccesosTitulo}>
              {accesosEnOtraPlataforma.length > 0
                ? "Tu trabajo está en la versión web"
                : "Tu rol no abre ningún módulo desde el teléfono"}
            </Text>
            {accesosEnOtraPlataforma.length > 0 ? (
              <Text style={estilos.sinAccesosTexto}>
                Desde el teléfono no hay nada que abrir con tu rol. Entra por la web para{" "}
                {accesosEnOtraPlataforma.map((modulo) => modulo.nombre).join(", ")}.
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={estilos.rejilla}>
          {accesosNavegables.map((modulo) => {
            const acento = moduleAccents[modulo.id] ?? colors.primary;
            return (
              <Pressable
                key={modulo.id}
                style={({ pressed }) => [estilos.acceso, pressed && estilos.pulsada]}
                accessibilityRole="button"
                onPress={() =>
                  modulo.destino.tipo === "tab"
                    ? navigation.navigate(modulo.destino.nombre)
                    : navigation.navigate(modulo.destino.nombre)
                }
              >
                <View style={[estilos.accesoIcono, { backgroundColor: `${acento}1F` }]}>
                  <IconoDeModulo nombre={modulo.icono} size={20} color={acento} />
                </View>
                <Text style={estilos.accesoNombre}>{modulo.nombre}</Text>
                {modulo.descripcion ? (
                  <Text style={estilos.accesoDescripcion} numberOfLines={3}>
                    {modulo.descripcion}
                  </Text>
                ) : null}
                <View style={[estilos.accesoCinta, { backgroundColor: acento }]} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScreenContainer>
  );
}

const estilos = StyleSheet.create({
  // El banner de la web es un degradado; aqui va el verde de marca plano, que es lo que se
  // consigue sin agregar expo-linear-gradient como dependencia nueva por un solo fondo.
  banner: {
    backgroundColor: colors.primaryDark,
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  saludo: {
    color: colors.surface,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  frase: {
    color: colors.surface,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
    opacity: 0.85,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  chipTexto: {
    color: colors.surface,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  seccion: {
    marginBottom: spacing.lg,
  },
  tituloSeccion: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  notaSeccion: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  vacio: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  vacioTexto: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
  },
  // Mismo recuadro que `vacio` -- es el patron de "aqui no hay nada" de esta pantalla -- pero con
  // el filete del color primario, porque esto no es una lista vacia: es una explicacion.
  sinAccesos: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftColor: colors.primary,
    borderLeftWidth: 3,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  sinAccesosTitulo: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  sinAccesosTexto: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
  },
  jornada: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftColor: colors.primary,
    borderLeftWidth: 3,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginTop: spacing.sm,
    padding: spacing.md,
    ...shadows.sm.movil,
  },
  jornadaTextos: {
    flexShrink: 1,
  },
  jornadaNombre: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  jornadaDetalle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  rejilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  acceso: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexGrow: 1,
    // Dos columnas con el gap de por medio, sin depender de un ancho de pantalla concreto.
    flexBasis: "47%",
    overflow: "hidden",
    padding: spacing.md,
    paddingBottom: spacing.md + 4,
    ...shadows.sm.movil,
  },
  pulsada: {
    opacity: 0.85,
  },
  accesoIcono: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 40,
    justifyContent: "center",
    marginBottom: spacing.sm,
    width: 40,
  },
  accesoNombre: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  accesoDescripcion: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  // La cinta del color del modulo, abajo: es el equivalente movil del filete de la web.
  accesoCinta: {
    bottom: 0,
    height: 3,
    left: 0,
    position: "absolute",
    right: 0,
  },
});
