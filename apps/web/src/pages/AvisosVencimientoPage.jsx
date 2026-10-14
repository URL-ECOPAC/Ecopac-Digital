import { Alert } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { formatearFechaConHora, useConfiguracionAlertasVencimiento } from "@ecopac/shared";

import Card from "../components/Card";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import NumberField from "../components/NumberField";
import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";
import ScreenContainer from "../components/ScreenContainer";
import SecondaryButton from "../components/SecondaryButton";
import { useSesionCompartida } from "../contexto/SesionProvider";

// Avisos de vencimiento (issue #899): con cuantos dias de antelacion se avisa a la administracion
// que un lote va a vencer. Solo en la web, para la administracion o quien tenga el permiso fino
// inventario.configurar_alertas: la ruta cuelga de Inventario y esta pagina lo comprueba, igual
// que /pacientes/duplicados. Quien lo impide de verdad es la
// politica de UPDATE de configuracion_alertas_caducidad (00162).
export default function AvisosVencimientoPage() {
  const navigate = useNavigate();
  const { rol } = useSesionCompartida();
  const config = useConfiguracionAlertasVencimiento({ rolUsuario: rol });

  const volver = { label: "Volver", onClick: () => navigate("/inventario"), variant: "neutra" };

  if (!config.puedeEditar) {
    return (
      <ScreenContainer>
        <PageHeader title="Avisos de vencimiento" actions={[volver]} />
        <ErrorState message="No tienes permiso para configurar los avisos de vencimiento." />
      </ScreenContainer>
    );
  }

  if (config.cargando) {
    return (
      <ScreenContainer>
        <PageHeader title="Avisos de vencimiento" actions={[volver]} />
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (config.error) {
    return (
      <ScreenContainer>
        <PageHeader title="Avisos de vencimiento" actions={[volver]} />
        <ErrorState message={config.error.mensaje} onRetry={config.recargar} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <PageHeader
        title="Avisos de vencimiento"
        subtitle={`Hoy se avisa: ${config.resumen}`}
        actions={[volver]}
      />

      <Card
        title="Antelaciones"
        subtitle={`Agrega solo los avisos previos que necesites, hasta ${config.maximoDeUmbrales}, entre 1 y ${config.diaMaximo} días antes. La administración recibe cada aviso en su buzón y por correo, una sola vez por lote.`}
      >
        {config.errorGuardar && <ErrorState message={config.errorGuardar.mensaje} />}
        {config.errorGeneral && <Alert variant="danger">{config.errorGeneral}</Alert>}
        {config.guardadoEn && (
          <Alert variant="success">
            Configuración guardada. Las alertas ya se actualizaron con los avisos nuevos.
          </Alert>
        )}

        {config.umbrales.length === 0 && (
          <p className="ec-subseccion-vacio mb-3">
            Sin avisos previos: solo se avisa el día que vence.
          </p>
        )}

        {config.umbrales.map((valor, indice) => (
          <div key={indice} className="d-flex align-items-start gap-2">
            <div className="flex-grow-1">
              <NumberField
                label={`Aviso ${indice + 1}`}
                value={valor === "" ? null : Number(valor)}
                onChange={(numero) => config.cambiarUmbral(indice, numero ?? "")}
                min={1}
                max={config.diaMaximo}
                suffix="días antes"
                error={config.errores[indice]}
              />
            </div>
            <div className="pt-4">
              <SecondaryButton
                title="Quitar"
                variant="neutra"
                onClick={() => config.quitarUmbral(indice)}
                disabled={!config.puedeQuitar}
              />
            </div>
          </div>
        ))}

        {/* El aviso del dia del vencimiento no se configura: la base lo envia siempre. */}
        <NumberField
          label="Aviso obligatorio"
          value={0}
          suffix="días: el día que vence"
          disabled
          readOnly
        />

        <div className="ec-form-pie">
          {/* Al llegar al maximo el boton desaparece: ya no hay nada que agregar. */}
          {config.puedeAgregar && (
            <SecondaryButton title="Agregar aviso" onClick={config.agregarUmbral} />
          )}
          <PrimaryButton
            title="Guardar"
            onClick={config.guardar}
            loading={config.guardando}
            disabled={!config.hayCambios}
          />
        </div>

        {config.actualizadoEn && (
          <p className="ec-subseccion-vacio mt-3 mb-0">
            Último cambio: {formatearFechaConHora(config.actualizadoEn)}
            {config.actualizadoPorNombre ? ` por ${config.actualizadoPorNombre}` : ""}
          </p>
        )}
      </Card>
    </ScreenContainer>
  );
}
