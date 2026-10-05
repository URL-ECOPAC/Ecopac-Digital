import { StyleSheet, Text } from "react-native";
import {
  claveDeLoteDeSalida,
  formatearFechaCorta,
  useCargaDeBodegaDeJornada,
} from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { Modal, NumberField, PrimaryButton, SecondaryButton, Selector } from "../components";

/**
 * "Lote L-1 · Bodega Principal · vence 31/01/2027 · 30 disponibles". Si la bodega esta en otra
 * jornada en curso, lo dice: "Bodega Movil (en curso en Jornada X)". Espejo de
 * apps/web/src/pages/ModalCargaABodega.jsx.
 */
function etiquetaDeLote(lote) {
  const vence = lote.fechaVencimiento
    ? `vence ${formatearFechaCorta(lote.fechaVencimiento)}`
    : "no vence";
  const bodega = lote.jornadaDeOrigen
    ? `${lote.bodega} (en curso en ${lote.jornadaDeOrigen.nombre})`
    : lote.bodega;
  return `Lote ${lote.numeroLote} · ${bodega} · ${vence} · ${lote.cantidadDisponible} disponibles`;
}

/**
 * "Cargar a la bodega" de la pestaña Insumos de una jornada, en movil. El estado, lo que se
 * puede guardar y la llamada viven en useCargaDeBodegaDeJornada(); aqui solo se dibuja.
 */
export default function ModalCargaABodega({ visible, jornadaId, bodega, rol, onClose, onCargado }) {
  const {
    articulos,
    medicamentoId,
    setMedicamentoId,
    lotesDeOrigen,
    claveLote,
    seleccionarLotePorClave,
    cantidad,
    setCantidad,
    sinExistencia,
    mensajeSinExistencia,
    avisoCantidad,
    avisoOrigen,
    puedeGuardar,
    cargando,
    guardando,
    error,
    guardar,
  } = useCargaDeBodegaDeJornada({
    jornadaId,
    bodegaId: bodega?.id ?? null,
    rol,
    activo: visible,
    onCargado,
  });

  const enviar = async () => {
    const { ok } = await guardar();
    if (ok) onClose?.();
  };

  return (
    <Modal visible={visible} onClose={onClose} title={`Cargar a la bodega ${bodega?.nombre ?? ""}`}>
      <Text style={estilos.textoMuted}>
        Lo que se carga sale de otra bodega y pasa a la bodega móvil de la jornada. De ahí salen los
        medicamentos que se recetan en la jornada.
      </Text>

      {error && <Text style={estilos.aviso}>No se pudo cargar: {error.mensaje}</Text>}

      <Selector
        label="Producto / Insumo"
        requerido
        value={medicamentoId || null}
        options={articulos}
        onSelect={setMedicamentoId}
        placeholder={articulos.length === 0 ? "Cargando..." : "Seleccionar"}
        disabled={guardando || articulos.length === 0}
      />

      <Selector
        label="Lote y bodega de origen"
        requerido
        value={claveLote || null}
        options={lotesDeOrigen.map((lote) => ({
          value: claveDeLoteDeSalida(lote),
          label: etiquetaDeLote(lote),
        }))}
        onSelect={(valor) => seleccionarLotePorClave(valor ?? "")}
        placeholder={cargando ? "Cargando..." : "Seleccionar"}
        disabled={guardando || !medicamentoId || lotesDeOrigen.length === 0}
        error={sinExistencia ? mensajeSinExistencia : undefined}
      />

      {avisoOrigen && <Text style={estilos.avisoAmarillo}>{avisoOrigen}</Text>}

      <NumberField
        label="Cantidad"
        requerido
        value={cantidad === "" ? null : Number(cantidad)}
        min={1}
        onChange={(valor) => setCantidad(valor === null ? "" : String(valor))}
        error={avisoCantidad ?? undefined}
        editable={!guardando && Boolean(claveLote)}
      />

      <PrimaryButton
        title="Cargar"
        onPress={enviar}
        loading={guardando}
        disabled={!puedeGuardar}
        style={estilos.boton}
      />
      <SecondaryButton
        title="Cancelar"
        onPress={onClose}
        disabled={guardando}
        style={estilos.boton}
      />
    </Modal>
  );
}

const estilos = StyleSheet.create({
  textoMuted: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  aviso: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  avisoAmarillo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.warning,
    marginBottom: spacing.sm,
  },
  boton: {
    marginTop: spacing.sm,
  },
});
