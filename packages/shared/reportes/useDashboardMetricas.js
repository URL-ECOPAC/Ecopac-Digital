import { useState, useEffect } from "react";
import { obtenerSupabase } from "../api/cliente.js"; // ✅ Ruta y nombre correctos

export function useDashboardMetricas() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setCargando(true);
        setError(null);

        const supabase = obtenerSupabase(); // ✅ Se obtiene así, no por import directo

        // 📡 Consulta la vista creada en tu migración
        const { data, error: errVista } = await supabase
          .from("vista_reporte_impacto")
          .select(
            `
            jornada_id,
            jornada,
            fecha,
            comunidad_id,
            comunidad,
            pacientes_atendidos,
            consultas_realizadas,
            tratamientos_entregados,
            medicamentos_utilizados
          `,
          )
          .order("fecha", { ascending: true });

        if (errVista) throw errVista;
        if (!data || data.length === 0) {
          setDatos({
            indicadores: {
              pacientesAtendidos: 0,
              comunidadesBeneficiadas: 0,
              tratamientosEntregados: 0,
              medicamentosUtilizados: 0,
            },
            evolucionMensual: [],
            porComunidad: [],
            avisos: { movimientosPendientes: 0, alertasVencimiento: 0 },
          });
          return;
        }

        // 🧮 Cálculo de indicadores totales
        const indicadores = {
          pacientesAtendidos: data.reduce(
            (sum, fila) => sum + Number(fila.pacientes_atendidos || 0),
            0,
          ),
          comunidadesBeneficiadas: new Set(data.map((f) => f.comunidad_id)).size,
          tratamientosEntregados: data.reduce(
            (sum, fila) => sum + Number(fila.tratamientos_entregados || 0),
            0,
          ),
          medicamentosUtilizados: data.reduce(
            (sum, fila) => sum + Number(fila.medicamentos_utilizados || 0),
            0,
          ),
        };

        // 📈 Evolución mensual de atenciones
        const porMes = {};
        data.forEach((fila) => {
          const fecha = new Date(fila.fecha);
          if (isNaN(fecha.getTime())) return;
          const claveMes = fecha.toLocaleDateString("es-GT", { month: "short" });
          if (!porMes[claveMes]) porMes[claveMes] = { mes: claveMes, cantidad: 0 };
          porMes[claveMes].cantidad += Number(fila.pacientes_atendidos || 0);
        });
        const evolucionMensual = Object.values(porMes);

        // 📊 Atenciones por comunidad
        const porComunidad = {};
        data.forEach((fila) => {
          const nombre = fila.comunidad || "Sin comunidad";
          if (!porComunidad[nombre]) porComunidad[nombre] = { nombre, cantidad: 0 };
          porComunidad[nombre].cantidad += Number(fila.pacientes_atendidos || 0);
        });
        const listaPorComunidad = Object.values(porComunidad);

        // ⚠️ Avisos (se conectan después desde inventario)
        const avisos = {
          movimientosPendientes: 0,
          alertasVencimiento: 0,
        };

        setDatos({
          indicadores,
          evolucionMensual,
          porComunidad: listaPorComunidad,
          avisos,
        });
      } catch (err) {
        console.error("Error cargando dashboard:", err);
        setError("No se pudo cargar el tablero de métricas. Intente más tarde.");
      } finally {
        setCargando(false);
      }
    };

    cargarDatos();
  }, []);

  return {
    datos,
    cargando,
    error,
    indicadores: datos?.indicadores || {},
    evolucionMensual: datos?.evolucionMensual || [],
    porComunidad: datos?.porComunidad || [],
    avisos: datos?.avisos || { movimientosPendientes: 0, alertasVencimiento: 0 },
  };
}
