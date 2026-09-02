export const CAMPOS_DASHBOARD = {
  pacientesAtendidos: {
    etiqueta: "Pacientes Atendidos",
    tipo: "numero",
    descripcion: "Total de personas atendidas en las jornadas",
  },
  comunidadesBeneficiadas: {
    etiqueta: "Comunidades Beneficiadas",
    tipo: "numero",
    descripcion: "Cantidad de comunidades cubiertas",
  },
  tratamientosEntregados: {
    etiqueta: "Tratamientos Entregados",
    tipo: "numero",
    descripcion: "Total de recetas/tratamientos entregados",
  },
  medicamentosUtilizados: {
    etiqueta: "Medicamentos Utilizados",
    tipo: "numero",
    descripcion: "Unidades de medicamento dispensadas",
  },
  movimientosPendientes: {
    etiqueta: "Movimientos por Validar",
    tipo: "numero",
    enlace: "/inventario?tab=validacion",
  },
  alertasVencimiento: {
    etiqueta: "Lotes por Vencer",
    tipo: "numero",
    enlace: "/inventario?tab=alertas",
  },
};

export const COLORES_GRAFICAS = {
  evolucion: "#059669",
  comunidad: ["#059669", "#0891b2", "#d97706", "#4f46e5", "#64748b", "#ec4899"],
  alerta: "#d97706",
  pendiente: "#0891b2",
};
