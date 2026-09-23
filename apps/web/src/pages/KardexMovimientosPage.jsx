import { useEffect, useMemo, useState } from "react";
import { Table } from "react-bootstrap";
import {
  ESTADO_MOVIMIENTO,
  ETIQUETAS_ESTADO_MOVIMIENTO,
  exportarFilasACSV,
  formatearFechaConHora,
  listarLotes,
  resumenDeKardex,
  TIPO_MOVIMIENTO,
  TIPOS_DE_PRESENTACION,
  useKardexMovimientos,
} from "@ecopac/shared";

import BotonExportarPDF from "../components/BotonExportarPDF";
import DateField from "../components/DateField";
import SectionHeader from "../components/SectionHeader";
import SecondaryButton from "../components/SecondaryButton";
import Selector from "../components/Selector";
import StatusChip from "../components/StatusChip";
import DocumentoImprimible from "./DocumentoImprimible";

// Kardex de movimientos de inventario.
//
// Tenia su propia paleta (un objeto `colores` con siete hexadecimales), su propia tarjeta, sus
// propios <input>/<select> y una tabla con cada celda estilizada en linea. Ahora usa la barra de
// filtros, la tabla y los chips de estado de todo el sistema. Lo que no cambia: la columna de
// saldo, la marca de aprobacion automatica y el CSV.

const ETIQUETAS_TIPO = {
  [TIPO_MOVIMIENTO.INGRESO]: "Ingreso",
  [TIPO_MOVIMIENTO.SALIDA]: "Salida",
};

const OPCIONES_TIPO = [
  { value: TIPO_MOVIMIENTO.INGRESO, label: "Ingresos" },
  { value: TIPO_MOVIMIENTO.SALIDA, label: "Salidas" },
];

// Tipo como chip palido del color de su sentido: entra en verde, sale en ambar. Un valor que no es
// ninguno de los dos (un "ajuste" heredado) se muestra tal cual, en neutro. Sin
// dangerouslySetInnerHTML: React escapa el texto.
function EtiquetaTipo({ tipo }) {
  const acento =
    tipo === TIPO_MOVIMIENTO.INGRESO
      ? "var(--color-success)"
      : tipo === TIPO_MOVIMIENTO.SALIDA
        ? "var(--color-warning)"
        : "var(--color-secondary)";
  return (
    <span className="ec-chip" style={{ "--ec-acento": acento }}>
      {ETIQUETAS_TIPO[tipo] ?? tipo}
    </span>
  );
}

