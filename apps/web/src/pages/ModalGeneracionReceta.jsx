import { useMemo, useState } from "react";

import {
  describirExistencia,
  formatearFechaCorta,
  TIPOS_DE_EVENTO,
  useGeneracionReceta,
  useHistorialPaciente,
} from "@ecopac/shared";

import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import { X } from "lucide-react";
import Modal from "../components/Modal";
import NumberField from "../components/NumberField";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import Selector from "../components/Selector";
import TextField from "../components/TextField";

// Emision de una receta desde la ficha del paciente, en web.
//
// A DIFERENCIA DEL TRIAJE Y LA CONSULTA, esta no necesita jornada: una receta cuelga de una
// CONSULTA (00019), y la consulta ya trae su atencion y su jornada. Lo que si necesita es saber
// DE CUAL consulta, y esa es la unica pieza que movil resuelve por navegacion -RecetaScreen se
// abre desde la consulta recien guardada, con el id en la ruta- y aqui no existe: a la ficha se
// entra desde el listado de pacientes, sin ninguna consulta abierta.
//
// Se resuelve ofreciendo las consultas del propio historial del paciente, la mas reciente
// primero y preseleccionada, que es el caso normal: se receta sobre lo que se acaba de
// diagnosticar. `consultaFijada` deja saltarse ese paso cuando el modal se abre justo despues de
// guardar una consulta.
//
// Todo lo demas -catalogo con existencias, lotes disponibles, validacion de cada renglon y la
// emision atomica de fn_generar_receta (00112), que descuenta inventario en la misma
// transaccion- es useGeneracionReceta, sin tocar.

