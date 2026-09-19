import { useState } from "react";
import { ChevronDown, ChevronUp, LineChart } from "lucide-react";

import {
  anularReceta,
  formatearFechaCorta,
  partesDeVisita,
  puedeAnularReceta,
  useRecetasPaciente,
  useVisitasPaciente,
} from "@ecopac/shared";

import Card from "../components/Card";
import DateField from "../components/DateField";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import SecondaryButton from "../components/SecondaryButton";
import PestaniaSignosPaciente from "./PestaniaSignosPaciente";
import RecetaImprimible from "./RecetaImprimible";
import TarjetaReceta, { useImpresionDeReceta } from "./TarjetaReceta";

// El historial clinico como lista de visitas (issue #840, bloque F).
//
// Antes eran eventos sueltos -triaje, consulta, receta- agrupados por jornada, con los signos y
// las recetas ademas en pestanas hermanas. Ahora cada visita es una unidad: se abre y trae dentro
// sus signos, su consulta y su receta. Editarla abre el mismo formulario con el que se registro
// (ModalConsulta), no uno distinto por pieza.

const ETIQUETAS_DE_SIGNOS = [
  ["presion", "Presión"],
  ["frecuenciaCardiaca", "Frecuencia cardiaca", "lpm"],
  ["temperatura", "Temperatura", "°C"],
  ["glucosa", "Glucosa", "mg/dL"],
  ["peso", "Peso", "kg"],
  ["talla", "Talla", "cm"],
  ["imc", "IMC"],
];

