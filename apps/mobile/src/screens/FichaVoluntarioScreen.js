import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";

import {
  CAMPOS_FICHA_VOLUNTARIO,
  ESTADOS_USUARIO,
  filasDeHistorial,
  formatearFechaCorta,
  ORIGEN_PERMISO,
  OPCIONES_ROL,
  PESTANIA_FICHA_VOLUNTARIO_POR_DEFECTO,
  PESTANIAS_FICHA_VOLUNTARIO,
  TIPOS_DE_PRESENTACION,
  useFichaVoluntario,
  useGestionPermisos,
  useHistorialDePersona,
} from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  ScreenContainer,
  StatusChip,
  Tabs,
} from "../components";

const CATALOGOS = { roles: OPCIONES_ROL, estadoUsuario: ESTADOS_USUARIO };

/** Espejo de valorDeCampo() en VoluntariosPage.jsx (web), adaptado a RN. No es un componente
 * del catalogo (#281): es presentacion propia de esta pantalla, igual que su par web es propio
 * de esa pagina y no un componente compartido. */
function valorDeCampo(campo, valores) {
  const valor = valores[campo.desde ?? campo.id];

  if (campo.tipo === TIPOS_DE_PRESENTACION.ESTADO) {
    const opcion = (CATALOGOS[campo.etiquetasDesde] ?? []).find((entrada) => entrada.value === valor);
    return <StatusChip status={opcion?.clave ?? valor} label={opcion?.label} />;
  }

  if (campo.tipo === TIPOS_DE_PRESENTACION.CHIPS) {
    const elementos = Array.isArray(valor) ? valor : [];
    if (elementos.length === 0) return <Text style={styles.valorTexto}>—</Text>;
    return (
      <View style={styles.chips}>
        {elementos.map((elemento) => (
          <View key={String(elemento)} style={styles.chip}>
            <Text style={styles.chipTexto}>{elemento}</Text>
          </View>
        ))}
      </View>
    );
  }

  if (campo.etiquetasDesde) {
    const opcion = (CATALOGOS[campo.etiquetasDesde] ?? []).find((entrada) => entrada.value === valor);
    return <Text style={styles.valorTexto}>{opcion ? opcion.label : (valor ?? "—")}</Text>;
  }

  if (campo.tipo === TIPOS_DE_PRESENTACION.FECHA) {
    return <Text style={styles.valorTexto}>{valor ? formatearFechaCorta(valor) : "—"}</Text>;
  }

  return <Text style={styles.valorTexto}>{valor === null || valor === undefined || valor === "" ? "—" : String(valor)}</Text>;
}

function Campo({ campo, valores }) {
  return (
    <View style={styles.campo}>
      <Text style={styles.etiqueta}>{campo.label}</Text>
      {valorDeCampo(campo, valores)}
    </View>
  );
}

/** Capitaliza la primera letra de un valor de enum para mostrarlo, sin una tabla de traduccion
 * aparte. Mismo criterio que capitalizar() en VoluntariosPage.jsx (web). */
function capitalizar(texto) {
  const cadena = String(texto ?? "");
  return cadena.charAt(0).toUpperCase() + cadena.slice(1);
}

/**
 * Permisos efectivos del perfil (criterio 2 de #273), solo lectura: useGestionPermisos() trae
 * ademas conceder/revocar/restablecer, pero esta pantalla no los dibuja -- mostrar los permisos
 * no habilita editarlos, eso vive en la web (issue #108, ModalPermisosUsuario.jsx).
 */
