import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  ESTADOS_CONDICION_CRONICA,
  ETIQUETAS_ESTADO_CONDICION,
  formatearFechaCorta,
  useCondicionesPaciente,
} from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  DateField,
  ErrorState,
  LoadingState,
  PrimaryButton,
  SecondaryButton,
  Selector,
  StatusChip,
} from "../../components";

// Condiciones cronicas del paciente, dentro de su ficha movil.
//
// ESTABA ROTA (issue #834). Esta seccion importaba `useCondicionesCronicas` y
// `actualizarCondicionCronica` de @ecopac/shared. NINGUNA DE LAS DOS EXISTE: el hook se llama
// useCondicionesPaciente y la funcion, actualizarCondicion. El import no reventaba porque el
// propio componente traia una "verificacion de seguridad por si el hook no esta exportado" que
// caia a una lista vacia, asi que la pestana decia siempre "Sin condiciones cronicas
// registradas" -- daba igual cuantas tuviera el paciente -- y "Resolver" llamaba a undefined.
//
// Ademas leia `item.nombre` cuando obtenerCondicionesDelPaciente() devuelve el nombre en
// `condicion` (ver aCondicionDelPaciente en condiciones.api.js), y decidia quien puede editar
// comparando el rol con los literales "medico"/"administrador", que es justo lo que AGENTS.md
// prohibe: quien decide es permisosDeCondiciones(), que el hook ya devuelve.
//
// Ahora, ademas de leer, deja AGREGAR una condicion del catalogo sin salir de la ficha, que es lo
// que la web ya hacia desde la #122.

export default function CondicionesPacienteSeccion({ pacienteId, rol, alActualizar }) {
  const {
    condiciones,
    cargando,
    error,
    errorDeAlta,
    errores,
    enviando,
    permisos,
    valores,
    setCampo,
    agregar,
    marcarResuelta,
    recargar,
    catalogos,
  } = useCondicionesPaciente(pacienteId, { rol });

  const [agregando, setAgregando] = useState(false);

  const guardar = async () => {
    const resultado = await agregar();
    if (resultado.ok) {
      setAgregando(false);
      alActualizar?.();
    }
  };

  const resolver = async (condicion) => {
    const resultado = await marcarResuelta(condicion.id);
    if (resultado.ok) alActualizar?.();
  };

  if (cargando) return <LoadingState />;
  if (error) return <ErrorState message={error.mensaje} onRetry={recargar} />;

  return (
    <Card title="Condiciones crónicas" style={estilos.tarjeta}>
      {errorDeAlta ? <Text style={estilos.error}>{errorDeAlta.mensaje}</Text> : null}

      {condiciones.length === 0 ? (
        <Text style={estilos.vacio}>Sin condiciones crónicas registradas.</Text>
      ) : (
        <View style={estilos.lista}>
          {condiciones.map((item) => (
            <View key={item.id} style={estilos.fila}>
              <View style={estilos.info}>
                <StatusChip
                  status={item.estado}
                  label={`${item.condicion ?? "Sin nombre"} · ${
                    ETIQUETAS_ESTADO_CONDICION[item.estado] ?? item.estado
                  }`}
                />
                {item.fechaDiagnostico ? (
                  <Text style={estilos.notas}>
                    Diagnosticada el {formatearFechaCorta(item.fechaDiagnostico)}
                  </Text>
                ) : null}
                {item.notas ? <Text style={estilos.notas}>{item.notas}</Text> : null}
              </View>

              {permisos.puedeEditar && item.estado !== ESTADOS_CONDICION_CRONICA.RESUELTA ? (
                <SecondaryButton
                  title="Resolver"
                  size="sm"
                  onPress={() => resolver(item)}
                  disabled={enviando}
                />
              ) : null}
            </View>
          ))}
        </View>
      )}

      {permisos.puedeRegistrar && !agregando ? (
        <SecondaryButton
          title="Agregar condición"
          size="sm"
          onPress={() => setAgregando(true)}
          style={estilos.accion}
        />
      ) : null}

      {permisos.puedeRegistrar && agregando ? (
        <View style={estilos.alta}>
          {/* Los ids y las etiquetas salen de CAMPOS_CONDICION_CRONICA (el hook los devuelve en
              `campos`), no de literales de esta pantalla: `condicion` y `fechaDiagnostico` son
              obligatorios (NOT NULL en padecimientos_cronicos, 00010) y `estado` no, porque la
              columna tiene DEFAULT 'activa'. */}
          <Selector
            label="Condición"
            value={valores.condicion || null}
            options={catalogos.condicionesCronicas}
            onSelect={(valor) => setCampo("condicion", valor)}
            placeholder="Elegir del catálogo"
            error={errores.condicion}
            disabled={enviando}
          />
          <DateField
            label="Fecha de diagnóstico"
            value={valores.fechaDiagnostico || null}
            onChange={(valor) => setCampo("fechaDiagnostico", valor)}
            error={errores.fechaDiagnostico}
            disabled={enviando}
          />
          <Selector
            label="Estado"
            value={valores.estado || null}
            options={catalogos.estadosCondicionCronica}
            onSelect={(valor) => setCampo("estado", valor)}
            disabled={enviando}
          />
          <View style={estilos.botones}>
            <PrimaryButton
              title="Guardar"
              size="sm"
              onPress={guardar}
              loading={enviando}
              style={estilos.boton}
            />
            <SecondaryButton
              title="Cancelar"
              size="sm"
              onPress={() => setAgregando(false)}
              disabled={enviando}
              style={estilos.boton}
            />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    marginBottom: spacing.sm,
  },
  vacio: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
  },
  error: {
    color: colors.danger,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  lista: {
    gap: spacing.xs,
  },
  fila: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  info: {
    flex: 1,
    marginRight: spacing.xs,
  },
  notas: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  accion: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
  },
  alta: {
    marginTop: spacing.sm,
  },
  botones: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  boton: {
    flex: 1,
  },
});
