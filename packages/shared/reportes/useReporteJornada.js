// packages/shared/reportes/useReporteJornada.js
import { useState, useEffect } from "react";

export function useReporteJornada(jornadaId) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    if (!jornadaId) return;

    const cargar = async () => {
      try {
        setCargando(true);
        setError(null);

        // TODO: Reemplazar por llamadas reales a API
        setDatos({
          jornada: {
            id: jornadaId,
            nombre: "Jornada Comunidad Ejemplo",
            fecha: "2026-08-28",
            comunidad_id: "---",
            responsable_id: "---",
            proyecto_id: null,
            estado: "completada",
            presupuesto_asignado: 1500.00,
          },
          pacientesAtendidos: 47,
          diagnosticos: [
            { nombre: "Hipertensión Arterial", cantidad: 12 },
            { nombre: "Gastritis / Gastritis Crónica", cantidad: 9 },
            { nombre: "Diabetes Mellitus", cantidad: 7 },
            { nombre: "Infección de Vías Respiratorias", cantidad: 6 },
            { nombre: "Anemia / Deficiencia de Hierro", cantidad: 5 },
          ],
          medicamentos: [
            { nombre: "Losartán 50mg", cantidad: 68 },
            { nombre: "Metformina 850mg", cantidad: 45 },
            { nombre: "Omeprazol 20mg", cantidad: 38 },
            { nombre: "Paracetamol 500mg", cantidad: 32 },
            { nombre: "Ácido Fólico", cantidad: 24 },
          ],
          personal: [
            {
              nombre: "Dr. Juan Pérez",
              rol_en_jornada: "MEDICO",
              hora_inicio: "08:00",
              hora_fin: "12:00",
              responsabilidad: "Consulta General",
              atenciones: 18,
            },
            {
              nombre: "Dra. María López",
              rol_en_jornada: "MEDICO",
              hora_inicio: "08:30",
              hora_fin: "12:30",
              responsabilidad: "Consulta General",
              atenciones: 15,
            },
            {
              nombre: "Enf. Carlos Ruiz",
              rol_en_jornada: "ENFERMERIA",
              hora_inicio: "08:00",
              hora_fin: "13:00",
              responsabilidad: "Toma de signos",
              atenciones: 22,
            },
            {
              nombre: "Vol. Ana García",
              rol_en_jornada: "APOYO",
              hora_inicio: "08:00",
              hora_fin: "13:00",
              responsabilidad: "Registro y apoyo",
              atenciones: 12,
            },
          ],
        });
      } catch (err) {
        setError(err.message || "Error al cargar el reporte");
      } finally {
        setCargando(false);
      }
    };

    cargar();
  }, [jornadaId]);

  const imprimir = () => {
    window.print();
  };

  const exportar = () => {
    if (!datos) return;
    const contenido = JSON.stringify(datos, null, 2);
    const blob = new Blob([contenido], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-jornada-${jornadaId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    cargando,
    error,
    datos,
    imprimir,
    exportar,
  };
}