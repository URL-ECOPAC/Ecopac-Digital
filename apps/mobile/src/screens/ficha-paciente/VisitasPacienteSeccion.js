import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  describirEntrega,
  describirMedicamento,
  describirPosologia,
  formatearFechaCorta,
  htmlDeRecetaImprimible,
  partesDeVisita,
  useRecetasPaciente,
  useVisitasPaciente,
} from "@ecopac/shared";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";

import { Card, EmptyState, ErrorState, LoadingState, SecondaryButton } from "../../components";
import { imprimirHtml } from "../../impresion";

/**
 * El historial clinico como lista de visitas (issue #840, bloque F). Espejo de
 * apps/web/src/pages/PestaniaHistorialPaciente.jsx.
 *
 * Cada visita es una unidad y trae dentro sus signos, su consulta y su receta. Antes eran eventos
 * sueltos en una pantalla aparte, y los signos y las recetas ademas en dos pestanas hermanas que
 * no cabian en el ancho de un telefono (G3).
 */

function Signos({ signos }) {
  const partes = [
    signos.presionSistolica && signos.presionDiastolica
      ? `PA ${signos.presionSistolica}/${signos.presionDiastolica}`
      : null,
    signos.frecuenciaCardiaca ? `FC ${signos.frecuenciaCardiaca}` : null,
    signos.temperatura ? `${signos.temperatura} °C` : null,
    signos.glucosa ? `Glu ${signos.glucosa}` : null,
    signos.peso ? `${signos.peso} kg` : null,
    signos.talla ? `${signos.talla} cm` : null,
    signos.imc ? `IMC ${signos.imc}` : null,
  ].filter(Boolean);
  return <Text style={styles.texto}>{partes.join("  ·  ")}</Text>;
}

function Consulta({ consulta }) {
  const campos = [
    ["Motivo", consulta.motivoConsulta],
    ["Síntomas", consulta.sintomas],
    ["Exploración", consulta.exploracion],
    ["Tratamiento", consulta.tratamiento],
    ["Seguimiento", consulta.planSeguimiento],
  ].filter(([, valor]) => valor);
  return (
    <View>
      {consulta.diagnosticos?.length > 0 ? (
        <Text style={styles.textoFuerte}>
          {consulta.diagnosticos
            .map((uno) => [uno.codigo, uno.nombre].filter(Boolean).join(" "))
            .join(", ")}
        </Text>
      ) : null}
      {campos.map(([etiqueta, valor]) => (
        <Text key={etiqueta} style={styles.texto}>
          {etiqueta}: {valor}
        </Text>
      ))}
      {consulta.profesional ? (
        <Text style={styles.tenue}>Atendió {consulta.profesional}</Text>
      ) : null}
    </View>
  );
}

function Receta({ receta, onImprimir, imprimiendo }) {
  return (
    <View style={styles.receta}>
      <Text style={styles.textoFuerte}>
        {receta.folio ?? "Receta"}
        {receta.anulada ? " (anulada)" : ""}
      </Text>
      {receta.medicamentos.map((renglon, indice) => (
        <Text key={`${receta.id}-${indice}`} style={styles.texto}>
          {describirMedicamento(renglon)}
          {describirPosologia(renglon) ? ` — ${describirPosologia(renglon)}` : ""}
          {describirEntrega(renglon).texto ? ` (${describirEntrega(renglon).texto})` : ""}
        </Text>
      ))}
      {onImprimir ? (
        <SecondaryButton
          title="Imprimir o guardar PDF"
          onPress={onImprimir}
          loading={imprimiendo}
          disabled={imprimiendo}
          style={styles.accionReceta}
        />
      ) : null}
    </View>
  );
}

function Parte({ titulo, children }) {
  return (
    <View style={styles.parte}>
      <Text style={styles.tituloParte}>{titulo}</Text>
      {children}
    </View>
  );
}

function Chip({ presente, children }) {
  return (
    <View style={[styles.chip, presente ? styles.chipPresente : styles.chipAusente]}>
      <Text style={[styles.chipTexto, presente ? styles.chipTextoPresente : null]}>{children}</Text>
    </View>
  );
}