const COLUMNAS_CSV_KARDEX = [
  { id: "created_at", label: "Fecha registro", tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: "tipo", label: "Tipo" },
  { id: "cantidad", label: "Cantidad", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  { id: "bodega_nombre", label: "Bodega" },
  { id: "motivo", label: "Motivo" },
  { id: "registrado_por_nombre", label: "Registrado por" },
  { id: "aprobado_por_nombre", label: "Aprobado por" },
  { id: "aprobado_en", label: "Fecha aprobación", tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: "estado", label: "Estado" },
  { id: "motivo_rechazo", label: "Motivo de rechazo" },
  { id: "saldoAcumulado", label: "Saldo", tipo: TIPOS_DE_PRESENTACION.NUMERO },
];

/** Descarga el CSV. Vive aca porque toca document, Blob y URL, que shared no puede tocar. */
function descargarCSV(movimientos) {
  const blob = new Blob([exportarFilasACSV(movimientos, COLUMNAS_CSV_KARDEX)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "kardex-movimientos.csv";
  enlace.click();
  URL.revokeObjectURL(url);
}

export default function KardexMovimientosPage({
  loteId = null,
  medicamentoId = null,
  titulo = "Historial de Movimientos",
}) {
  // Uso embebido (un padre ya sabe que lote o medicamento mostrar, ej. una futura pantalla de
  // detalle de lote): se respeta el id que llega por prop y no se ofrece selector propio -- ese
  // caso no cambia. Uso general (pestana "Kardex" de InventarioPage, sin props): sin id,
  // useKardexMovimientos nunca llamaba a listarMovimientos() y la pestana quedaba siempre vacia
  // sin ninguna forma de elegir un lote desde la pantalla.
  const usaSeleccionPropia = loteId === null && medicamentoId === null;

  const [loteSeleccionadoId, setLoteSeleccionadoId] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [cargandoLotes, setCargandoLotes] = useState(false);
  const [errorLotes, setErrorLotes] = useState(null);

  useEffect(() => {
    if (!usaSeleccionPropia) return;

    let vigente = true;
    setCargandoLotes(true);
    listarLotes().then(({ lotes: datos, error: errorDeListado }) => {
      if (!vigente) return;
      setLotes(datos ?? []);
      setErrorLotes(errorDeListado);
      setCargandoLotes(false);
    });
    return () => {
      vigente = false;
    };
  }, [usaSeleccionPropia]);

  // Mismo criterio de etiqueta que valoresDeCorreccionDeMovimiento() (useMisMovimientos.js):
  // "Medicamento · Lote NNN".
  const opcionesDeLote = useMemo(
    () =>
      [...lotes]
        .sort((a, b) => (a.medicamento ?? "").localeCompare(b.medicamento ?? ""))
        .map((lote) => ({
          value: lote.id,
          label: [lote.medicamento, lote.numeroLote && `Lote ${lote.numeroLote}`]
            .filter(Boolean)
            .join(" · "),
        })),
    [lotes],
  );

  const { movimientos, cargando, error, filtros, setFiltros } = useKardexMovimientos({
    loteId: usaSeleccionPropia ? loteSeleccionadoId : loteId,
    medicamentoId,
  });

  const formatoFecha = (fechaIso) => (fechaIso ? formatearFechaConHora(fechaIso) : "—");

  // Exportar PDF: se monta el documento imprimible (portal sobre document.body), se abre el
  // dialogo de impresion del navegador y se desmonta al terminar. Mismo mecanismo que el cuadro
  // de turnos de una jornada; el usuario elige "Guardar como PDF".
  const [aImprimir, setAImprimir] = useState(false);

  useEffect(() => {
    if (!aImprimir) return undefined;

    const limpiar = () => setAImprimir(false);
    window.addEventListener("afterprint", limpiar);
    const cuadro = window.requestAnimationFrame(() => window.print());

    return () => {
      window.removeEventListener("afterprint", limpiar);
      window.cancelAnimationFrame(cuadro);
    };
  }, [aImprimir]);

  const resumen = useMemo(() => resumenDeKardex(movimientos), [movimientos]);
  const loteImpreso = opcionesDeLote.find((opcion) => opcion.value === loteSeleccionadoId);
  const descripcionDeFiltros = [
    usaSeleccionPropia && loteImpreso ? loteImpreso.label : null,
    filtros.fechaDesde || filtros.fechaHasta
      ? `${filtros.fechaDesde || "—"} al ${filtros.fechaHasta || "—"}`
      : "Todo el histórico",
    filtros.tipoMovimiento && filtros.tipoMovimiento !== "todos"
      ? ETIQUETAS_TIPO[filtros.tipoMovimiento]
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const hayFiltros = Boolean(
    filtros.fechaDesde ||
    filtros.fechaHasta ||
    (filtros.tipoMovimiento && filtros.tipoMovimiento !== "todos"),
  );

  return (
    <div>
      <SectionHeader
        title={titulo}
        subtitle={
          <>
            Historial cronológico • Solo movimientos <strong>aprobados</strong> afectan el saldo
          </>
        }
        actions={[
          {
            label: "Exportar historial",
            onClick: () => descargarCSV(movimientos),
            disabled: movimientos.length === 0,
            variant: "secondary",
          },
          {
            custom: (
              <BotonExportarPDF
                onClick={() => setAImprimir(true)}
                generando={aImprimir}
                disabled={movimientos.length === 0}
              />
            ),
          },
        ]}
      />

      <div className="ec-filtros">
        {usaSeleccionPropia && (
          <div className="ec-filtro">
            <Selector
              label="Lote"
              value={loteSeleccionadoId}
              options={opcionesDeLote}
              onSelect={setLoteSeleccionadoId}
              placeholder={cargandoLotes ? "Cargando lotes..." : "Selecciona un lote"}
              disabled={cargandoLotes}
              error={errorLotes ? "No se pudo cargar la lista de lotes." : undefined}
              style={{ marginBottom: 0 }}
            />
          </div>
        )}
        <fieldset className="ec-filtro ec-filtro--rango">
          <legend className="form-label">Fecha</legend>
          <div className="ec-rango-doble">
            <DateField
              aria-label="Fecha desde"
              value={filtros.fechaDesde || null}
              onChange={(valor) => setFiltros({ ...filtros, fechaDesde: valor ?? "" })}
              style={{ marginBottom: 0 }}
            />
            <span className="ec-rango-separador" aria-hidden="true">
              -
            </span>
            <DateField
              aria-label="Fecha hasta"
              value={filtros.fechaHasta || null}
              onChange={(valor) => setFiltros({ ...filtros, fechaHasta: valor ?? "" })}
              style={{ marginBottom: 0 }}
            />
          </div>
        </fieldset>
        <div className="ec-filtro">
          <Selector
            label="Tipo de movimiento"
            value={filtros.tipoMovimiento === "todos" ? null : filtros.tipoMovimiento}
            options={OPCIONES_TIPO}
            onSelect={(valor) => setFiltros({ ...filtros, tipoMovimiento: valor ?? "todos" })}
            placeholder="Todos los tipos"
            style={{ marginBottom: 0 }}
          />
        </div>
        <div className="ec-filtros-limpiar">
          <SecondaryButton
            title="Limpiar filtros"
            variant="neutra"
            disabled={!hayFiltros}
            onClick={() =>
              setFiltros({ ...filtros, fechaDesde: "", fechaHasta: "", tipoMovimiento: "todos" })
            }
          />
        </div>
      </div>

      {cargando ? (
        <p className="ec-subseccion-vacio text-center">Cargando movimientos...</p>
      ) : error ? (
        <div className="alert alert-danger" role="alert">
          No se pudo cargar el historial. {error.mensaje}
        </div>
      ) : movimientos.length === 0 ? (
        <p className="ec-subseccion-vacio text-center">
          No hay movimientos registrados. Seleccione un lote o medicamento para ver su historial.
        </p>
      ) : (
        <div className="ec-tabla">
          <Table responsive hover className="mb-0">
            <thead>
              <tr>
                <th>Fecha registro</th>
                <th>Tipo</th>
                <th className="text-end">Cantidad</th>
                <th>Motivo</th>
                <th>Bodega</th>
                <th>Registrado por</th>
                <th>Aprobado por</th>
                <th>Fecha aprobación</th>
                <th>Estado</th>
                <th className="text-end">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((mov) => (
                <tr key={mov.id}>
                  <td className="text-body-secondary">{formatoFecha(mov.created_at)}</td>
                  <td>
                    <EtiquetaTipo tipo={mov.tipo} />
                  </td>
                  <td className="text-end fw-semibold">
                    {mov.tipo === TIPO_MOVIMIENTO.INGRESO ? "+" : ""}
                    {mov.cantidad}
                  </td>
                  <td>{mov.motivo}</td>
                  <td>{mov.bodega_nombre || "—"}</td>
                  <td>{mov.registrado_por_nombre || "—"}</td>
                  <td>
                    {mov.aprobado_por_nombre || "Pendiente"}
                    {/* aprobacion_automatica (00028): TRUE cuando quien registro el movimiento era
                        administrador y el trigger lo aprobo solo. */}
                    {mov.aprobacion_automatica && (
                      <span className="small text-body-secondary"> (automático)</span>
                    )}
                  </td>
                  <td className="text-body-secondary">{formatoFecha(mov.aprobado_en)}</td>
                  <td>
                    <StatusChip
                      status={mov.estado}
                      label={ETIQUETAS_ESTADO_MOVIMIENTO[mov.estado] ?? mov.estado}
                    />
                    {mov.estado === ESTADO_MOVIMIENTO.RECHAZADO && mov.motivo_rechazo && (
                      <span className="d-block small text-body-secondary mt-1">
                        Motivo: {mov.motivo_rechazo}
                      </span>
                    )}
                  </td>
                  <td
                    className={`text-end fw-bold ${mov.afectaSaldo ? "" : "text-body-secondary"}`}
                  >
                    {mov.saldoAcumulado}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <p className="small text-body-secondary mt-3 mb-0">
        Solo los movimientos aprobados modifican el saldo; los pendientes y los rechazados no.
      </p>

      {aImprimir && (
        <DocumentoImprimible documento="Kardex de movimientos" fecha={new Date().toISOString()}>
          <p className="doc-imprimible__periodo">{descripcionDeFiltros}</p>
          <div className="doc-imprimible__kpis">
            {[
              ["Movimientos", resumen.movimientos],
              ["Ingresos aprobados", resumen.ingresos],
              ["Salidas aprobadas", resumen.salidas],
              ["Saldo", resumen.saldo],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="doc-imprimible__kpi">
                <span className="doc-imprimible__kpi-etiqueta">{etiqueta}</span>
                <span className="doc-imprimible__kpi-valor">{valor}</span>
              </div>
            ))}
          </div>
          <table>
            <thead>
              <tr>
                <th>Fecha registro</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Motivo</th>
                <th>Bodega</th>
                <th>Registrado por</th>
                <th>Aprobado por</th>
                <th>Estado</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((mov) => (
                <tr key={mov.id}>
                  <td>{formatoFecha(mov.created_at)}</td>
                  <td>{ETIQUETAS_TIPO[mov.tipo] ?? mov.tipo}</td>
                  <td>
                    {mov.tipo === TIPO_MOVIMIENTO.INGRESO ? "+" : ""}
                    {mov.cantidad}
                  </td>
                  <td>{mov.motivo}</td>
                  <td>{mov.bodega_nombre || "—"}</td>
                  <td>{mov.registrado_por_nombre || "—"}</td>
                  <td>{mov.aprobado_por_nombre || "Pendiente"}</td>
                  <td>{ETIQUETAS_ESTADO_MOVIMIENTO[mov.estado] ?? mov.estado}</td>
                  <td>{mov.saldoAcumulado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DocumentoImprimible>
      )}
    </div>
  );
}
