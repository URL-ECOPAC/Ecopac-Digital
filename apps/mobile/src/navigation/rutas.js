// Nombres de ruta del navegador, en su propio archivo para que una pantalla pueda
// importarlos sin depender de AppNavigator, que a su vez importa las pantallas.
export const ROUTES = {
  LOGIN: 'Login',
  TABS: 'Tabs',

  // Tabs (los cinco destinos del diseno)
  TAB_INICIO: 'Inicio',
  TAB_PACIENTES: 'Pacientes',
  TAB_JORNADAS: 'Jornadas',
  TAB_INVENTARIO: 'Inventario',
  TAB_AJUSTES: 'Ajustes',

  // Pantallas dentro de cada stack
  INICIO: 'InicioPanel',
  DONACIONES: 'Donaciones',
  PROYECTOS: 'Proyectos',
  PRESUPUESTOS: 'Presupuestos',
  VOLUNTARIOS: 'Voluntarios',
  BUSQUEDA_PACIENTE: 'BusquedaPaciente',
  FICHA_PACIENTE: 'FichaPaciente',
  HISTORIAL_PACIENTE: 'HistorialPaciente',
  REGISTRO_PACIENTE: 'RegistroPaciente',
  TRIAJE: 'Triaje',
  CONSULTA: 'Consulta',
  RECETA: 'Receta',
  SELECCION_JORNADA: 'SeleccionJornada',
  JORNADA_EN_CURSO: 'JornadaEnCurso',
  STOCK: 'Stock',
};
