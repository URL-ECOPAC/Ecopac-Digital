import {
  ETIQUETAS_ESTADO_DONACION,
  ETIQUETAS_TIPO_DONACION,
  ETIQUETAS_TIPO_DONANTE,
  TIPOS_DE_DONANTE,
  formatearFechaConHora,
  formatearFechaCorta,
  formatearMoneda,
  TIPOS_DE_CAMPO,
  useDonantesPage,
} from "@ecopac/shared";
import { Save, X } from "lucide-react";

import Card from "../components/Card";
import DataList from "../components/DataList";
import ErrorState from "../components/ErrorState";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";
import ScreenContainer from "../components/ScreenContainer";
import SecondaryButton from "../components/SecondaryButton";
import SeccionDeFormulario from "../components/SeccionDeFormulario";
import Selector from "../components/Selector";
import StatCard from "../components/StatCard";
import StatusChip from "../components/StatusChip";
import TextField from "../components/TextField";
import { ACCION_VOLVER_A_DONACIONES } from "./donacionesNavegacion";

function Dato({ etiqueta, valor }) {
  return (
    <div>
      <dt className="ec-rotulo">{etiqueta}</dt>
      <dd className="mb-0">{valor || "—"}</dd>
    </div>
  );
}

function FichaDonante({ donante, historico, onCerrar, onEditar, puedeEscribir }) {
  const donaciones = historico?.donaciones ?? [];
  const totales = historico?.totalesPorTipo ?? {};

  // Ocultar fila de persona de contacto si el donante es de tipo persona
  const esPersona = donante.tipo === TIPOS_DE_DONANTE.PERSONA || donante.tipo === "persona";

  return (
    <Card
      className="mt-4"
      accent="var(--accent-donaciones)"
      title={donante.nombre}
      subtitle={ETIQUETAS_TIPO_DONANTE[donante.tipo] ?? donante.tipo}
      actions={
        <>
          {puedeEscribir && (
            <SecondaryButton title="Editar" size="sm" onClick={() => onEditar(donante)} />
          )}
          <SecondaryButton title="Cerrar" size="sm" variant="neutra" onClick={onCerrar} />
        </>
      }
    >
      <dl className="ec-ficha-datos">
        {!esPersona && <Dato etiqueta="Persona de contacto" valor={donante.contacto} />}
        <Dato etiqueta="Teléfono" valor={donante.telefono} />
        <Dato etiqueta="Correo" valor={donante.email} />
        <Dato etiqueta="Dirección" valor={donante.direccion} />
        <div>
          <dt className="ec-rotulo">Estado</dt>
          <dd className="mb-0">
            <StatusChip
              status={donante.activo ? "activo" : "inactivo"}
              label={donante.activo ? "Activo" : "Inactivo"}
            />
          </dd>
        </div>
        <Dato etiqueta="Registrado el" valor={formatearFechaConHora(donante.created_at)} />
        <Dato etiqueta="Última actualización" valor={formatearFechaConHora(donante.updated_at)} />
      </dl>

      <h2 className="ec-seccion-titulo mt-4">Historico de aportes</h2>

      {!historico ? (
        <p className="ec-cabecera-subtitulo">Cargando el historico...</p>
      ) : (
        <>
          <div className="ec-kpis">
            <StatCard
              label="Dinero"
              value={formatearMoneda(totales.dinero || 0)}
              accent="var(--accent-donaciones)"
              esTexto
            />
            <StatCard
              label="Medicamentos"
              value={totales.medicamentos || 0}
              caption="unidades"
              accent="var(--color-primary)"
            />
            <StatCard
              label="Insumos"
              value={totales.insumos || 0}
              caption="unidades"
              accent="var(--color-warning)"
            />
            <StatCard
              label="Donaciones"
              value={donaciones.length}
              caption="registradas"
              accent="var(--color-info)"
            />
          </div>

          {donaciones.length === 0 ? (
            <p className="ec-cabecera-subtitulo">Este donante todavia no tiene aportes.</p>
          ) : (
            <div className="ec-tabla">
              <table className="table mb-0">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th className="text-end">Monto</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {donaciones.map((donacion) => {
                    const monto = (donacion.detalle ?? []).reduce(
                      (suma, renglon) => suma + Number(renglon.monto || 0),
                      0,
                    );
                    return (
                      <tr key={donacion.id}>
                        <td>{formatearFechaCorta(donacion.fecha)}</td>
                        <td>{ETIQUETAS_TIPO_DONACION[donacion.tipo] ?? donacion.tipo}</td>
                        <td>
                          <StatusChip
                            status={donacion.estado}
                            label={ETIQUETAS_ESTADO_DONACION[donacion.estado] ?? donacion.estado}
                          />
                        </td>
                        <td className="text-end">{monto > 0 ? formatearMoneda(monto) : "—"}</td>
                        <td>{donacion.observaciones || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export default function DonantesPage({ usuarioRol }) {
  const {
    permisos,
    cargando,
    error,
    columnas,
    camposSpec,
    catalogos,
    donantes,
    busqueda,
    setBusqueda,
    filtroTipo,
    setFiltroTipo,
    modalAbierto,
    cerrarModal,
    donanteSeleccionado,
    historicoDelDonante,
    modoEdicion,
    valoresFormulario,
    setCampoFormulario,
    errorFormulario,
    guardando,
    abrirAlta,
    abrirEdicion,
    verFicha,
    guardarDonante,
  } = useDonantesPage({ usuarioRol });

  if (!permisos?.tieneAccesoLectura) {
    return (
      <ScreenContainer>
        <PageHeader title="Administración de donantes" actions={[ACCION_VOLVER_A_DONACIONES]} />
        <ErrorState message="No cuentas con permisos para ver donantes." />
      </ScreenContainer>
    );
  }

  const opcionesDeTipo = [
    { value: "todos", label: "Todos los tipos" },
    ...(catalogos?.tiposDeDonante ?? []),
  ];

  // Comprobar si el tipo seleccionado en el formulario es una persona
  const esTipoPersona =
    valoresFormulario?.tipo === TIPOS_DE_DONANTE.PERSONA || valoresFormulario?.tipo === "persona";

  // Filtrar el campo de contacto/persona de contacto si es tipo persona
  const camposFormularioFiltrados = (camposSpec || [])
    .map((campo) => {
      if (campo.id === "direccion") {
        return { ...campo, tipo: TIPOS_DE_CAMPO.TEXTO_LARGO };
      }
      return campo;
    })
    .filter((campo) => {
      if (esTipoPersona && (campo.id === "contacto" || campo.id === "persona_contacto")) {
        return false;
      }
      return true;
    });

  return (
    <ScreenContainer>
      <PageHeader
        title="Administración de donantes"
        subtitle="Personas y organizaciones que aportan a Ecopac"
        actions={[
          ACCION_VOLVER_A_DONACIONES,
          ...(permisos?.puedeEscribir ? [{ label: "Nuevo donante", onClick: abrirAlta }] : []),
        ]}
      />

      <div className="ec-filtros">
        <div className="ec-filtro ec-filtro--busqueda">
          <TextField
            label="Buscar donante"
            placeholder="Nombre del donante"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ marginBottom: 0 }}
          />
        </div>
        <div className="ec-filtro">
          <Selector
            label="Tipo"
            value={filtroTipo}
            options={opcionesDeTipo}
            onSelect={(valor) => setFiltroTipo(valor ?? "todos")}
            style={{ marginBottom: 0 }}
          />
        </div>
        <div className="ec-filtros-limpiar">
          <SecondaryButton
            title="Limpiar filtros"
            variant="neutra"
            disabled={!busqueda && filtroTipo === "todos"}
            onClick={() => {
              setBusqueda("");
              setFiltroTipo("todos");
            }}
          />
        </div>
      </div>

      {error ? (
        <ErrorState message={error.mensaje} />
      ) : (
        <DataList
          columnas={columnas}
          datos={donantes}
          cargando={cargando}
          vacio="No se encontraron donantes."
          onRowPress={(fila) => verFicha(fila.id)}
          accionSecundaria={
            permisos?.puedeEscribir ? { label: "Editar", onClick: abrirEdicion } : undefined
          }
          catalogos={catalogos}
        />
      )}

      {donanteSeleccionado && !modalAbierto && (
        <FichaDonante
          donante={donanteSeleccionado}
          historico={historicoDelDonante}
          puedeEscribir={permisos?.puedeEscribir}
          onEditar={abrirEdicion}
          onCerrar={() => verFicha(null)}
        />
      )}

      <Modal
        visible={modalAbierto}
        onClose={cerrarModal}
        title={modoEdicion ? "Editar donante" : "Nuevo donante"}
        size="lg"
      >
        {errorFormulario && (
          <div className="alert alert-danger" role="alert">
            {errorFormulario.mensaje}
            {errorFormulario.campos && (
              <ul className="mb-0 mt-2 ps-3">
                {Object.values(errorFormulario.campos).map((mensaje, indice) => (
                  <li key={indice}>{mensaje}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <SeccionDeFormulario
          titulo="Datos del donante"
          descripcion="Quien aporta y como localizarlo."
          acento="var(--accent-donaciones)"
          campos={camposFormularioFiltrados}
          valores={valoresFormulario}
          errores={errorFormulario?.campos ?? {}}
          onChange={setCampoFormulario}
          disabled={guardando}
        />

        <div className="ec-form-pie">
          <SecondaryButton
            title="Cancelar"
            variant="neutra"
            onClick={cerrarModal}
            disabled={guardando}
            icon={<X size={16} aria-hidden="true" />}
          />
          <PrimaryButton
            title={modoEdicion ? "Guardar cambios" : "Registrar donante"}
            onClick={() => guardarDonante(valoresFormulario)}
            loading={guardando}
            icon={<Save size={16} aria-hidden="true" />}
          />
        </div>
      </Modal>
    </ScreenContainer>
  );
}
