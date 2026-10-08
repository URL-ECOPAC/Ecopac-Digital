import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatearMoneda, puedeCargarBodegaDeJornada, useInsumosDeJornada } from "@ecopac/shared";
import { colors, moduleAccents, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  ContenidoDeBodega,
  DataList,
  PrimaryButton,
  SecondaryButton,
  StatCard,
} from "../components";
import ModalCargaABodega from "./ModalCargaABodega";
import ModalDevolucionDeBodega from "./ModalDevolucionDeBodega";

/**
 * Pestaña Insumos del detalle de una jornada, en movil. Espejo de
 * apps/web/src/pages/InsumosDeJornada.jsx: desde la 00178 los insumos de una jornada son lo que
 * hay en su bodega movil -se cargan aqui desde otra bodega ("Cargar a la bodega") y de ella salen
 * las entregas de la jornada. Lo que se consumio esta en la pestaña Consumo. Con la bodega
 * principal (00181) no hay nada que cargar ni devolver.
 *
 * La lista de previstos (jornada_insumos, legado) ya no se llena; si una jornada anterior la
 * tiene, se muestra aqui -de solo lectura en movil: corregir o quitar un previsto sigue siendo
 * exclusivo de la web (ModalInsumoPrevisto no tiene equivalente movil todavia).
 */
export default function InsumosDeJornada({
  jornadaId,
  bodega = null,
  rol,
  soloConsulta = false,
  motivoSinCarga = null,
}) {
  const {
    usaBodegaPrincipal,
    columnas,
    insumos,
    resumen,
    existenciasDeBodega,
    valorDeBodega,
    lotesDevolvibles,
    unidadesDeOtrasJornadas,
    motivoBodegaOcupada,
    cargando,
    error,
    recargarBodega,
  } = useInsumosDeJornada({
    jornadaId,
    bodegaId: bodega?.id ?? null,
    bodegaEsPrincipal: Boolean(bodega?.esPrincipal),
    rol,
  });

  const [cargandoABodega, setCargandoABodega] = useState(false);
  const [devolviendo, setDevolviendo] = useState(false);
  const puedeCargar = puedeCargarBodegaDeJornada(rol) && Boolean(bodega?.id) && !usaBodegaPrincipal;
  const motivoParaNoCargar = motivoSinCarga ?? motivoBodegaOcupada;

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.kpis}>
        {!usaBodegaPrincipal && bodega?.id && (
          <StatCard
            label="Valor en la bodega"
            value={formatearMoneda(valorDeBodega.valor) ?? "—"}
            caption={
              valorDeBodega.lotesSinCosto > 0
                ? `${valorDeBodega.lotesSinCosto} lote(s) sin costo no se suman`
                : `${valorDeBodega.unidades} unidades`
            }
            accent={moduleAccents.inventario}
          />
        )}
        {insumos.length > 0 && (
          <StatCard
            label="Previsto (estimado)"
            value={formatearMoneda(resumen.totalEstimado) ?? "—"}
            caption="Planificado antes de cargar la bodega"
            accent={moduleAccents.jornadas}
          />
        )}
      </View>

      {error && (
        <Text style={estilos.aviso}>No se pudieron actualizar los insumos: {error.mensaje}</Text>
      )}

      {usaBodegaPrincipal && (
        <Card style={estilos.seccion}>
          <Text style={estilos.tituloSeccion}>Bodega principal: {bodega.nombre}</Text>
          <Text style={estilos.textoInfo}>
            Esta jornada entrega directo de la bodega principal: no hay nada que cargar ni que
            devolver. Lo que se entregue en sus recetas aparece en la pestaña Consumo, con su valor.
          </Text>
        </Card>
      )}

      {!usaBodegaPrincipal && bodega?.id && (
        <View style={estilos.seccion}>
          <Text style={estilos.tituloSeccion}>Bodega móvil: {bodega.nombre}</Text>
          <Text style={estilos.textoMuted}>
            De esta bodega salen los medicamentos que se recetan en la jornada. Se carga desde otra
            bodega, y lo que sobra se devuelve a una bodega fija.
          </Text>

          {puedeCargar && (
            <View style={estilos.filaBotones}>
              <SecondaryButton
                title="Devolver a otra bodega"
                onPress={() => setDevolviendo(true)}
                disabled={lotesDevolvibles.length === 0}
                style={estilos.boton}
              />
              <PrimaryButton
                title="Cargar a la bodega"
                onPress={() => setCargandoABodega(true)}
                disabled={soloConsulta || Boolean(motivoParaNoCargar)}
                style={estilos.boton}
              />
            </View>
          )}
          {puedeCargar && motivoParaNoCargar && (
            <Text style={estilos.textoMuted}>{motivoParaNoCargar}</Text>
          )}
          {unidadesDeOtrasJornadas > 0 && (
            <Text style={estilos.textoInfo}>
              {unidadesDeOtrasJornadas} unidad(es) de esta bodega no son de esta jornada: son el
              sobrante de otra jornada o entraron sin jornada. No cuentan en su consumo y se
              devuelven desde la jornada que las tiene.
            </Text>
          )}

          <ContenidoDeBodega
            contenido={existenciasDeBodega.contenido}
            cargando={existenciasDeBodega.cargando}
            error={existenciasDeBodega.error?.mensaje}
            vacio="La bodega móvil todavía no tiene existencias. Cárgala desde otra bodega."
            conValor
          />
        </View>
      )}

      {!bodega?.id && (
        <Text style={estilos.textoInfo}>
          {soloConsulta
            ? "Esta jornada es anterior a las bodegas de jornada: sus insumos no se registraron en una bodega."
            : "Esta jornada no tiene bodega. Asígnale una bodega móvil o la principal desde la web para cargarle insumos."}
        </Text>
      )}

      {insumos.length > 0 && (
        <View style={estilos.seccion}>
          <Text style={estilos.tituloSeccion}>Previstos</Text>
          <Text style={estilos.textoMuted}>
            Lo que se planificó antes de que los insumos se cargaran a la bodega. No descuenta
            existencias del inventario. Corregir o quitar un previsto es exclusivo de la web.
          </Text>
          <DataList columnas={columnas} datos={insumos} cargando={cargando} vacio={null} />
          {resumen.sinCosto > 0 && (
            <Text style={estilos.textoMutedDerecha}>
              {resumen.sinCosto} previsto(s) sin costo estimado
            </Text>
          )}
        </View>
      )}

      {devolviendo && (
        <ModalDevolucionDeBodega
          visible
          jornadaId={jornadaId}
          bodega={bodega}
          contenido={lotesDevolvibles}
          rol={rol}
          onClose={() => setDevolviendo(false)}
          onDevuelto={() => {
            recargarBodega();
          }}
        />
      )}

      {cargandoABodega && (
        <ModalCargaABodega
          visible
          jornadaId={jornadaId}
          bodega={bodega}
          rol={rol}
          onClose={() => setCargandoABodega(false)}
          onCargado={() => {
            recargarBodega();
          }}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    gap: spacing.md,
  },
  kpis: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  seccion: {
    gap: spacing.sm,
  },
  tituloSeccion: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  textoMuted: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  textoMutedDerecha: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    textAlign: "right",
  },
  textoInfo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    padding: spacing.sm,
  },
  aviso: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.danger,
  },
  filaBotones: {
    gap: spacing.sm,
  },
  boton: {
    alignSelf: "stretch",
  },
});
