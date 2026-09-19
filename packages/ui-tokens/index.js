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
// LOS VALORES SALEN DEL PROTOTIPO, LEIDOS DEL PROTOTIPO (issue #700)
//
// docs/DISENO.md dice que para color manda el prototipo de Figma, y admitia que estos valores
// venian de "muestreo de pixel sobre capturas" y convenia que el autor del diseno los confirmara.
// Se confirmaron: **siete de los nueve no coincidian**. No por poco -primary era #2A9C36 y el
// prototipo usa #3DB648- y el muestreo a ojo es exactamente el tipo de error que explica esa
// deriva.
//
// Esta vez no se muestrearon pixeles: se abrio el prototipo publicado y se leyeron los colores
// CALCULADOS de cada elemento, recorriendo sus ocho pantallas. Los cuatro colores de marca
// resultaron ser los cuatro del logo de Ecopac -verde, azul, naranja y magenta-, que es tambien
// el reparto de acentos por modulo que describe DISENO.md.
export const colors = {
  primary: "#3DB648", // Marca, botones principales, elementos activos y estado Disponible
  primaryDark: "#1E7A28", // Extremo oscuro del degradado del banner; hover de botón primario
  primaryLight: "#2D9E3A", // Paso intermedio del degradado del banner (3DB648 -> 2D9E3A -> 1E7A28)
  secondary: "#4D4D4D", // Botones secundarios, bordes e iconos de menor jerarquía
  danger: "#E91E8C", // Crítico: medicamento vencido, sin stock y movimiento rechazado
  warning: "#F7941D", // Próximo a vencer y advertencias que no bloquean
  success: "#3DB648", // Confirmaciones y estado aprobado; misma familia que primary
  info: "#29ABE2", // Estados pendientes y valores informativos
  background: "#F7F8FA", // Fondo general de las pantallas
  surface: "#FFFFFF", // Tarjetas, sidebar y superficies elevadas
  border: "#E2E4E9", // Bordes de tarjeta, separadores y pistas de barra de progreso
  text: "#2D2D2D", // Texto principal, títulos y cuerpo de contenido
  textMuted: "#7A7A8A", // Texto secundario, descripciones y placeholders
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
  colaboradores: colors.info,
  "matriz-permisos": colors.secondary,
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
  // Niveles de alerta del reporte de medicamentos por vencer (issue #700). No salen de un enum de
  // la base: los calcula calcularAlerta() en shared a partir de los dias restantes. Antes el nivel
  // viajaba como un circulo de color dentro de la etiqueta (" Critico"), que ademas de
  // incumplir AGENTS.md dejaba el dato fuera del alcance de un lector de pantalla.
  alto: colors.warning,
  medio: colors.success,
  normal: colors.secondary,
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
/**
 * Radios de esquina (issue #660).
 *
 * En pixeles y no en rem, igual que spacing, porque React Native no entiende rem: theme.js los
 * convierte a variables CSS para la web y el movil los consume tal cual.
 *
 * `pill` es deliberadamente enorme en vez de un 50%: sobre un elemento mas ancho que alto, el
 * porcentaje deforma la curva en una elipse, y un valor grande da la capsula correcta a
 * cualquier ancho.
 */
export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
};

/**
 * Elevaciones (issue #660).
 *
 * Una sola capa y muy baja opacidad, a proposito: la interfaz se usa en jornada, muchas veces a
 * plena luz y en pantallas pequenas, donde una sombra marcada ensucia mas de lo que separa. Lo
 * que tiene que leerse es el contenido, no el borde de la tarjeta.
 *
 * `web` es una cadena de box-shadow. `movil` son las propiedades que React Native entiende:
 * shadowColor/shadowOffset/shadowOpacity/shadowRadius en iOS y elevation en Android.
 */