function SeccionPermisos({ perfilId }) {
  const { modulos, cargando, error } = useGestionPermisos(perfilId);

  if (cargando) return <LoadingState />;
  if (error) return <ErrorState message={error.mensaje} />;
  if (modulos.length === 0) return <EmptyState message="No hay permisos que mostrar." />;

  return (
    <View>
      {modulos.map(({ modulo, permisos }) => (
        <View key={modulo} style={styles.moduloPermisos}>
          <Text style={styles.moduloTitulo}>{modulo}</Text>
          {permisos.map((permiso) => (
            <View key={permiso.clave} style={styles.filaPermiso}>
              <Text style={styles.permisoTexto}>{permiso.descripcion || permiso.clave}</Text>
              <StatusChip
                status={permiso.origen}
                label={permiso.origen === ORIGEN_PERMISO.INDIVIDUAL ? "Individual" : "Del rol"}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function SeccionHistorial({ perfilId }) {
  const { historial, cargando, error, recargar } = useHistorialDePersona(perfilId);
  const filas = filasDeHistorial(historial);

  if (cargando) return <LoadingState />;
  if (error) return <ErrorState message={error.mensaje} onRetry={recargar} />;
  if (filas.length === 0) {
    return <EmptyState message="Esta persona todavia no participo en ninguna jornada." />;
  }

  return (
    <View>
      {filas.map((jornada) => (
        // Sin onPress: el catalogo movil (#281) no tiene una pantalla de detalle para una
        // jornada que no esta en curso (issue #273, criterio 5 - ver PLAN.md, seccion 0.1). La
        // tarjeta queda informativa, mismo criterio que JornadasAsignadasScreen usa para las
        // jornadas que no estan en curso.
        <Card key={jornada.id} style={styles.tarjetaJornada}>
          <View style={styles.filaJornadaCabecera}>
            <Text style={styles.jornadaNombre}>{jornada.nombre}</Text>
            <StatusChip status={jornada.estado} label={capitalizar(jornada.estado)} />
          </View>
          <Text style={styles.jornadaDato}>
            {formatearFechaCorta(jornada.fecha)}
            {jornada.responsabilidad !== "—" ? ` · ${jornada.responsabilidad}` : ""}
          </Text>
          <Text style={styles.jornadaDato}>
            {jornada.pacientesAtendidos}{" "}
            {jornada.pacientesAtendidos === 1 ? "paciente atendido" : "pacientes atendidos"}
          </Text>
        </Card>
      ))}
    </View>
  );
}

export default function FichaVoluntarioScreen() {
  const { params } = useRoute();
  const perfilId = params?.perfilId;
  const { ficha, cargando, error, recargar } = useFichaVoluntario(perfilId);
  const [pestaniaActiva, setPestaniaActiva] = useState(PESTANIA_FICHA_VOLUNTARIO_POR_DEFECTO);

  if (cargando && !ficha) {
    return (
      <ScreenContainer scrollable={false}>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (error && !ficha) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  if (!ficha) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message="No se encontro a esta persona." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.nombre}>{ficha.nombreCompleto || "Sin nombre"}</Text>

      <Tabs tabs={PESTANIAS_FICHA_VOLUNTARIO} activo={pestaniaActiva} onChange={setPestaniaActiva}>
        {pestaniaActiva === "datos" && (
          <>
            {CAMPOS_FICHA_VOLUNTARIO.map((campo) => (
              <Campo key={campo.id} campo={campo} valores={ficha} />
            ))}

            <Card title="Permisos" style={styles.tarjetaPermisos}>
              <SeccionPermisos perfilId={perfilId} />
            </Card>
          </>
        )}

        {pestaniaActiva === "historial" && <SeccionHistorial perfilId={perfilId} />}
      </Tabs>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  nombre: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  campo: {
    marginBottom: spacing.md,
  },
  etiqueta: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs / 2,
  },
  valorTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: spacing.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.text,
  },
  tarjetaPermisos: {
    marginTop: spacing.sm,
  },
  moduloPermisos: {
    marginBottom: spacing.md,
  },
  moduloTitulo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  filaPermiso: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  permisoTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.text,
    flexShrink: 1,
  },
  tarjetaJornada: {
    marginBottom: spacing.sm,
  },
  filaJornadaCabecera: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  jornadaNombre: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    flexShrink: 1,
  },
  jornadaDato: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
});
