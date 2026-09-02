import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ProgressBar } from "react-bootstrap";
import { typography } from "@ecopac/ui-tokens";

import {
  Card,
  FilterBar,
  KanbanBoard,
  PageHeader,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  StatusChip,
} from "../components";

const TRANSICIONES_PERMITIDAS = {
  planificada: ["en_curso", "cancelado"],
  en_curso: ["finalizada", "cancelado", "planificada"],
  finalizada: ["en_curso"],
  cancelado: ["planificada"],
};

export default function ProyectosPage() {
  const navigate = useNavigate();

  // Estado inicial de proyectos
  const [columnas, setColumnas] = useState([
    {
      id: "planificada",
      titulo: "Planificada",
      label: "Planificada",
      tarjetas: [
        {
          id: "1",
          nombre: "Salud Comunitaria Guatemala 2024",
          descripcion: "Programa integral de atención médica primaria y jornadas preventivas.",
          comunidad: "Guatemala",
          fecha: "12/05/2026",
          responsable: "Dr. A. Juárez",
          presupuesto: "Q 45,000",
          estado: "planificada",
          porcentajeAvance: 25,
          jornadasIniciales: [
            { id: "j1", estado: "completada", presupuesto: 15000, beneficiarios: 150 },
            { id: "j2", estado: "planificada", presupuesto: 15000, beneficiarios: 100 },
            { id: "j3", estado: "planificada", presupuesto: 15000, beneficiarios: 100 },
          ],
          hitosIniciales: [
            { id: "h1", nombre: "Diagnóstico comunitario", esCumplido: true, fechaPrevista: "10/04/2026", fechaReal: "08/04/2026" },
            { id: "h2", nombre: "Primera jornada médica", esCumplido: false, fechaPrevista: "12/05/2026", esVencido: false },
          ],
          bitacoraInicial: [
            { id: "b1", nota: "Se completó la fase preliminar de empadronamiento comunitario.", registradoPor: "Dr. A. Juárez", createdAt: "2026-04-15T10:00:00Z" },
          ],
        },
      ],
    },
    {
      id: "en_curso",
      titulo: "En curso",
      label: "En curso",
      tarjetas: [
        {
          id: "2",
          nombre: "Educación y Desarrollo Rural",
          descripcion: "Capacitación en técnicas agrícolas sostenibles y equipamiento educativo.",
          comunidad: "Quetzaltenango",
          fecha: "18/06/2026",
          responsable: "Dra. P. Vargas",
          presupuesto: "Q 80,000",
          estado: "en_curso",
          porcentajeAvance: 60,
          jornadasIniciales: [
            { id: "j4", estado: "completada", presupuesto: 40000, beneficiarios: 600 },
            { id: "j5", estado: "completada", presupuesto: 40000, beneficiarios: 600 },
          ],
          hitosIniciales: [
            { id: "h3", nombre: "Talleres en escuelas", esCumplido: true, fechaPrevista: "01/05/2026" },
          ],
          bitacoraInicial: [],
        },
      ],
    },
    {
      id: "finalizada",
      titulo: "Finalizada",
      label: "Finalizada",
      tarjetas: [
        {
          id: "3",
          nombre: "Nutrición Infantil — Verapaz",
          descripcion: "Evaluación nutricional y entrega de suplementos alimenticios.",
          comunidad: "Alta Verapaz",
          fecha: "01/04/2026",
          responsable: "Lic. R. Fuentes",
          presupuesto: "Q 120,000",
          estado: "finalizada",
          porcentajeAvance: 100,
          jornadasIniciales: [
            { id: "j6", estado: "completada", presupuesto: 60000, beneficiarios: 1250 },
            { id: "j7", estado: "completada", presupuesto: 60000, beneficiarios: 1250 },
          ],
          hitosIniciales: [],
          bitacoraInicial: [],
        },
      ],
    },
    {
      id: "cancelado",
      titulo: "Cancelado",
      label: "Cancelado",
      tarjetas: [],
    },
  ]);

  // Estado del toolbar
  const [filtros, setFiltros] = useState({ estado: "", comunidad: "" });

  const handleFilterChange = (campoOEvento, valorDirecto) => {
    if (typeof campoOEvento === "string") {
      setFiltros((prev) => ({ ...prev, [campoOEvento]: valorDirecto }));
    } else if (campoOEvento?.target) {
      const { name, id, value } = campoOEvento.target;
      setFiltros((prev) => ({ ...prev, [name || id]: value }));
    } else if (typeof campoOEvento === "object" && campoOEvento !== null) {
      setFiltros((prev) => ({ ...prev, ...campoOEvento }));
    }
  };

  // Filtrado de columnas
  const columnasFiltradas = useMemo(() => {
    return columnas.map((col) => {
      if (filtros.estado && filtros.estado !== "" && col.id !== filtros.estado) {
        return { ...col, tarjetas: [] };
      }

      const tarjetasFiltradas = col.tarjetas.filter((tarjeta) => {
        if (filtros.comunidad && filtros.comunidad !== "") {
          return tarjeta.comunidad === filtros.comunidad;
        }
        return true;
      });

      return { ...col, tarjetas: tarjetasFiltradas };
    });
  }, [columnas, filtros]);

  const total = columnasFiltradas.reduce((acc, col) => acc + (col.tarjetas?.length || 0), 0);

  const moverProyecto = (idProyecto, estadoOrigen, estadoDestino = null) => {
    const flujoSiguiente = {
      planificada: "en_curso",
      en_curso: "finalizada",
      finalizada: "cancelado",
    };
    const nuevoEstado = estadoDestino || flujoSiguiente[estadoOrigen];

    const permitidos = TRANSICIONES_PERMITIDAS[estadoOrigen] || [];
    if (!nuevoEstado || !permitidos.includes(nuevoEstado)) return;

    setColumnas((prev) => {
      let tarjetaAMover = null;
      const columnasSinTarjeta = prev.map((col) => {
        const encontrada = col.tarjetas.find((t) => t.id === idProyecto);
        if (encontrada) tarjetaAMover = { ...encontrada, estado: nuevoEstado };
        return {
          ...col,
          tarjetas: col.tarjetas.filter((t) => t.id !== idProyecto),
        };
      });

      if (!tarjetaAMover) return prev;

      return columnasSinTarjeta.map((col) => {
        if (col.id === nuevoEstado) {
          return { ...col, tarjetas: [...col.tarjetas, tarjetaAMover] };
        }
        return col;
      });
    });
  };

  const filtrosDelTablero = [
    {
      id: "estado",
      name: "estado",
      label: "Estado",
      tipo: "select",
      opciones: [
        { value: "", label: "Todos" },
        { value: "planificada", label: "Planificada" },
        { value: "en_curso", label: "En curso" },
        { value: "finalizada", label: "Finalizada" },
        { value: "cancelado", label: "Cancelado" },
      ],
      options: [
        { value: "", label: "Todos" },
        { value: "planificada", label: "Planificada" },
        { value: "en_curso", label: "En curso" },
        { value: "finalizada", label: "Finalizada" },
        { value: "cancelado", label: "Cancelado" },
      ],
    },
    {
      id: "comunidad",
      name: "comunidad",
      label: "Comunidad",
      tipo: "select",
      opciones: [
        { value: "", label: "Todos" },
        { value: "Guatemala", label: "Guatemala" },
        { value: "Quetzaltenango", label: "Quetzaltenango" },
        { value: "Alta Verapaz", label: "Alta Verapaz" },
      ],
      options: [
        { value: "", label: "Todos" },
        { value: "Guatemala", label: "Guatemala" },
        { value: "Quetzaltenango", label: "Quetzaltenango" },
        { value: "Alta Verapaz", label: "Alta Verapaz" },
      ],
    },
  ];

  const irAProyectoSeguimiento = (tarjeta, modo = "ver") => {
    navigate(`/proyectos/${tarjeta.id}/seguimiento`, {
      state: {
        proyecto: tarjeta,
        proyectoInicial: tarjeta,
        jornadasIniciales: tarjeta.jornadasIniciales || [],
        hitosIniciales: tarjeta.hitosIniciales || [],
        bitacoraInicial: tarjeta.bitacoraInicial || [],
        modo,
      },
    });
  };

  return (
    <ScreenContainer scrollable={false}>
      <PageHeader
        title="Proyectos"
        subtitle={`${total} proyectos`}
        actions={[{ label: "Nuevo proyecto", onClick: () => navigate("/proyectos/sociales") }]}
      />

      <FilterBar
        campos={filtrosDelTablero}
        valores={filtros}
        onChange={handleFilterChange}
        onFilterChange={handleFilterChange}
      />

      <KanbanBoard
        columnas={columnasFiltradas}
        onMover={moverProyecto}
        mensajeVacio="Sin proyectos"
        columnaAtenuada={(id) => id === "cancelado"}
        renderTarjeta={(tarjeta) => (
          <TarjetaProyecto
            proyecto={tarjeta}
            onEditar={() => irAProyectoSeguimiento(tarjeta, "editar")}
            onMover={moverProyecto}
            onVerDetalle={() => irAProyectoSeguimiento(tarjeta, "ver")}
          />
        )}
      />
    </ScreenContainer>
  );
}

