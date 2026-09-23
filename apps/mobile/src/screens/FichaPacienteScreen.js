import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CAMPOS_FICHA_PACIENTE,
  cabeceraDePaciente,
  pestaniasDeFicha,
  permisosDeFicha,
  resolverPestaniaDeFicha,
  textoDeCampoDeFicha,
  usePaciente,
  valoresDeFichaPaciente,
} from "@ecopac/shared";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

import { Card, ErrorState, LoadingState, PrimaryButton, SecondaryButton } from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";
import CondicionesPacienteSeccion from "./ficha-paciente/CondicionesPacienteSeccion";
import VisitasPacienteSeccion from "./ficha-paciente/VisitasPacienteSeccion";
import ModalEdicionPaciente from "./ModalEdicionPaciente";

/**
 * Ficha del paciente en movil (issues #753 y #818).
 *
 * QUE CAMBIO EN LA #818, Y POR QUE
 *
 * La pantalla recibia el PACIENTE ENTERO por navegacion (`route.params.paciente`) y el rol tambien,
 * con "medico" por defecto. De los cinco sitios que navegan hasta aqui, cuatro mandaban solo el id,
 * asi que desde la consulta, desde la receta y justo despues de registrar un paciente la ficha
 * mostraba "No se proporciono informacion del paciente".
 *
 * Ahora recibe `pacienteId` -la forma que ya usaban esos cuatro- y carga con usePaciente(), el
 * mismo hook que usa FichaPacientePage en la web. El rol sale de la sesion, no de los parametros:
 * un rol que viaja por navegacion es un rol que cualquiera puede escribir, y ademas nadie se lo
 * estaba pasando.
 *
 * La cabecera usaba paciente.nombre, .apellido, .documento y .cui. El modelo tiene `nombres`,
 * `apellidos` y `dpi` (migracion 00009), asi que renderizaba el nombre en blanco y "CUI/DPI: N/A"
 * para todo el mundo. Ahora sale de cabeceraDePaciente(), que es el descriptor de shared que la web
 * ya consume.
 */