function Visita({
  visita,
  abierta,
  onAlternar,
  onAbrirConsulta,
  onAbrirEntrega,
  onImprimirReceta,
  imprimiendo,
}) {
  const partes = partesDeVisita(visita);
  return (
    <Card style={styles.tarjeta}>
      <Pressable
        onPress={onAlternar}
        style={styles.cabecera}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierta }}
      >
        <View style={styles.cabeceraTexto}>
          <Text style={styles.fecha}>{formatearFechaCorta(visita.fecha)}</Text>
          <Text style={styles.diagnostico} numberOfLines={2}>
            {visita.diagnosticoPrincipal?.nombre ?? visita.jornada ?? "Visita"}
          </Text>
          <Text style={styles.tenue} numberOfLines={1}>
            {[visita.jornada, visita.comunidad].filter(Boolean).join(" · ")}
          </Text>
          <View style={styles.chips}>
            <Chip presente={partes.signos}>Signos</Chip>
            <Chip presente={partes.consulta}>Consulta</Chip>
            <Chip presente={partes.receta}>Receta</Chip>
          </View>
        </View>
        <Text style={styles.tenue}>{abierta ? "Ocultar" : "Ver"}</Text>
      </Pressable>

      {abierta ? (
        <View style={styles.detalle}>
          <Parte titulo="Signos vitales">
            {visita.signos ? (
              <Signos signos={visita.signos} />
            ) : (
              <Text style={styles.tenue}>No se tomaron signos en esta visita.</Text>
            )}
          </Parte>
          <Parte titulo="Consulta">
            {visita.consulta ? (
              <Consulta consulta={visita.consulta} />
            ) : (
              <Text style={styles.tenue}>Sin consulta registrada.</Text>
            )}
          </Parte>
          <Parte titulo="Receta">
            {visita.recetas.length === 0 ? (
              <Text style={styles.tenue}>Sin receta.</Text>
            ) : (
              visita.recetas.map((receta) => (
                <Receta
                  key={receta.id}
                  receta={receta}
                  imprimiendo={imprimiendo === receta.id}
                  onImprimir={onImprimirReceta ? () => onImprimirReceta(receta.id) : undefined}
                />
              ))
            )}
          </Parte>
          {onAbrirEntrega && visita.recetas.length > 0 ? (
            <SecondaryButton
              title="Entrega de medicamentos"
              onPress={() => onAbrirEntrega(visita)}
              style={styles.accion}
            />
          ) : null}
          {onAbrirConsulta ? (
            <SecondaryButton
              title="Abrir la consulta"
              onPress={() => onAbrirConsulta(visita)}
              style={styles.accion}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

export default function VisitasPacienteSeccion({
  pacienteId,
  paciente,
  rol,
  onAbrirConsulta,
  onAbrirEntrega,
}) {
  const { visitas, cargando, error, recargar } = useVisitasPaciente(pacienteId, { rol });
  const { recetas } = useRecetasPaciente(pacienteId, { rol });
  const [abiertas, setAbiertas] = useState(null);
  const [imprimiendo, setImprimiendo] = useState(null);
  const [errorImpresion, setErrorImpresion] = useState(null);

  // La visita mas reciente abierta de entrada: es la que casi siempre se viene a ver.
  const abiertasEfectivas = abiertas ?? new Set(visitas[0] ? [visitas[0].atencionId] : []);

  const alternar = (id) => {
    const siguiente = new Set(abiertasEfectivas);
    if (siguiente.has(id)) siguiente.delete(id);
    else siguiente.add(id);
    setAbiertas(siguiente);
  };

  const recetasPorId = new Map(recetas.map((receta) => [receta.id, receta]));

  const imprimirReceta = async (recetaId) => {
    const completa = recetasPorId.get(recetaId);
    setErrorImpresion(null);

    if (!completa) {
      setErrorImpresion("No se pudo leer la receta completa para imprimirla.");
      return;
    }

    setImprimiendo(recetaId);
    const resultado = await imprimirHtml(htmlDeRecetaImprimible({ receta: completa, paciente }), {
      nombreDelArchivo: completa.folio ? `Receta ${completa.folio}` : "Receta",
    });
    setImprimiendo(null);

    if (!resultado.ok) setErrorImpresion(resultado.error.mensaje);
  };

  if (cargando && visitas.length === 0) return <LoadingState />;
  if (error) return <ErrorState message={error.mensaje} onRetry={recargar} />;
  if (visitas.length === 0) {
    return <EmptyState message="Este paciente todavía no tiene visitas registradas." />;
  }

  return (
    <View>
      {errorImpresion ? <ErrorState message={errorImpresion} /> : null}
      {visitas.map((visita) => (
        <Visita
          key={visita.atencionId}
          visita={visita}
          abierta={abiertasEfectivas.has(visita.atencionId)}
          onAlternar={() => alternar(visita.atencionId)}
          onAbrirConsulta={onAbrirConsulta}
          onAbrirEntrega={onAbrirEntrega}
          onImprimirReceta={paciente ? imprimirReceta : undefined}
          imprimiendo={imprimiendo}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    marginBottom: spacing.sm,
  },
  cabecera: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 48,
  },
  cabeceraTexto: {
    flex: 1,
  },
  fecha: {
    color: colors.primary,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  diagnostico: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipPresente: {
    borderColor: colors.primary,
  },
  chipAusente: {
    borderColor: colors.border,
  },
  chipTexto: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
  },
  chipTextoPresente: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  detalle: {
    marginTop: spacing.sm,
  },
  parte: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  tituloParte: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  receta: {
    marginBottom: spacing.xs,
  },
  texto: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
  },
  textoFuerte: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  tenue: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
  },
  accionReceta: {
    marginTop: spacing.sm,
  },
  accion: {
    marginTop: spacing.md,
  },
});