export default function ModalGeneracionReceta({
  paciente,
  rol,
  perfilId,
  consultaFijada = null,
  onClose,
  onGenerada,
}) {
  const historial = useHistorialPaciente(paciente?.id, { rol });
  const [consultaElegida, setConsultaElegida] = useState(consultaFijada);

  const consultas = useMemo(
    () => historial.eventos.filter((evento) => evento.tipo === TIPOS_DE_EVENTO.CONSULTA),
    [historial.eventos],
  );

  // La mas reciente ya viene primero del historial, asi que basta con la primera.
  const consultaId = consultaElegida ?? consultas[0]?.id ?? null;

  const opcionesDeConsulta = consultas.map((consulta) => ({
    value: consulta.id,
    label: [
      formatearFechaCorta(consulta.fecha),
      consulta.diagnosticoPrincipal?.nombre ?? consulta.motivoConsulta ?? "Consulta",
    ]
      .filter(Boolean)
      .join(" - "),
  }));

  const {
    busqueda,
    setBusqueda,
    catalogo,
    cargandoCatalogo,
    lotesPorMedicamento,
    renglones,
    problemas,
    indicacionesGenerales,
    setIndicacionesGenerales,
    error,
    enviando,
    agregarMedicamento,
    editarRenglon,
    quitarRenglon,
    guardar,
  } = useGeneracionReceta({ consultaId, perfilId });

  const [avisoDeCatalogo, setAvisoDeCatalogo] = useState(null);

  const agregar = async (medicamento) => {
    const resultado = await agregarMedicamento(medicamento);
    setAvisoDeCatalogo(resultado.ok ? null : resultado.motivo);
  };

  const generar = async () => {
    const resultado = await guardar();
    if (resultado.ok) {
      await onGenerada?.(resultado.receta);
      onClose?.();
    }
  };

  return (
    <Modal visible onClose={onClose} title="Generar receta" size="xl">
      {historial.cargando && <LoadingState message="Buscando las consultas del paciente..." />}

      {!historial.cargando && consultas.length === 0 && (
        <EmptyState
          message={
            "Una receta se emite sobre una consulta, y este paciente todavia no tiene ninguna " +
            "registrada. Registra primero la consulta desde la pestania de historial clinico."
          }
        />
      )}

      {!historial.cargando && consultas.length > 0 && (
        <>
          {!consultaFijada && (
            <Selector
              label="Consulta sobre la que se receta"
              value={consultaId}
              options={opcionesDeConsulta}
              onSelect={setConsultaElegida}
              placeholder="Elige la consulta"
            />
          )}

          {error && (
            <div className="alert alert-danger" role="alert">
              {error.mensaje}
            </div>
          )}

          <section className="ec-form-seccion" style={{ "--ec-acento": "var(--accent-pacientes)" }}>
            <div className="ec-form-seccion-cabecera">
              <h3 className="ec-form-seccion-titulo">Medicamentos</h3>
            </div>

            <TextField
              label="Buscar en el catalogo"
              placeholder="Nombre, concentración o marca"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
            />

            {avisoDeCatalogo && (
              <div className="alert alert-warning" role="status">
                {avisoDeCatalogo}
              </div>
            )}

            {cargandoCatalogo && <LoadingState message="Consultando existencias..." />}

            {!cargandoCatalogo && (
              <div className="ec-tabla mb-3" style={{ maxHeight: "220px", overflowY: "auto" }}>
                <table className="table mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Medicamento</th>
                      <th scope="col">Disponible</th>
                      <th scope="col" aria-hidden="true" />
                    </tr>
                  </thead>
                  <tbody>
                    {catalogo.map((medicamento) => (
                      <tr key={medicamento.id}>
                        <td>{describirExistencia(medicamento)}</td>
                        <td>{medicamento.cantidadDisponible}</td>
                        <td className="text-end">
                          <SecondaryButton
                            size="sm"
                            title="Agregar"
                            onClick={() => agregar(medicamento)}
                            disabled={!medicamento.seleccionable}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {renglones.length === 0 && (
              <p className="text-body-secondary mb-0">
                Todavia no hay medicamentos en la receta. Agrega al menos uno.
              </p>
            )}

            {renglones.map((renglon) => {
              const lotes = lotesPorMedicamento[renglon.medicamentoId] ?? [];

              return (
                <div className="ec-tabla p-3 mb-3" key={renglon.clave}>
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <strong>{renglon.medicamento}</strong>
                    <SecondaryButton
                      size="sm"
                      variant="peligro"
                      title="Quitar"
                      onClick={() => quitarRenglon(renglon.clave)}
                    />
                  </div>

                  <div className="ec-form-grid">
                    <Selector
                      label="Lote"
                      value={renglon.loteId}
                      options={lotes.map((lote) => ({
                        value: lote.loteId,
                        label: `${lote.numeroLote ?? "Sin numero"} · vence ${formatearFechaCorta(
                          lote.fechaVencimiento,
                        )} · ${lote.cantidadDisponible} u.`,
                      }))}
                      onSelect={(valor) => {
                        const lote = lotes.find((fila) => fila.loteId === valor);
                        editarRenglon(renglon.clave, "loteId", valor);
                        // La bodega viaja junto al lote: existencias esta particionada por
                        // (lote, bodega) desde la 00047, y fn_generar_receta la exige.
                        editarRenglon(renglon.clave, "bodegaId", lote?.bodegaId ?? null);
                      }}
                      placeholder="Elige el lote"
                    />
                    <TextField
                      label="Dosis"
                      value={renglon.dosis}
                      onChange={(evento) =>
                        editarRenglon(renglon.clave, "dosis", evento.target.value)
                      }
                    />
                    <TextField
                      label="Frecuencia"
                      value={renglon.frecuencia}
                      onChange={(evento) =>
                        editarRenglon(renglon.clave, "frecuencia", evento.target.value)
                      }
                    />
                    <TextField
                      label="Duración"
                      value={renglon.duracion}
                      onChange={(evento) =>
                        editarRenglon(renglon.clave, "duracion", evento.target.value)
                      }
                    />
                    <NumberField
                      label="Cantidad a entregar"
                      min={1}
                      value={
                        renglon.cantidadEntregada === "" ? null : Number(renglon.cantidadEntregada)
                      }
                      onChange={(valor) =>
                        editarRenglon(renglon.clave, "cantidadEntregada", valor ?? "")
                      }
                    />
                  </div>

                  {problemas[renglon.clave] && (
                    <p className="text-danger small mb-0">{problemas[renglon.clave]}</p>
                  )}
                </div>
              );
            })}
          </section>

          <section className="ec-form-seccion" style={{ "--ec-acento": "var(--accent-pacientes)" }}>
            <div className="ec-form-seccion-cabecera">
              <h3 className="ec-form-seccion-titulo">Indicaciones</h3>
            </div>
            <TextField
              label="Indicaciones generales"
              as="textarea"
              rows={3}
              value={indicacionesGenerales}
              onChange={(evento) => setIndicacionesGenerales(evento.target.value)}
            />
          </section>

          <div className="ec-acciones ec-acciones--fin mt-4">
            <SecondaryButton
              title="Cancelar"
              variant="neutra"
              onClick={onClose}
              disabled={enviando}
              icon={<X size={16} aria-hidden="true" />}
            />
            <PrimaryButton
              title="Generar receta"
              onClick={generar}
              loading={enviando}
              disabled={!consultaId || renglones.length === 0}
            />
          </div>
        </>
      )}
    </Modal>
  );
}
