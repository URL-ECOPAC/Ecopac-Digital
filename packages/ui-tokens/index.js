// Valores de diseño compartidos entre web (Bootstrap) y mobile (StyleSheet de React Native).
// Solo valores puros aquí (colores, espaciado, tipografía, textos comunes) — nada de
// componentes ni lógica.
//
// Los valores de color se midieron sobre el prototipo navegable de Figma:
// https://www.figma.com/make/OMT8OXRXlNdbwwEh4yXGYd/Control-de-inventario?p=f
// Ver docs/DISENO.md para el detalle de cada pantalla.

/**
 * Paleta principal de EcoPac. La marca es verde (matiz ~127°), no azul.
 * Los contrastes de text y textMuted sobre background superan WCAG AA (>= 4.5:1),
 * lo que importa porque las jornadas se atienden en exteriores con luz directa.
 */
export const colors = {
  primary: "#2A9C36", // Marca, botones principales, elementos activos y estado Disponible
  primaryDark: "#1E7E2A", // Extremo oscuro del degradado del banner; hover de botón primario
  primaryLight: "#36AE42", // Extremo claro del degradado del banner
  secondary: "#4B5563", // Botones secundarios, bordes e iconos de menor jerarquía
  danger: "#B81F6F", // Crítico: medicamento vencido, sin stock y movimiento rechazado
  warning: "#F1A239", // Próximo a vencer y advertencias que no bloquean
  success: "#2A9C36", // Confirmaciones y estado aprobado; misma familia que primary
  info: "#3C9CC0", // Estados pendientes y valores informativos
  background: "#F7F8FA", // Fondo general de las pantallas
  surface: "#FFFFFF", // Tarjetas, sidebar y superficies elevadas
  border: "#E9E9E9", // Bordes de tarjeta, separadores y pistas de barra de progreso
  text: "#111827", // Texto principal, títulos y cuerpo de contenido
  textMuted: "#4B5563", // Texto secundario, descripciones y placeholders
};

/**
 * Color de acento con el que el diseño identifica cada módulo en tarjetas,
 * puntos de KPI e iconos de navegación.
 */
export const moduleAccents = {
  pacientes: colors.primary,
  donaciones: colors.info,
  inventario: colors.warning,
  presupuestos: colors.danger,
  proyectos: colors.primary,
  reportes: colors.info,
  jornadas: colors.primary,
  voluntarios: colors.info,
};

/**
 * Color de los chips de estado. Las claves coinciden exactamente con los valores de los
 * enums de supabase/migrations/00001_initial_schema.sql, que son la fuente de verdad.
 */
export const statusColors = {
  // estado_movimiento (movimientos_inventario.estado, supabase/migrations/00023).
  // 00023 elimino y recreo el estado_movimiento original de 00001 con valores mas
  // cortos ('pendiente' en vez de 'pendiente de validacion'): la clave de aqui sigue
  // al enum vigente, no al de 00001.
  pendiente: colors.info,
  aprobado: colors.success,
  rechazado: colors.danger,
  // estado_alerta (alertas_caducidad.estado, 00021)
  atendida: colors.success,
  // estado_jornada
  planificada: colors.info,
  "en curso": colors.primary,
  finalizada: colors.secondary,
  cancelada: colors.danger,
  // estados de existencia, derivados de la fecha de vencimiento
  disponible: colors.success,
  "por vencer": colors.warning,
  critico: colors.danger,
  activo: colors.success,
  inactivo: colors.secondary,
  // estado_donacion (donaciones.estado, supabase/migrations/00022_donantes_donaciones.sql)
  registrada: colors.info,
  anulada: colors.danger,
  // estado_proyecto (proyectos.estado, supabase/migrations/00007_proyectos.sql). Formas
  // MASCULINAS: valores distintos de las femeninas de estado_jornada de arriba, salvo
  // 'en curso', identico en los dos enums.
  planificado: colors.info,
  finalizado: colors.secondary,
  cancelado: colors.danger,
  // estado_receta (recetas.estado, 00066_recetas_anulacion_y_generacion.sql). 'anulada' ya
  // estaba arriba con estado_donacion, que usa el mismo valor y el mismo color.
  emitida: colors.success,
  // estado_condicion_cronica (padecimientos_cronicos.estado, 00010_condiciones_cronicas.sql)
  activa: colors.warning,
  controlada: colors.success,
  resuelta: colors.secondary,
};

/**
 * Escala de espaciado basada en un sistema de 4px / 8px.
 * Valores numéricos puros para permitir unidades nativas (px en web, dp en React Native).
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

/**
 * Configuración de tipografía orientada a alta legibilidad y facilidad de lectura en campo.
 * Tamaño base (md) de 16px/dp conforme a la definición de terminado.
 */
export const typography = {
  fontFamilyBase: "System",
  sizes: {
    xs: 12,
    sm: 14,
    md: 16, // Tamaño base mínimo de lectura para personal en campo
    lg: 20,
    xl: 24,
  },
  weights: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
};

/**
 * Textos y etiquetas comunes compartidos entre web y móvil para evitar duplicación.
 * Los estados coinciden exactamente con los enum de la base de datos.
 */
export const labels = {
  medicamentoVencido: "Medicamento vencido",
  proximoAVencer: "Próximo a vencer",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  disponible: "Disponible",
  critico: "Crítico",
  sinStock: "Sin stock",
  usuarioActivo: "Activo",
  usuarioInactivo: "Inactivo",
  jornadaPlanificada: "Planificada",
  jornadaEnCurso: "En curso",
  jornadaFinalizada: "Finalizada",
  jornadaCancelada: "Cancelada",
  cargando: "Cargando...",
  sinResultados: "No se encontraron resultados",
  errorDeConexion: "Error de conexión con el servidor",
  donacionRegistrada: "Registrada", // estado_donacion (00022_donantes_donaciones.sql)
  donacionAnulada: "Anulada",
  proyectoPlanificado: "Planificado", // estado_proyecto (00007_proyectos.sql), forma masculina
  proyectoFinalizado: "Finalizado",
  proyectoCancelado: "Cancelado",
  // proyecto 'en curso' reutiliza jornadaEnCurso: mismo texto exacto en los dos enums.
  activo: "Activo", // generico: donantes.activo (00022) y cualquier otra entidad con esa misma columna
  inactivo: "Inactivo",
};

export default {
  colors,
  moduleAccents,
  statusColors,
  spacing,
  typography,
  labels,
};