function Signos({ signos }) {
  const renglones = ETIQUETAS_DE_SIGNOS.map(([id, etiqueta, unidad]) => {
    if (id === "presion") {
      return signos.presionSistolica && signos.presionDiastolica
        ? [etiqueta, `${signos.presionSistolica}/${signos.presionDiastolica} mmHg`]
        : null;
    }
    const valor = signos[id];
    return valor === null || valor === undefined
      ? null
      : [etiqueta, unidad ? `${valor} ${unidad}` : valor];
  }).filter(Boolean);

  return (
    <dl className="row mb-0">
      {renglones.map(([etiqueta, valor]) => (
        <div className="col-sm-4 mb-2" key={etiqueta}>
          <dt className="pac-rotulo">{etiqueta}</dt>
          <dd className="mb-0">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function Consulta({ consulta }) {
  const campos = [
    ["Motivo de consulta", consulta.motivoConsulta],
    ["Antecedentes", consulta.antecedentes],
    ["Síntomas", consulta.sintomas],
    ["Exploración", consulta.exploracion],
    ["Tratamiento", consulta.tratamiento],
    ["Observaciones", consulta.observaciones],
    ["Plan de seguimiento", consulta.planSeguimiento],
  ].filter(([, valor]) => valor);

  return (
    <>
      {consulta.diagnosticos?.length > 0 && (
        <p className="mb-2">
          <span className="pac-rotulo">Diagnósticos </span>
          {consulta.diagnosticos
            .map((diagnostico) =>
              [diagnostico.codigo, diagnostico.nombre].filter(Boolean).join(" "),
            )
            .join(", ")}
        </p>
      )}
      {campos.map(([etiqueta, valor]) => (
        <p className="mb-2" key={etiqueta}>
          <span className="pac-rotulo">{etiqueta} </span>
          {valor}
        </p>
      ))}
      {consulta.profesional && <p className="pac-dato-mono mb-0">Atendió {consulta.profesional}</p>}
    </>
  );
}

function ParteDeVisita({ titulo, children }) {
  return (
    <div className="pac-visita-parte">
      <p className="pac-visita-parte-titulo">{titulo}</p>
      {children}
    </div>
  );
}

function Visita({ visita, abierta, onAlternar, onEditar, recetasPorId, receta }) {
  const partes = partesDeVisita(visita);

  return (
    <Card style={{ marginBottom: "1rem" }}>
      <div className="d-flex flex-wrap align-items-start gap-2">
        <div>
          <strong>{visita.jornada ?? "Visita sin jornada"}</strong>
          {visita.comunidad && <span className="text-body-secondary"> · {visita.comunidad}</span>}
          <div className="pac-fecha">{formatearFechaCorta(visita.fecha)}</div>
          {visita.diagnosticoPrincipal && (
            <div className="mt-1">{visita.diagnosticoPrincipal.nombre}</div>
          )}
          <div className="d-flex flex-wrap gap-1 mt-2" aria-label="Partes de la visita">
            <span
              className={`ec-chip ${partes.signos ? "pac-chip--presente" : "pac-chip--ausente"}`}
            >
              Signos
            </span>
            <span
              className={`ec-chip ${partes.consulta ? "pac-chip--presente" : "pac-chip--ausente"}`}
            >
              Consulta
            </span>
            <span
              className={`ec-chip ${partes.receta ? "pac-chip--presente" : "pac-chip--ausente"}`}
            >
              Receta
            </span>
          </div>
        </div>
        <div className="d-flex gap-2 ms-auto">
          {onEditar && (
            <SecondaryButton title="Editar" size="sm" onClick={() => onEditar(visita)} />
          )}
          <SecondaryButton
            title={abierta ? "Cerrar" : "Abrir"}
            variant="neutra"
            size="sm"
            icon={
              abierta ? (
                <ChevronUp size={16} aria-hidden="true" />
              ) : (
                <ChevronDown size={16} aria-hidden="true" />
              )
            }
            onClick={onAlternar}
            aria-expanded={abierta}
          />
        </div>
      </div>

      {abierta && (
        <div className="mt-3">
          <ParteDeVisita titulo="Signos vitales">
            {visita.signos ? (
              <Signos signos={visita.signos} />
            ) : (
              <p className="text-body-secondary mb-0">No se tomaron signos en esta visita.</p>
            )}
          </ParteDeVisita>

          <ParteDeVisita titulo="Consulta">
            {visita.consulta ? (
              <Consulta consulta={visita.consulta} />
            ) : (
              <p className="text-body-secondary mb-0">Sin consulta registrada.</p>
            )}
          </ParteDeVisita>

          <ParteDeVisita titulo="Receta">
            {visita.recetas.length === 0 && <p className="text-body-secondary mb-0">Sin receta.</p>}
            {visita.recetas.map((resumen) => {
              const completa = recetasPorId.get(resumen.id);
              return completa ? (
                <TarjetaReceta
                  key={resumen.id}
                  receta={completa}
                  onImprimir={receta.imprimir}
                  puedeAnular={receta.puedeAnular(completa)}
                  onAnular={receta.anular}
                />
              ) : (
                <p key={resumen.id} className="mb-0">
                  Receta {resumen.folio}
                </p>
              );
            })}
          </ParteDeVisita>

          {visita.cerradaEn && (
            <p className="pac-dato-mono mb-0 mt-2">
              Visita cerrada el {formatearFechaCorta(visita.cerradaEn)}
              {visita.motivoCierre ? `: ${visita.motivoCierre}` : ""}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

export default function PestaniaHistorialPaciente({ paciente, rol, perfilId, onEditarVisita }) {
  const { visitas, filtros, setFiltro, limpiarFiltros, hayFiltros, cargando, error, recargar } =
    useVisitasPaciente(paciente?.id, { rol });
  const recetas = useRecetasPaciente(paciente?.id, { rol });
  const { aImprimir, imprimir } = useImpresionDeReceta();
  // La visita mas reciente se abre sola: es la que casi siempre se viene a ver.
  const [abiertas, setAbiertas] = useState(() => new Set());
  const [primeraAbierta, setPrimeraAbierta] = useState(false);
  const [viendoEvolucion, setViendoEvolucion] = useState(false);

  if (!primeraAbierta && visitas.length > 0) {
    setPrimeraAbierta(true);
    setAbiertas(new Set([visitas[0].atencionId]));
  }

  const alternar = (id) =>
    setAbiertas((anteriores) => {
      const siguiente = new Set(anteriores);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  const recetasPorId = new Map(recetas.recetas.map((receta) => [receta.id, receta]));
  const accionesDeReceta = {
    imprimir,
    puedeAnular: (receta) => puedeAnularReceta(rol, receta, perfilId),
    anular: async (recetaId, motivo) => {
      const respuesta = await anularReceta(recetaId, { motivo, anuladaPor: perfilId });
      if (!respuesta.error) await Promise.all([recargar(), recetas.recargar()]);
      return respuesta;
    },
  };

  return (
    <div>
      <div className="d-flex flex-wrap align-items-end gap-3 mb-3">
        <DateField
          label="Desde"
          value={filtros.desde || null}
          onChange={(valor) => setFiltro("desde", valor)}
          maxDate={filtros.hasta || undefined}
        />
        <DateField
          label="Hasta"
          value={filtros.hasta || null}
          onChange={(valor) => setFiltro("hasta", valor)}
          minDate={filtros.desde || undefined}
        />
        {hayFiltros && <SecondaryButton title="Limpiar" onClick={limpiarFiltros} />}
        <div className="ms-auto">
          <SecondaryButton
            title={viendoEvolucion ? "Ver las visitas" : "Ver la evolución de los signos"}
            variant="neutra"
            icon={<LineChart size={16} aria-hidden="true" />}
            onClick={() => setViendoEvolucion((valor) => !valor)}
            aria-pressed={viendoEvolucion}
          />
        </div>
      </div>

      {viendoEvolucion ? (
        <PestaniaSignosPaciente pacienteId={paciente?.id} rol={rol} />
      ) : (
        <>
          {cargando && <LoadingState />}
          {!cargando && error && <ErrorState message={error.mensaje} onRetry={recargar} />}
          {!cargando && !error && visitas.length === 0 && (
            <EmptyState
              message={
                hayFiltros
                  ? "Ninguna visita coincide con las fechas elegidas."
                  : "Este paciente todavía no tiene visitas registradas."
              }
              actionLabel={hayFiltros ? "Limpiar filtros" : undefined}
              onAction={hayFiltros ? limpiarFiltros : undefined}
            />
          )}
          {!cargando &&
            !error &&
            visitas.map((visita) => (
              <Visita
                key={visita.atencionId}
                visita={visita}
                abierta={abiertas.has(visita.atencionId)}
                onAlternar={() => alternar(visita.atencionId)}
                onEditar={onEditarVisita}
                recetasPorId={recetasPorId}
                receta={accionesDeReceta}
              />
            ))}
        </>
      )}

      {aImprimir && <RecetaImprimible receta={aImprimir} paciente={paciente} />}
    </div>
  );
}
