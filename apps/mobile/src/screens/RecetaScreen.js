import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

import {
  describirExistencia,
  formatearFechaCorta,
  nombreCompletoDePaciente,
  usePaciente,
  useGeneracionReceta,
} from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  ErrorState,
  LoadingState,
  NumberField,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  Selector,
  TextField,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";

function Disponible({ medicamento, onAgregar }) {
  return (
    <Pressable
      onPress={() => onAgregar(medicamento)}
      disabled={!medicamento.seleccionable}
      style={styles.opcion}
    >
      <View style={styles.opcionTexto}>
        <Text style={medicamento.seleccionable ? styles.texto : styles.textoTenue}>
          {describirExistencia(medicamento)}
        </Text>
        {medicamento.seleccionable ? (
          <Text style={styles.textoTenue}>
            {medicamento.cantidadDisponible} disponibles
            {medicamento.fechaVencimientoProxima
              ? ` · vence ${formatearFechaCorta(medicamento.fechaVencimientoProxima)}`
              : ""}
          </Text>
        ) : (
          <Text style={styles.motivo}>{medicamento.motivoNoSeleccionable}</Text>
        )}
      </View>
      {medicamento.seleccionable && <Text style={styles.agregar}>Agregar</Text>}
    </Pressable>
  );
}

function Renglon({ renglon, lotes, problema, onEditar, onQuitar, deshabilitado }) {
  return (
    <Card style={styles.tarjeta}>
      <View style={styles.cabeceraRenglon}>
        <Text style={styles.medicamento}>{renglon.medicamento}</Text>
        <Pressable onPress={() => onQuitar(renglon.clave)} disabled={deshabilitado}>
          <Text style={styles.quitar}>Quitar</Text>
        </Pressable>
      </View>

      <Selector
        label="Lote"
        value={renglon.loteId}
        options={(lotes ?? []).map((lote) => ({
          value: lote.loteId,
          label: `${lote.numeroLote} · vence ${formatearFechaCorta(lote.fechaVencimiento)} · ${lote.cantidadDisponible} en ${lote.bodega}`,
        }))}
        onSelect={(valor) => {
          const elegido = (lotes ?? []).find((lote) => lote.loteId === valor);
          onEditar(renglon.clave, "loteId", valor);
          onEditar(renglon.clave, "bodegaId", elegido?.bodegaId ?? null);
        }}
        placeholder="Elegir lote"
        disabled={deshabilitado}
      />

      <TextField
        label="Dosis"
        value={renglon.dosis}
        onChangeText={(texto) => onEditar(renglon.clave, "dosis", texto)}
        editable={!deshabilitado}
      />
      <TextField
        label="Frecuencia"
        value={renglon.frecuencia}
        onChangeText={(texto) => onEditar(renglon.clave, "frecuencia", texto)}
        editable={!deshabilitado}
      />
      <TextField
        label="Duracion"
        value={renglon.duracion}
        onChangeText={(texto) => onEditar(renglon.clave, "duracion", texto)}
        editable={!deshabilitado}
      />
      <NumberField
        label="Cantidad a entregar"
        value={renglon.cantidadEntregada === "" ? null : renglon.cantidadEntregada}
        onChange={(valor) => onEditar(renglon.clave, "cantidadEntregada", valor ?? "")}
        min={1}
        editable={!deshabilitado}
      />

      {problema && <Text style={styles.motivo}>{problema}</Text>}
    </Card>
  );
}

