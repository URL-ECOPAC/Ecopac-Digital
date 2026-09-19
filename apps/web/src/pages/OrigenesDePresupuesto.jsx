import { Plus } from "lucide-react";

import {
  COLUMNAS_ORIGEN_PRESUPUESTO,
  formatearMoneda,
  useOrigenesDePresupuesto,
} from "@ecopac/shared";

import CampoDeFormulario from "../components/CampoDeFormulario";
import { Card, DataList, ErrorState, PrimaryButton } from "../components";

// De donde viene el presupuesto de una jornada (issue #840, bloque D).
//
// Hasta la 00135 el presupuesto era un numero suelto que se editaba en el resumen de la jornada,
// sin forma de saber de donde habia salido. Ahora es la suma de estos aportes -la calcula la
// base-, y cada uno dice si viene de una donacion, de fondos propios o de un aporte externo. Lo
// que existia antes aparece como "Sin clasificar": es el dato historico, no se le inventa origen.
//
// Todo sale de useOrigenesDePresupuesto() en packages/shared: los campos, sus errores, el catalogo
// de donaciones con saldo y el monto que se llena solo al elegir una. Aqui solo se dibuja.
export default function OrigenesDePresupuesto({ jornadaId, proyectoId, rol, alCambiar }) {
  const {
    permisos,
    origenes,
    total,
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
  } = useOrigenesDePresupuesto({ jornadaId, proyectoId, rol, alCambiar });

  if (error) {
    return <ErrorState message={error.mensaje} onRetry={recargar} />;
  }

  return (
    <>
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
            permisos.puedeGestionar
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

      {permisos.puedeGestionar && (
        <Card title="Registrar un aporte">
          {errorAlGuardar && (
            <div className="alert alert-danger" role="alert">
              {errorAlGuardar.mensaje}
            </div>
          )}
          <div className="ec-form-grid">
            {campos.map((campo) => (
              <CampoDeFormulario
                key={campo.id}
                campo={campo}
                valor={valores[campo.id]}
                error={errores[campo.id]}
                catalogos={catalogos}
                disabled={guardando}
                onChange={(valor) => setCampo(campo.id, valor)}
              />
            ))}
          </div>
          {campos.some((campo) => campo.id === "donacionId") &&
            catalogos.donacionesDisponibles.length === 0 && (
              <p className="ec-campo-nota">
                No hay donaciones de dinero con saldo por asignar. Se registran en Donaciones.
              </p>
            )}
          <div className="ec-form-pie">
            <PrimaryButton
              title="Agregar aporte"
              icon={<Plus size={16} aria-hidden="true" />}
              onClick={registrar}
              loading={guardando}
            />
          </div>
        </Card>
      )}
    </>
  );
}