export default function FichaPacienteScreen({ route, navigation }) {
  const { pacienteId } = route.params || {};
  const { rol } = useSesionCompartida();
  const { paciente, cargando, error, recargar } = usePaciente(pacienteId, { rol });
  const [pestaniaPedida, setPestaniaPedida] = useState("historial");
  const [editando, setEditando] = useState(false);

  const permisos = permisosDeFicha(rol);
  // ISSUE #838: "generales" se quitaba de la lista, asi que en movil faltaba la mitad del
  // expediente -- DPI, tipo de sangre, idioma, telefono, responsable, parentesco, departamento y
  // municipio-- y la unica forma de verlo era abrir el formulario de edicion. Ahora se dibuja, con
  // CAMPOS_FICHA_PACIENTE y textoDeCampoDeFicha(), los mismos descriptores que usa la web: la
  // pantalla no decide ni el orden ni el formato de ningun campo.
  const pestanias = pestaniasDeFicha(rol);
  const pestaniaActiva = resolverPestaniaDeFicha(pestaniaPedida, rol);

  if (!pacienteId) {
    return (
      <View style={styles.centro}>
        <ErrorState message="No se proporcionó el paciente." />
      </View>
    );
  }

  if (cargando) {
    return (
      <View style={styles.centro}>
        <LoadingState />
      </View>
    );
  }

  // Antes no habia ningun camino de error: si la consulta fallaba, la pantalla se quedaba en
  // blanco sin decir nada.
  if (error || !paciente) {
    return (
      <View style={styles.centro}>
        <ErrorState
          message={error?.mensaje ?? "No se pudo cargar la ficha del paciente."}
          onRetry={recargar}
        />
      </View>
    );
  }

  const cabecera = cabeceraDePaciente(paciente);
  const valores = valoresDeFichaPaciente(paciente);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.encabezado}>
        <Text style={styles.nombrePaciente}>{cabecera.nombreCompleto ?? "Sin nombre"}</Text>
        <Text style={styles.detallesPaciente}>
          {[
            paciente.dpi ? `CUI/DPI: ${paciente.dpi}` : "Sin CUI/DPI registrado",
            cabecera.edad ? `Edad: ${cabecera.edad}` : null,
          ]
            .filter(Boolean)
            .join(" | ")}
        </Text>
      </View>

      <View style={styles.tabBar}>
        {pestanias.map((pestania) => (
          <TouchableOpacity
            key={pestania.id}
            style={[styles.tabItem, pestaniaActiva === pestania.id && styles.tabItemActivo]}
            onPress={() => setPestaniaPedida(pestania.id)}
          >
            <Text
              style={[styles.tabTexto, pestaniaActiva === pestania.id && styles.tabTextoActivo]}
            >
              {pestania.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.contenidoScroll}>
        {pestaniaActiva === "generales" && (
          <>
            <Card title="Datos generales">
              {CAMPOS_FICHA_PACIENTE.map((campo) => (
                <View key={campo.id} style={styles.filaDeDato}>
                  <Text style={styles.rotuloDeDato}>{campo.label}</Text>
                  <Text style={styles.valorDeDato}>{textoDeCampoDeFicha(campo, valores)}</Text>
                </View>
              ))}
            </Card>
            {/* Las condiciones cronicas son datos del paciente, no de una visita: estaban en la
                pestana de historial, y ahi el historial es la lista de visitas (issue #840). */}
            {permisos.puedeVerDatosClinicos ? (
              <CondicionesPacienteSeccion pacienteId={paciente.id} rol={rol} />
            ) : null}
          </>
        )}

        {/* Issue #840, bloque F: cada visita trae dentro sus signos, su consulta y su receta. Las
            pestanas hermanas de signos y recetas se retiran, y con ellas el apretujon de cuatro
            pestanas en el ancho de un telefono (G3). */}
        {pestaniaActiva === "historial" && (
          <VisitasPacienteSeccion
            pacienteId={paciente.id}
            paciente={paciente}
            rol={rol}
            onAbrirConsulta={(visita) =>
              navigation.navigate(ROUTES.CONSULTA, {
                pacienteId: paciente.id,
                jornadaId: visita.jornadaId,
              })
            }
            onAbrirEntrega={(visita) =>
              navigation.navigate(ROUTES.ENTREGA_MEDICAMENTOS, { atencionId: visita.atencionId })
            }
          />
        )}
      </ScrollView>

      <View style={styles.accionesBar}>
        {/* "Nueva consulta" es la unica accion de captura (issue #840): no hay "Nuevo triaje", los
            signos son un paso dentro de la consulta. Un voluntario la ve y registra los signos. */}
        {permisos.puedeEditar && (
          <SecondaryButton
            title="Editar datos"
            onPress={() => setEditando(true)}
            style={styles.botonAccion}
          />
        )}
        {permisos.puedeNuevaConsulta && (
          <PrimaryButton
            title="Nueva consulta"
            onPress={() => navigation.navigate(ROUTES.CONSULTA, { pacienteId: paciente.id })}
            style={styles.botonAccion}
          />
        )}
      </View>

      {editando && (
        <ModalEdicionPaciente
          visible={editando}
          paciente={paciente}
          onClose={() => setEditando(false)}
          onGuardado={() => {
            setEditando(false);
            recargar();
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  centro: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.md,
  },
  encabezado: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  nombrePaciente: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  detallesPaciente: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActivo: {
    borderBottomColor: colors.primary,
  },
  tabTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
  },
  tabTextoActivo: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  contenidoScroll: {
    padding: spacing.md,
  },
  // Un par rotulo/valor de la pestana de datos generales. El guion largo que pone
  // textoDeCampoDeFicha() para un campo vacio tiene que verse como un hueco, para que se note que
  // falta capturarlo.
  filaDeDato: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
  },
  rotuloDeDato: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  valorDeDato: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  accionesBar: {
    flexDirection: "row",
    padding: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  botonAccion: {
    flex: 1,
  },
});