export default function RecetaScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { perfil, rol } = useSesionCompartida();
  const pacienteId = params?.pacienteId;
  const consultaId = params?.consultaId;

  const { paciente, cargando: cargandoPaciente } = usePaciente(pacienteId, { rol });
  const {
    busqueda,
    setBusqueda,
    catalogo,
    cargandoCatalogo,
    lotesPorMedicamento,
    renglones,
    problemas,
    indicacionesGenerales,
    setIndicacionesGenerales,
    error,
    enviando,
    receta,
    agregarMedicamento,
    editarRenglon,
    quitarRenglon,
    guardar,
  } = useGeneracionReceta({ consultaId, perfilId: perfil?.id });

  if (!consultaId) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message="Una receta se genera desde una consulta. Registra primero la consulta del paciente." />
      </ScreenContainer>
    );
  }

  if (cargandoPaciente && !paciente) {
    return (
      <ScreenContainer scrollable={false}>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (receta) {
    return (
      <ScreenContainer>
        <Card title={`Receta ${receta.folio ?? ""}`}>
          <Text style={styles.texto}>{nombreCompletoDePaciente(paciente) ?? "Paciente"}</Text>
          {receta.detalle?.map((renglon) => (
            <Text key={renglon.id} style={styles.texto}>
              {renglon.medicamento} — {renglon.dosis}, {renglon.frecuencia}, {renglon.duracion} (
              {renglon.cantidadEntregada})
            </Text>
          ))}
          {receta.indicacionesGenerales && (
            <Text style={styles.textoTenue}>{receta.indicacionesGenerales}</Text>
          )}
          <Text style={styles.textoTenue}>Mostra esta pantalla en el puesto de entrega.</Text>
        </Card>

        <PrimaryButton
          title="Volver a la ficha"
          onPress={() => navigation.navigate(ROUTES.FICHA_PACIENTE, { pacienteId })}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.paciente}>{nombreCompletoDePaciente(paciente) ?? "Paciente"}</Text>

      {error && (
        <Card style={styles.tarjeta}>
          <Text style={styles.motivo}>{error.mensaje}</Text>
        </Card>
      )}

      <TextField
        label="Buscar medicamento"
        placeholder="Nombre, componente o marca"
        value={busqueda}
        onChangeText={setBusqueda}
        autoCorrect={false}
      />

      {cargandoCatalogo ? (
        <LoadingState />
      ) : (
        <Card style={styles.tarjeta}>
          {catalogo.length === 0 ? (
            <Text style={styles.textoTenue}>Ningun medicamento coincide.</Text>
          ) : (
            catalogo.map((medicamento) => (
              <Disponible
                key={medicamento.id}
                medicamento={medicamento}
                onAgregar={agregarMedicamento}
              />
            ))
          )}
        </Card>
      )}

      {renglones.map((renglon) => (
        <Renglon
          key={renglon.clave}
          renglon={renglon}
          lotes={lotesPorMedicamento[renglon.medicamentoId]}
          problema={problemas[renglon.clave]}
          onEditar={editarRenglon}
          onQuitar={quitarRenglon}
          deshabilitado={enviando}
        />
      ))}

      <TextField
        label="Indicaciones generales"
        value={indicacionesGenerales}
        onChangeText={setIndicacionesGenerales}
        multiline
        numberOfLines={3}
        editable={!enviando}
      />

      <PrimaryButton
        title="Generar receta"
        onPress={guardar}
        loading={enviando}
        disabled={renglones.length === 0}
        style={styles.accion}
      />
      <SecondaryButton
        title="Volver a la ficha"
        onPress={() => navigation.navigate(ROUTES.FICHA_PACIENTE, { pacienteId })}
        disabled={enviando}
        style={styles.accion}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  paciente: {
    color: colors.text,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  tarjeta: {
    marginBottom: spacing.sm,
  },
  opcion: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingVertical: spacing.xs,
  },
  opcionTexto: {
    flexShrink: 1,
  },
  cabeceraRenglon: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
  },
  medicamento: {
    color: colors.text,
    flexShrink: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  texto: {
    color: colors.text,
    fontSize: typography.sizes.sm,
  },
  textoTenue: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
  },
  motivo: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
  },
  agregar: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  quitar: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
  },
  accion: {
    marginTop: spacing.sm,
  },
});
