import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

import {
  TIPOS_DE_CAMPO,
  formatearFechaCorta,
  nombreCompletoDePaciente,
  useConsulta,
  usePaciente,
} from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  ErrorState,
  FormularioSignosVitales,
  LoadingState,
  MultiSelector,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  TextField,
} from "../components";
import { almacenamientoMovil } from "../almacenamiento";
import { useJornadaActivaCompartida } from "../contexto/JornadaActivaProvider";
import { useRegistroSinGuardar } from "../contexto/RegistroSinGuardarProvider";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";

// Id fijo: solo hay una consulta abierta a la vez.
const ID_FORMULARIO = "consulta";

/**
 * La consulta como unidad del historial (issue #840, bloque F). Espejo de ModalConsulta.jsx.
 *
 * "Nueva consulta" y abrir una visita existente son la misma pantalla: dentro se registran, o no,
 * los signos vitales; se registra la consulta; y se registra, o no, la receta. Reemplaza a
 * TriajeScreen -no hay "Nuevo triaje": es lo mismo- y a la ConsultaScreen anterior, que tomaba
 * los signos de otra pantalla y solo los mostraba.
 *
 * Params: `pacienteId`, y `jornadaId` para abrir la visita de una jornada que no es la activa
 * (desde el historial). Sin `jornadaId` es la jornada activa: si el paciente ya tiene visita en
 * ella, se abre esa para completarla.
 */
function Paso({ numero, titulo, descripcion, abierto, onAlternar, children }) {
  return (
    <Card style={styles.tarjeta}>
      <Pressable
        onPress={onAlternar}
        style={styles.cabeceraPaso}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
      >
        <View style={styles.numeroPaso}>
          <Text style={styles.numeroPasoTexto}>{numero}</Text>
        </View>
        <View style={styles.tituloPasoCaja}>
          <Text style={styles.tituloPaso}>{titulo}</Text>
          {descripcion ? <Text style={styles.textoTenue}>{descripcion}</Text> : null}
        </View>
        <Text style={styles.textoTenue}>{abierto ? "Ocultar" : "Mostrar"}</Text>
      </Pressable>
      {abierto ? <View style={styles.cuerpoPaso}>{children}</View> : null}
    </Card>
  );
}

