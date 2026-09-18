// Nombres de ruta del navegador, en su propio archivo para que una pantalla pueda
// importarlos sin depender de AppNavigator, que a su vez importa las pantallas.
export const ROUTES = {
  AUTH: "Auth",
  LOGIN: "Login",
  RESTABLECER_CONTRASENA: "RestablecerContrasena",
  TABS: "Tabs",

  // Tabs
  TAB_INICIO: "Inicio",
  TAB_PACIENTES: "Pacientes",
  TAB_JORNADAS: "Jornadas",
  TAB_INVENTARIO: "Inventario",
  TAB_AJUSTES: "Ajustes",

  // Pantallas dentro de cada stack
  INICIO: "InicioPanel",
  ACCESO_DENEGADO: "AccesoDenegado",
  DONACIONES: "Donaciones",
  PROYECTOS: "Proyectos",
  // PRESUPUESTOS: "Presupuestos", // ← Se mantiene aquí, se retira solo del menú móvil
  COLABORADORES: "Colaboradores",
  FICHA_COLABORADOR: "FichaColaborador",
  COMUNIDADES: "Comunidades",

  BUSQUEDA_PACIENTE: "BusquedaPaciente",
  FICHA_PACIENTE: "FichaPaciente",
  HISTORIAL_PACIENTE: "HistorialPaciente",
  REGISTRO_PACIENTE: "RegistroPaciente",
  TRIAJE: "Triaje",
  CONSULTA: "Consulta",
  RECETA: "Receta",

  SELECCION_JORNADA: "SeleccionJornada",
  JORNADA_EN_CURSO: "JornadaEnCurso",
  JORNADAS_ASIGNADAS: "JornadasAsignadas",
  KANBAN_JORNADAS: "KanbanJornadas", //  NUEVA RUTA AGREGADA

  STOCK: "Stock",
  REGISTRO_INGRESO: "RegistroIngreso",
  EXISTENCIAS_INVENTARIO: "ExistenciasInventario",
  RESUMEN_ALERTAS_INVENTARIO: "ResumenAlertasInventario",
  MIS_MOVIMIENTOS: "MisMovimientos",
  DETALLE_LOTE: "DetalleLote",
};