// Helper para determinar el color del borde izquierdo
function colorDeEstado(estado) {
  const estadoLimpio = String(estado).toLowerCase().replace(/_/g, " ").trim();

  if (estadoLimpio === "en curso") {
    return "#28a745"; // Verde alineado al módulo de Jornadas
  }

  return `var(--estado-${estadoLimpio.replace(/ /g, "-")}, var(--color-secondary))`;
}

function TarjetaProyecto({ proyecto, onEditar, onMover, onVerDetalle }) {
  const porcentajeAvance = proyecto.porcentajeAvance || 0;
  const esFinalizado = proyecto.estado === "finalizada" || proyecto.estado === "finalizado";

  // Formato para que StatusChip lo renderice en verde
  const estadoStatusChip = proyecto.estado === "en_curso" ? "en curso" : proyecto.estado;

  return (
    <Card style={{ borderLeft: `4px solid ${colorDeEstado(proyecto.estado)}` }}>
      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
        <span className="fw-bold">{proyecto.nombre}</span>
        <StatusChip status={estadoStatusChip} />
      </div>

      <div className="small mb-1" style={{ color: "var(--color-text-muted)" }}>
        {proyecto.comunidad || "—"} · {proyecto.fecha}
      </div>

      <div className="small fw-semibold mb-1" style={{ color: "var(--color-text-main)" }}>
        Presupuesto: {proyecto.presupuesto || "Q0"}
      </div>

      <div className="mb-2" style={{ color: "var(--color-text-muted)", fontSize: typography.sizes.xs }}>
        Responsable: {proyecto.responsable || "—"}
      </div>

      <div className="mb-2">
        <div className="d-flex align-items-center gap-2">
          <ProgressBar now={porcentajeAvance} variant="primary" style={{ height: "6px", flex: "1 1 auto" }} />
          <span className="small" style={{ color: "var(--color-text-muted)" }}>{porcentajeAvance}%</span>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center gap-2 mt-2">
        <div className="d-flex gap-2">
          <SecondaryButton title="Ver detalle" onClick={onVerDetalle} />
          {esFinalizado && (
            <SecondaryButton title="← Atrás" onClick={() => onMover(proyecto.id, proyecto.estado, "en_curso")} />
          )}
        </div>
        <div className="d-flex gap-2">
          {onEditar && <SecondaryButton title="Editar" onClick={onEditar} />}
          {!esFinalizado && (
            <PrimaryButton title="Avanzar →" onClick={() => onMover(proyecto.id, proyecto.estado)} />
          )}
        </div>
      </div>
    </Card>
  );
}