export default function ConsultaScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { perfil, rol } = useSesionCompartida();
  const pacienteId = params?.pacienteId;

  const { paciente, cargando: cargandoPaciente } = usePaciente(pacienteId, { rol });
  const { jornadaId: jornadaActivaId, jornada } = useJornadaActivaCompartida();
  const jornadaId = params?.jornadaId ?? jornadaActivaId;
  const esLaActiva = jornadaId === jornadaActivaId;

  const c = useConsulta({
    paciente,
    jornadaId,
    estadoDeJornada: esLaActiva ? jornada?.estado : undefined,
    perfilId: perfil?.id,
    rol,
    almacenamiento: almacenamientoMovil,
  });

  const [abiertos, setAbiertos] = useState(() => new Set(["signos", "consulta"]));
  const alternar = (id) =>
    setAbiertos((anteriores) => {
      const siguiente = new Set(anteriores);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  // Aviso de "hay cambios sin guardar" al cerrar sesion o salir (issue #110).
  const { registrar, desregistrar } = useRegistroSinGuardar();
  useEffect(() => {
    if (!c.hayCambios) return undefined;
    registrar(ID_FORMULARIO);
    return () => desregistrar(ID_FORMULARIO);
  }, [c.hayCambios, registrar, desregistrar]);

  if (!jornadaId) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message="No hay una jornada en curso asignada. La consulta se registra dentro de una jornada." />
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

  const nombre = nombreCompletoDePaciente(paciente) ?? "Paciente";
  const subtitulo = c.esNueva
    ? (jornada?.nombre ?? "Nueva consulta")
    : [formatearFechaCorta(c.visita?.fecha), c.visita?.jornada].filter(Boolean).join(" · ");

  return (
    <ScreenContainer>
      <Text style={styles.paciente}>{nombre}</Text>
      <Text style={styles.jornada}>{subtitulo}</Text>

      {c.esNueva && !c.bloqueo.puede ? (
        <Card style={styles.tarjeta}>
          <Text style={styles.textoAviso}>{c.bloqueo.motivo}</Text>
        </Card>
      ) : null}

      {c.error ? (
        <Card style={styles.tarjeta}>
          <Text style={styles.textoError}>{c.error.mensaje}</Text>
        </Card>
      ) : null}

      {c.guardadaAlMenosUnaVez && !c.error ? (
        <Card style={styles.tarjeta}>
          <Text style={styles.textoExito}>Consulta guardada.</Text>
        </Card>
      ) : null}

      <Paso
        numero="1"
        titulo="Signos vitales"
        descripcion="Opcionales: lo que se pudo medir."
        abierto={abiertos.has("signos")}
        onAlternar={() => alternar("signos")}
      >
        {!c.permisos.signos ? (
          <Text style={styles.textoTenue}>
            Tu rol no puede {c.visita?.signos ? "corregir" : "tomar"} los signos.
          </Text>
        ) : null}
        <FormularioSignosVitales
          campos={c.camposDeSignos}
          valores={c.signos}
          onChange={c.setSigno}
          errores={c.errores.signos}
          avisos={c.avisos}
          imc={c.imc}
          disabled={c.enviando || !c.permisos.signos}
        />
      </Paso>

      <Paso
        numero="2"
        titulo="Consulta"
        abierto={abiertos.has("consulta")}
        onAlternar={() => alternar("consulta")}
      >
        {!c.permisos.consulta ? (
          <Text style={styles.textoTenue}>
            {c.visita?.consulta
              ? "Solo quien registró la consulta, o la administración, puede cambiarla."
              : "La consulta la registra el personal médico."}
          </Text>
        ) : null}
        {c.errorDiagnostico ? (
          <Text style={styles.textoError}>{c.errorDiagnostico.mensaje}</Text>
        ) : null}
        {c.seccionesDeConsulta.map((seccion) => (
          <View key={seccion.id} style={styles.subseccion}>
            <Text style={styles.tituloSubseccion}>{seccion.titulo}</Text>
            {seccion.campos.map((campo) =>
              campo.tipo === TIPOS_DE_CAMPO.MULTI_SELECT ? (
                <View key={campo.id}>
                  {/* Con un catalogo largo, el selector abre con busqueda (G4). */}
                  <MultiSelector
                    label={campo.label}
                    value={c.consulta[campo.id] ?? []}
                    options={c.catalogos[campo.opcionesDesde] ?? []}
                    onChange={(elegidos) => c.setCampoDeConsulta(campo.id, elegidos)}
                    onCrear={c.crearDiagnosticoNuevo ?? undefined}
                    placeholder="Buscar un diagnóstico"
                    placeholderLibre="Escribe uno que no esté en el catálogo"
                    disabled={c.enviando || !c.permisos.consulta}
                  />
                  {(c.consulta[campo.id] ?? []).length > 0 ? (
                    <Text style={styles.textoTenue}>
                      El primero de la lista es el diagnóstico principal.
                    </Text>
                  ) : null}
                </View>
              ) : (
                <TextField
                  key={campo.id}
                  label={campo.validacion?.requerido ? `${campo.label} *` : campo.label}
                  value={c.consulta[campo.id] ?? ""}
                  onChangeText={(texto) => c.setCampoDeConsulta(campo.id, texto)}
                  error={c.errores.consulta[campo.id]}
                  multiline
                  numberOfLines={3}
                  editable={!c.enviando && c.permisos.consulta}
                />
              ),
            )}
          </View>
        ))}
      </Paso>

      <Paso
        numero="3"
        titulo="Receta"
        descripcion="Opcional. Se emite sobre la consulta guardada."
        abierto
        onAlternar={() => {}}
      >
        {c.receta.existentes.length > 0 ? (
          c.receta.existentes.map((receta) => (
            <Text key={receta.id} style={styles.texto}>
              Receta {receta.folio ?? ""}
              {receta.anulada ? " (anulada)" : ""}: {receta.medicamentos.length}{" "}
              {receta.medicamentos.length === 1 ? "medicamento" : "medicamentos"}
            </Text>
          ))
        ) : c.receta.puedeAgregar && !c.hayCambios ? (
          <SecondaryButton
            title="Agregar receta"
            onPress={() =>
              navigation.navigate(ROUTES.RECETA, { pacienteId, consultaId: c.receta.consultaId })
            }
          />
        ) : (
          <Text style={styles.textoTenue}>
            {!c.permisos.receta
              ? "La receta la emite el personal médico."
              : c.receta.puedeAgregar
                ? "Guarda los cambios antes de emitir la receta."
                : "Primero guarda la consulta: la receta se emite sobre ella."}
          </Text>
        )}
      </Paso>

      <PrimaryButton
        title="Guardar consulta"
        onPress={c.guardar}
        loading={c.enviando}
        disabled={!c.hayCambios}
        style={styles.accion}
      />
      {c.esNueva ? (
        <SecondaryButton
          title="Descartar borrador"
          onPress={c.descartarBorrador}
          disabled={c.enviando}
          style={styles.accion}
        />
      ) : null}
      <SecondaryButton
        title="Volver a la ficha"
        onPress={() => navigation.navigate(ROUTES.FICHA_PACIENTE, { pacienteId })}
        disabled={c.enviando}
        style={styles.accion}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  paciente: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  jornada: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  tarjeta: {
    marginBottom: spacing.sm,
  },
  cabeceraPaso: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 48,
  },
  numeroPaso: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: spacing.md,
    height: spacing.lg + spacing.xs,
    justifyContent: "center",
    width: spacing.lg + spacing.xs,
  },
  numeroPasoTexto: {
    color: colors.surface,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  tituloPasoCaja: {
    flex: 1,
  },
  tituloPaso: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  cuerpoPaso: {
    marginTop: spacing.md,
  },
  subseccion: {
    marginBottom: spacing.sm,
  },
  tituloSubseccion: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  texto: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
  },
  textoTenue: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
  },
  textoError: {
    color: colors.danger,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
  },
  textoAviso: {
    color: colors.warning,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
  },
  textoExito: {
    color: colors.success,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  accion: {
    marginTop: spacing.sm,
  },
});
