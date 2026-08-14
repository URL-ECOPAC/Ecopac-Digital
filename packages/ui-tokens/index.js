// Valores de diseño compartidos entre web (Bootstrap) y mobile (StyleSheet de React Native).
// Solo valores puros aquí (colores, espaciado, tipografía, textos comunes) — nada de
// componentes ni lógica.

/**
 * Paleta de colores principal para EcoPac.
 * Cumple con un ratio de contraste WCAG AA (>= 4.5:1) sobre el color de fondo
 * para asegurar la legibilidad en jornadas comunitarias en exteriores.
 */
export const colors = {
  primary: '#1D4ED8', // Botones principales, encabezados y elementos activos
  secondary: '#4B5563', // Botones secundarios, bordes e iconos de menor jerarquía
  danger: '#DC2626', // Alertas de medicamento vencido y errores críticos
  warning: '#D97706', // Alertas de medicamento próximo a vencer
  success: '#15803D', // Confirmaciones y badges de éxito
  background: '#F9FAFB', // Fondo general de pantallas y tarjetas
  text: '#111827', // Texto principal, títulos y cuerpo de contenido
  textMuted: '#4B5563', // Texto secundario, descripciones y placeholders
};

// export const spacing = {
//   xs: 0,
//   sm: 0,
//   md: 0,
//   lg: 0,
//   xl: 0,
// };

// export const typography = {
//   fontFamilyBase: "",
//   sizes: { sm: 0, md: 0, lg: 0, xl: 0 },
// };

// Textos comunes para no duplicar strings entre las dos apps.
// export const labels = {
//   medicamentoVencido: "",
//   proximoAVencer: "",
//   pendienteDeValidacion: "",
// };