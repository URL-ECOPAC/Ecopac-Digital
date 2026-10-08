import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import {
  formatearFechaCorta,
  listarMedicamentos,
  MOTIVO_TRASLADO,
  useRegistroSalida,
} from "@ecopac/shared";
import { colors, moduleAccents, spacing, typography } from "@ecopac/ui-tokens";

import {
  ErrorState,
  NumberField,
  PageHeader,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  Selector,
} from "../components";
import { EnFormulario } from "../components/contextoDeFormulario";
import { useSesionCompartida } from "../contexto/SesionProvider";

function etiquetaDeLote(lote) {
  return [
    `Lote ${lote.numeroLote}`,
    lote.bodega,
    lote.fechaVencimiento ? `vence ${formatearFechaCorta(lote.fechaVencimiento)}` : null,
    `${lote.cantidadDisponible} disponibles`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function RegistroSalidaScreen({ navigation }) {
  const { perfil, rol } = useSesionCompartida();
  const [medicamentos, setMedicamentos] = useState([]);
  const [errorCatalogo, setErrorCatalogo] = useState(null);

  const {
    motivos,
    motivo,
    setMotivo,
    bodegasDestino,
    bodegaDestinoId,
    setBodegaDestinoId,
    medicamentoId,
    setMedicamentoId,
    loteSeleccionado,
    claveLoteSeleccionado,
    seleccionarLotePorClave,
    cantidad,
    setCantidad,
    lotesDisponibles,
    sinExistencia,
    avisoCantidad,
    puedeGuardar,
    error,
    cargando,
    guardarSalida,
  } = useRegistroSalida({
    usuarioId: perfil?.id,
    rol,
    onExito: () => navigation?.goBack(),
  });

  useEffect(() => {
    let vigente = true;

    listarMedicamentos().then((respuesta) => {
      if (!vigente) return;
      setMedicamentos(respuesta.medicamentos ?? []);
      setErrorCatalogo(respuesta.error ?? null);
    });

    return () => {
      vigente = false;
    };
  }, []);

  return (
    <ScreenContainer>
      <PageHeader
        title="Registrar salida"
        subtitle="El lote sugerido es el que vence primero"
        accent={moduleAccents.inventario}
      />

      {errorCatalogo ? <ErrorState message={errorCatalogo.mensaje} /> : null}
      {error ? <Text style={estilos.error}>{error}</Text> : null}

      <Selector
        label="Motivo de la salida"
        requerido
        value={motivo}
        options={motivos}
        onSelect={setMotivo}
        placeholder="Elegir motivo"
        disabled={cargando}
      />

      <Selector
        label="Medicamento"
        requerido
        value={medicamentoId}
        options={medicamentos.map((medicamento) => ({
          value: medicamento.id,
          label: [medicamento.nombre, medicamento.concentracion].filter(Boolean).join(" "),
        }))}
        onSelect={setMedicamentoId}
        placeholder="Elegir medicamento"
        disabled={cargando}
      />

      {/* El valor es lote Y bodega: un lote en dos bodegas daba dos opciones con el mismo valor. */}
      <Selector
        label="Lote"
        requerido
        value={claveLoteSeleccionado}
        options={lotesDisponibles.map((lote) => ({
          value: `${lote.loteId}|${lote.bodegaId ?? ""}`,
          label: etiquetaDeLote(lote),
        }))}
        onSelect={seleccionarLotePorClave}
        placeholder={medicamentoId ? "Elegir lote" : "Primero elige un medicamento"}
        disabled={cargando || !medicamentoId || sinExistencia}
      />

      {/* Issue #911: sin existencia se dice, y el boton no se habilita. */}
      {sinExistencia ? (
        <Text style={estilos.error}>
          No hay existencia de este medicamento. Puede que su ingreso esté pendiente de aprobación,
          que sus lotes ya vencieron, o que ya no quede.
        </Text>
      ) : null}

      {loteSeleccionado ? (
        <Text style={estilos.nota}>
          Quedan {loteSeleccionado.cantidadDisponible} unidades en {loteSeleccionado.bodega}.
        </Text>
      ) : null}

      {/* 00179: un traslado entra a otra bodega; sin ella el inventario desapareceria. */}
      {motivo === MOTIVO_TRASLADO ? (
        <Selector
          label="Bodega destino"
          requerido
          value={bodegaDestinoId || null}
          options={bodegasDestino}
          onSelect={setBodegaDestinoId}
          placeholder="Elegir bodega"
          disabled={cargando}
        />
      ) : null}

      <NumberField
        label="Cantidad a retirar"
        requerido
        value={cantidad}
        onChangeText={setCantidad}
        min={1}
        max={loteSeleccionado?.cantidadDisponible}
        editable={!cargando && !sinExistencia}
        error={avisoCantidad}
      />

      <EnFormulario>
        <PrimaryButton
          title="Registrar salida"
          onPress={guardarSalida}
          loading={cargando}
          disabled={!puedeGuardar}
          style={estilos.accion}
        />
        <SecondaryButton
          title="Cancelar"
          onPress={() => navigation?.goBack()}
          disabled={cargando}
          style={estilos.accion}
        />
      </EnFormulario>
    </ScreenContainer>
  );
}

const estilos = StyleSheet.create({
  error: {
    color: colors.danger,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  nota: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  accion: {
    marginTop: spacing.sm,
  },
});
