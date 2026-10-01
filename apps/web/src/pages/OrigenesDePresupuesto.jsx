import { useState } from "react";
import { Plus, X } from "lucide-react";

import {
  COLUMNAS_ORIGEN_PRESUPUESTO,
  formatearMoneda,
  ORIGENES_DE_PRESUPUESTO,
  useOrigenesDePresupuesto,
} from "@ecopac/shared";

import CampoDeFormulario from "../components/CampoDeFormulario";
import {
  Card,
  DataList,
  ErrorState,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "../components";
import { EnFormulario } from "../components/contextoDeFormulario";

// De donde viene el presupuesto de una jornada (issue #840, bloque D).
//
// "Crear quien aporta" (00149) reemplaza a "+ Crear opcion", que abria un modal y cerraba sin
// guardar nada: el origen es un enum de la base y no se le pueden sumar valores. Lo que se crea es
// una fuente de aporte externo -la municipalidad, una empresa-, que queda elegida en el formulario.

function AltaDeFuente({ creando, error, onCrear, onCancelar }) {
  const [nombre, setNombre] = useState("");

  return (
    <div className="ec-form-grid--ancho mt-2">
      <TextField
        label="Quién aporta"
        placeholder="Ej. Municipalidad de San Juan"
        value={nombre}
        onChange={(evento) => setNombre(evento.target.value)}
        error={error?.mensaje}
        disabled={creando}
        autoFocus
      />
      <div className="ec-acciones">
        <PrimaryButton
          title="Guardar"
          size="sm"
          onClick={async () => {
            if (await onCrear(nombre)) setNombre("");
          }}
          loading={creando}
          disabled={!nombre.trim()}
        />
        <SecondaryButton
          title="Cancelar"
          variant="neutra"
          size="sm"
          icon={<X size={14} aria-hidden="true" />}
          onClick={onCancelar}
          disabled={creando}
        />
      </div>
    </div>
  );
}

// `soloConsulta`: la jornada esta finalizada. El formulario queda a la vista, deshabilitado, y la
// lista sin "Quitar".
export default function OrigenesDePresupuesto({
  jornadaId,
  proyectoId,
  rol,
  alCambiar,
  soloConsulta = false,
}) {
  const {
    permisos,
    origenes,
    total,
    saldoDeCaja,
    cargando,
    error,
    recargar,
    campos,
    catalogos,
    valores,
    setCampo,
    errores,
    errorAlGuardar,
    guardando,
    registrar,
    quitar,
    quitandoId,
    crearFuente,
    creandoFuente,
    errorFuente,
    limpiarErrorFuente,
  } = useOrigenesDePresupuesto({ jornadaId, proyectoId, rol, alCambiar });

  const [creandoFuenteNueva, setCreandoFuenteNueva] = useState(false);

  if (error) {
    return <ErrorState message={error.mensaje} onRetry={recargar} />;
  }

  const cerrarAltaDeFuente = () => {
    setCreandoFuenteNueva(false);
    limpiarErrorFuente();
  };

  return (
    // Dos secciones con aire entre ellas: la lista de aportes y el formulario para registrar uno.
    <div className="d-flex flex-column gap-4">
      <Card title={`Presupuesto: ${formatearMoneda(total) ?? formatearMoneda(0)}`}>
        <p className="text-body-secondary small mb-3">
          El presupuesto de la jornada es la suma de estos aportes. Para cambiarlo se registra o se
          quita un aporte; el total no se escribe a mano.
        </p>
        <DataList
          columnas={COLUMNAS_ORIGEN_PRESUPUESTO}
          datos={origenes}
          cargando={cargando}
          vacio="Esta jornada todavía no tiene presupuesto."
          accionSecundaria={
            permisos?.puedeGestionar && !soloConsulta
              ? {
                  label: "Quitar",
                  onClick: (fila) => {
                    if (quitandoId) return;
                    quitar(fila.id);
                  },
                }
              : undefined
          }
        />
      </Card>

      {permisos?.puedeGestionar && (
        <Card title="Registrar un aporte">
          {errorAlGuardar && (
            <div className="alert alert-danger" role="alert">
              {errorAlGuardar.mensaje}
            </div>
          )}
          <EnFormulario>
            <div className="ec-form-grid">
              {campos.map((campo) => (
                <div key={campo.id} className="d-flex flex-column">
                  <CampoDeFormulario
                    campo={campo}
                    valor={valores[campo.id]}
                    error={errores[campo.id]}
                    catalogos={catalogos}
                    disabled={guardando || soloConsulta}
                    onChange={(valor) => setCampo(campo.id, valor)}
                  />
                  {campo.id === "origen" && !creandoFuenteNueva && (
                    <div className="mt-2">
                      <SecondaryButton
                        title="Crear quién aporta"
                        size="sm"
                        icon={<Plus size={14} aria-hidden="true" />}
                        onClick={() => setCreandoFuenteNueva(true)}
                        disabled={guardando || soloConsulta}
                      />
                    </div>
                  )}
                  {campo.id === "origen" && creandoFuenteNueva && !soloConsulta && (
                    <AltaDeFuente
                      creando={creandoFuente}
                      error={errorFuente}
                      onCrear={async (nombre) => {
                        const creada = await crearFuente(nombre);
                        if (creada) setCreandoFuenteNueva(false);
                        return creada;
                      }}
                      onCancelar={cerrarAltaDeFuente}
                    />
                  )}
                </div>
              ))}
            </div>
            {valores.origen === ORIGENES_DE_PRESUPUESTO.CAJA && saldoDeCaja !== null && (
              <p className="ec-campo-nota">
                En la caja hay {formatearMoneda(saldoDeCaja)}: el sobrante de las jornadas que no
                vuelve a una donación.
              </p>
            )}
            {campos.some((campo) => campo.id === "donacionId") &&
              catalogos?.donacionesDisponibles?.length === 0 && (
                <p className="ec-campo-nota">
                  No hay donaciones de dinero con saldo por asignar. Se registran en Donaciones.
                </p>
              )}
            <div className="ec-form-pie">
              <PrimaryButton
                title="Agregar aporte"
                onClick={registrar}
                loading={guardando}
                disabled={soloConsulta}
              />
            </div>
          </EnFormulario>
        </Card>
      )}
    </div>
  );
}
