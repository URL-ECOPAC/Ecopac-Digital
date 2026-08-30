import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';

import {
  ETIQUETAS_TIPO_DE_EVENTO,
  TIPOS_DE_EVENTO,
  describirMedicamento,
  describirPosologia,
  formatearFechaCorta,
  permisosDeFicha,
  useHistorialPaciente,
} from '@ecopac/shared';
import { colors, spacing, typography } from '@ecopac/ui-tokens';

import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  ScreenContainer,
  SecondaryButton,
} from '../components';
import { useSesionCompartida } from '../contexto/SesionProvider';

const ATENCIONES_INICIALES = 3;

function Medicamentos({ evento }) {
  if (!evento.medicamentos?.length) {
    return <Text style={styles.tenue}>Sin medicamentos entregados.</Text>;
  }

  return (
    <View>
      {evento.medicamentos.map((renglon, indice) => (
        <Text key={`${evento.id}-${indice}`} style={styles.texto}>
          {describirMedicamento(renglon)}
          {describirPosologia(renglon) ? ` — ${describirPosologia(renglon)}` : ''}
          {renglon.cantidadEntregada ? ` (${renglon.cantidadEntregada})` : ''}
        </Text>
      ))}
    </View>
  );
}

function DetalleDeConsulta({ evento }) {
  const campos = [
    ['Motivo', evento.motivoConsulta],
    ['Tratamiento', evento.tratamiento],
    ['Seguimiento', evento.planSeguimiento],
  ].filter(([, valor]) => valor);

  if (campos.length === 0 && !evento.diagnosticos?.length) {
    return <Text style={styles.tenue}>La consulta no registro detalle.</Text>;
  }

  return (
    <View>
      {evento.diagnosticos?.length > 0 && (
        <Text style={styles.texto}>
          Diagnosticos:{' '}
          {evento.diagnosticos
            .map((uno) => [uno.codigo, uno.nombre].filter(Boolean).join(' '))
            .join(', ')}
        </Text>
      )}
      {campos.map(([etiqueta, valor]) => (
        <Text key={etiqueta} style={styles.texto}>
          {etiqueta}: {valor}
        </Text>
      ))}
    </View>
  );
}

function Atencion({ grupo, abierta, onAlternar }) {
  const consulta = grupo.eventos.find((evento) => evento.tipo === TIPOS_DE_EVENTO.CONSULTA);
  const diagnostico = consulta?.diagnosticoPrincipal?.nombre ?? null;

  return (
    <Card style={styles.tarjeta}>
      <Pressable onPress={onAlternar} style={styles.cabecera}>
        <View style={styles.encabezadoTexto}>
          <Text style={styles.fecha}>{formatearFechaCorta(grupo.fecha)}</Text>
          <Text style={styles.diagnostico}>{diagnostico ?? 'Sin diagnostico registrado'}</Text>
          <Text style={styles.tenue}>
            {[grupo.jornada, grupo.comunidad].filter(Boolean).join(' · ') || 'Sin jornada'}
          </Text>
        </View>
        <Text style={styles.tenue}>{abierta ? 'Ocultar' : 'Ver'}</Text>
      </Pressable>

      {abierta && (
        <View style={styles.detalle}>
          {grupo.eventos.map((evento) => (
            <View key={`${evento.tipo}-${evento.id}`} style={styles.evento}>
              <Text style={styles.tipo}>
                {ETIQUETAS_TIPO_DE_EVENTO[evento.tipo] ?? evento.tipo}
                {evento.profesional ? ` · ${evento.profesional}` : ''}
              </Text>
              {evento.tipo === TIPOS_DE_EVENTO.CONSULTA && <DetalleDeConsulta evento={evento} />}
              {evento.tipo === TIPOS_DE_EVENTO.RECETA && <Medicamentos evento={evento} />}
              {evento.tipo === TIPOS_DE_EVENTO.TRIAJE && (
                <Text style={styles.texto}>
                  {[
                    evento.signos?.presionSistolica && evento.signos?.presionDiastolica
                      ? `PA ${evento.signos.presionSistolica}/${evento.signos.presionDiastolica}`
                      : null,
                    evento.signos?.glucosa ? `Glu ${evento.signos.glucosa}` : null,
                    evento.signos?.peso ? `${evento.signos.peso} kg` : null,
                  ]
                    .filter(Boolean)
                    .join('  ·  ') || 'Sin mediciones.'}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

export default function HistorialPacienteScreen() {
  const { params } = useRoute();
  const { rol } = useSesionCompartida();
  const pacienteId = params?.pacienteId;

  const { grupos, total, hayMas, verMas, cargando, error, recargar } = useHistorialPaciente(
    pacienteId,
    { rol, limiteInicial: ATENCIONES_INICIALES },
  );
  const [abiertas, setAbiertas] = useState(() => new Set());

  const alternar = (clave) =>
    setAbiertas((anteriores) => {
      const siguiente = new Set(anteriores);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });

  if (!permisosDeFicha(rol).puedeVerDatosClinicos) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message="Tu rol no puede ver el historial clinico." />
      </ScreenContainer>
    );
  }

  if (cargando && grupos.length === 0) {
    return (
      <ScreenContainer scrollable={false}>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  if (total === 0) {
    return (
      <ScreenContainer scrollable={false}>
        <EmptyState message="Este paciente no tiene atenciones anteriores." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {grupos.map((grupo) => (
        <Atencion
          key={grupo.clave}
          grupo={grupo}
          abierta={abiertas.has(grupo.clave)}
          onAlternar={() => alternar(grupo.clave)}
        />
      ))}

      {hayMas && (
        <SecondaryButton
          title={cargando ? 'Cargando...' : 'Ver atenciones anteriores'}
          onPress={verMas}
          disabled={cargando}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    marginBottom: spacing.sm,
  },
  cabecera: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  encabezadoTexto: {
    flexShrink: 1,
  },
  fecha: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
  },
  diagnostico: {
    color: colors.text,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  detalle: {
    marginTop: spacing.sm,
  },
  evento: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.xs,
    marginTop: spacing.xs,
  },
  tipo: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  texto: {
    color: colors.text,
    fontSize: typography.sizes.sm,
  },
  tenue: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
  },
});
