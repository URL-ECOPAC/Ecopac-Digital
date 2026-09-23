import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  ETIQUETAS_TIPO_MOVIMIENTO,
  formatearFechaCorta,
  permisosDeMovimientos,
  usePendientesValidacion,
} from "@ecopac/shared";
import { colors, moduleAccents, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  StatusChip,
  TextField,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";

function nombreDeQuienRegistro(movimiento) {
  const nombre = [movimiento.registradoPor?.nombres, movimiento.registradoPor?.apellidos]
    .filter(Boolean)
    .join(" ");
  return nombre || "Sin registrar quién";
}

export default function ValidacionMovimientosScreen() {
  const { perfil } = useSesionCompartida();
  const rolUsuario = perfil?.rol;

  const { pendientes, cargando, error, aprobar, rechazar, recargar } = usePendientesValidacion({
    usuarioId: perfil?.id,
    rolUsuario,
  });
  const { puedeAprobar, puedeRechazar } = permisosDeMovimientos(rolUsuario);

  const [procesandoId, setProcesandoId] = useState(null);
  const [errorAccion, setErrorAccion] = useState(null);
  const [rechazando, setRechazando] = useState(null);
  const [motivo, setMotivo] = useState("");

  const confirmarAprobacion = async (movimiento) => {
    setProcesandoId(movimiento.id);
    setErrorAccion(null);

    const respuesta = await aprobar(movimiento.id);
    if (respuesta.error) setErrorAccion(respuesta.error.mensaje);

    setProcesandoId(null);
  };

  const confirmarRechazo = async () => {
    const movimiento = rechazando;
    setProcesandoId(movimiento.id);
    setErrorAccion(null);

    const respuesta = await rechazar(movimiento.id, motivo.trim());

    setProcesandoId(null);
    if (respuesta.error) {
      setErrorAccion(respuesta.error.mensaje);
      return;
    }
    setRechazando(null);
    setMotivo("");
  };

  if (cargando && pendientes.length === 0) {
    return (
      <ScreenContainer>
        <LoadingState message="Buscando movimientos pendientes..." />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <PageHeader
        title="Por aprobar"
        subtitle={
          pendientes.length === 1
            ? "1 movimiento espera tu aprobación"
            : `${pendientes.length} movimientos esperan tu aprobación`
        }
        accent={moduleAccents.inventario}
      />

      {errorAccion ? <ErrorState message={errorAccion} /> : null}

      {pendientes.length === 0 ? (
        <EmptyState message="No hay movimientos pendientes de verificación." />
      ) : (
        pendientes.map((movimiento) => (
          <Card key={movimiento.id} style={estilos.tarjeta}>
            <View style={estilos.superior}>
              <Text style={estilos.medicamento} numberOfLines={2}>
                {movimiento.lote?.medicamento?.nombre ?? "Medicamento sin nombre"}
              </Text>
              <Text style={estilos.cantidad}>{movimiento.cantidad}</Text>
            </View>

            <Text style={estilos.detalle}>
              {[
                movimiento.lote?.numero_lote ? `Lote ${movimiento.lote.numero_lote}` : null,
                movimiento.bodega?.nombre,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>

            <Text style={estilos.detalle}>
              {nombreDeQuienRegistro(movimiento)} ·{" "}
              {formatearFechaCorta(movimiento.created_at) || "sin fecha"}
            </Text>

            <View style={estilos.inferior}>
              <StatusChip
                status={movimiento.tipo}
                label={ETIQUETAS_TIPO_MOVIMIENTO[movimiento.tipo] ?? movimiento.tipo}
              />
            </View>

            {puedeAprobar ? (
              <PrimaryButton
                title="Aprobar"
                onPress={() => confirmarAprobacion(movimiento)}
                loading={procesandoId === movimiento.id}
                disabled={procesandoId !== null}
                style={estilos.accion}
              />
            ) : null}

            {puedeRechazar ? (
              <SecondaryButton
                title="Rechazar"
                variant="peligro"
                onPress={() => {
                  setRechazando(movimiento);
                  setMotivo("");
                  setErrorAccion(null);
                }}
                disabled={procesandoId !== null}
                style={estilos.accion}
              />
            ) : null}
          </Card>
        ))
      )}

      <Modal
        visible={Boolean(rechazando)}
        onClose={() => setRechazando(null)}
        title="Rechazar el movimiento"
      >
        <Text style={estilos.textoModal}>
          Escribe por qué se rechaza. Quien lo registró va a leer este motivo.
        </Text>

        <TextField
          label="Motivo"
          value={motivo}
          onChangeText={setMotivo}
          multiline
          editable={procesandoId === null}
        />

        <PrimaryButton
          title="Rechazar"
          onPress={confirmarRechazo}
          loading={procesandoId !== null}
          disabled={motivo.trim().length === 0 || procesandoId !== null}
          style={estilos.accion}
        />
        <SecondaryButton
          title="Cancelar"
          onPress={() => setRechazando(null)}
          disabled={procesandoId !== null}
          style={estilos.accion}
        />
      </Modal>
    </ScreenContainer>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  superior: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  medicamento: {
    color: colors.text,
    flex: 1,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  cantidad: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  detalle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
  },
  inferior: {
    flexDirection: "row",
    marginTop: spacing.xs,
  },
  accion: {
    marginTop: spacing.sm,
  },
  textoModal: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
});