export const shadows = {
  sm: {
    web: "0 1px 2px rgba(16, 24, 40, 0.06)",
    movil: {
      shadowColor: "#101828",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
      elevation: 1,
    },
  },
  md: {
    web: "0 2px 6px rgba(16, 24, 40, 0.08)",
    movil: {
      shadowColor: "#101828",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
  },
  // Tercera elevacion, para lo que de verdad flota sobre la pantalla: un modal, un desplegable
  // abierto, una tarjeta levantada por el puntero. Sigue siendo una sola capa y sigue siendo
  // baja, por el mismo motivo que las otras dos -la interfaz se usa a plena luz-, pero necesita
  // separarse visiblemente de una tarjeta en reposo, que ya usa `md`.
  lg: {
    web: "0 8px 24px rgba(16, 24, 40, 0.10)",
    movil: {
      shadowColor: "#101828",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 8,
    },
  },
};

export const typography = {
  // La letra del sistema es la unica familia del proyecto: Segoe UI en Windows, San Francisco en
  // macOS e iOS, Roboto en Android. No se descarga ninguna fuente, lo que importa en jornada con
  // datos moviles escasos. "System" es el nombre que entiende React Native; la web no lo
  // reconoce y usa la pila equivalente de fontFamilyWeb.
  fontFamilyBase: "System",
  fontFamilyWeb:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  // Monoespaciada solo para identificadores que se leen caracter por caracter: lote, DPI,
  // correlativo, id de movimiento. Nunca para rotulos ni para texto corrido.
  fontFamilyMonoWeb:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  sizes: {
    // `xxs` es el rotulo de dato en versalitas -"REFERENCIAS", "POR VENCER"-, el unico texto del
    // sistema por debajo del minimo de lectura. Se admite porque no es texto que se lea: es una
    // etiqueta de una cifra que si esta en `xxl` justo debajo. Nunca para contenido.
    xxs: 11,
    xs: 12,
    sm: 14,
    md: 16, // Tamaño base mínimo de lectura para personal en campo
    lg: 20,
    xl: 24,
    // Cifra de una tarjeta de indicador. Existe porque las pantallas la venian escribiendo a
    // mano ("28px" en InventarioPage, "1.75rem" en reportes.css) y cada una eligio la suya.
    xxl: 28,
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
  // Vencimiento de un lote. "Disponible"/"Crítico" servian para una existencia, pero en la
  // columna de vencimiento del reporte de inventario no decian de que hablaban: un lote
  // "Crítico" podia entenderse como poco stock (issue #838). Estas dos nombran el concepto.
  loteVigente: "Vigente",
  loteVencido: "Vencido",
  // Niveles del reporte de medicamentos por vencer (issue #700). "Critico" ya existe arriba y no
  // se duplica: es el mismo texto y el mismo concepto.
  alertaAlto: "Alto",
  alertaMedio: "Medio",
  alertaNormal: "Normal",
  sinStock: "Sin stock",
  usuarioActivo: "Activo",
  usuarioInactivo: "Inactivo",
  // sexo_paciente (00131, issue #699). El valor guardado y la etiqueta coinciden hoy, pero se
  // declaran aqui igual que los demas enums: el dia que la etiqueta cambie -"Mujer"/"Hombre", por
  // decir- se cambia el texto sin tocar la base ni una migracion.
  sexoFemenino: "Femenino",
  sexoMasculino: "Masculino",
  jornadaPlanificada: "Planificada",
  jornadaEnCurso: "En curso",
  jornadaFinalizada: "Finalizada",
  jornadaCancelada: "Cancelada",
  cargando: "Cargando...",
  // Respaldo de <Suspense> mientras se descarga el chunk de una pantalla (issue #708). Es un texto
  // distinto de `cargando` a proposito: lo que espera no es un dato, es el codigo de la pantalla, y
  // las pruebas de enrutado necesitan poder distinguir ese respaldo del estado de carga de dentro.
  cargandoPantalla: "Cargando la pantalla...",
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

/**
 * Identidad de la organizacion, para los documentos que se imprimen (issue #840).
 *
 * POR QUE VIVE AQUI. Estaba escrita a mano y distinta en cada documento: la constancia de
 * donacion decia "Ecopac Digital" mas "Comite Agricola de Desarrollo Integral" -- un nombre que
 * no sale de ninguna tabla ni de ningun catalogo, solo de esa linea de JSX --, y la receta decia
 * "Ecopac Guatemala". Tres identidades para la misma organizacion en papeles que se entregan a
 * un donante o a un paciente.
 *
 * Aqui hay solo lo que se pudo confirmar. Si manana hace falta el NIT, la direccion o el
 * telefono en los documentos, se agregan aqui con su respaldo, no dentro de una pagina.
 *
 * `logo` es la ruta publica de apps/web; movil no imprime todavia y no la usa.
 */
export const organizacion = {
  nombre: "Ecopac Digital",
  pais: "Guatemala",
  logo: "/logo-ecopac.png",
};

export default {
  colors,
  moduleAccents,
  statusColors,
  spacing,
  radii,
  shadows,
  typography,
  labels,
  organizacion,
};
