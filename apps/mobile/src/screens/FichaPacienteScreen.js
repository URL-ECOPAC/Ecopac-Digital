import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, moduleAccents, radii, spacing, typography } from "@ecopac/ui-tokens";

import {
  CAMPOS_FICHA_PACIENTE,
  cabeceraDePaciente,
  permisosDeFicha,
  pestaniasDeFicha,
  resolverPestaniaDeFicha,
  textoDeCampoDeFicha,
  usePaciente,
  valoresDeFichaPaciente,
} from "@ecopac/shared";

import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  StatusChip,
  Tabs,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";
import CondicionesPacienteSeccion from "./ficha-paciente/CondicionesPacienteSeccion";
import SignosVitalesSeccion from "./ficha-paciente/SignosVitalesSeccion";
import RecetasPacienteSeccion from "./ficha-paciente/RecetasPacienteSeccion";
import ModalEdicionPaciente from "./ModalEdicionPaciente";

// Ficha del paciente en movil. Espejo de apps/web/src/pages/FichaPacientePage.jsx: mismo hook
// (usePaciente), mismos descriptores (CAMPOS_FICHA_PACIENTE, valoresDeFichaPaciente,
// pestaniasDeFicha) y las mismas cuatro pestanas.
//
// QUE ESTABA MAL (issue #838)
//
// 1. NO LEIA AL PACIENTE. La pantalla se conformaba con `route.params.paciente`, que es la FILA
//    DEL LISTADO de busqueda: id, nombres, apellidos, edad, comunidad, ficha y condiciones, y
//    nada mas (COLUMNAS_DE_BUSQUEDA_PACIENTE, pacientes/api.js). DPI, tipo de sangre, idioma,
//    telefono, responsable, parentesco, departamento y municipio no venian en esa fila: por eso
//    "no aparecen todos los datos", y por eso el formulario de edicion abria medio vacio -- le
//    llegaba esa misma fila, no el paciente. Ahora se pide con usePaciente(id), la misma llamada
//    que hace la web, y la fila del listado solo sirve de adelanto mientras carga.
// 2. LEIA CAMPOS QUE NO EXISTEN. El encabezado pintaba `paciente.nombre`, `paciente.apellido`,
//    `paciente.documento` y `paciente.cui`. Ninguno de esos cuatro es un campo del modelo (son
//    `nombres`, `apellidos` y `dpi`), asi que el nombre salia vacio y el documento siempre "N/A".
// 3. NO TENIA LOS DATOS GENERALES. Solo ofrecia condiciones, signos y recetas; la pestana de
//    datos -- la que tiene DPI, idioma, telefono, responsable... -- no existia en movil.
// 4. Colores escritos a mano (#0284c7, #059669, #f8fafc...) en vez de @ecopac/ui-tokens, y
//    TouchableOpacity sueltos en vez del catalogo de componentes.

export default function FichaPacienteScreen({ route, navigation }) {
  const { paciente: pacienteDeLaLista, pacienteId } = route.params || {};
  const { perfil } = useSesionCompartida();
  const rol = perfil?.rol;

  const id = pacienteId ?? pacienteDeLaLista?.id ?? null;
  const { paciente, cargando, error, recargar } = usePaciente(id, { rol });

  const permisos = permisosDeFicha(rol);
  const pestanias = pestaniasDeFicha(rol);
  const [pestaniaPedida, setPestaniaPedida] = useState(pestanias[0]?.id);
  const pestaniaActiva = resolverPestaniaDeFicha(pestaniaPedida, rol);
  const [editando, setEditando] = useState(false);

  if (!id) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message="No se indicó de qué paciente es esta ficha." />
      </ScreenContainer>
    );
  }

  // Mientras llega la consulta se pinta la cabecera con lo que ya traia la fila del listado, para
  // no dejar la pantalla en blanco despues de tocar un resultado. Los datos completos llegan con
  // `paciente`.
  if (cargando && !paciente) {
    return (
      <ScreenContainer scrollable={false}>
        <LoadingState message="Cargando la ficha del paciente..." />
      </ScreenContainer>
    );
  }

  if (error && !paciente) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  if (!paciente) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message="Este expediente no existe o tu rol no puede verlo." />
      </ScreenContainer>
    );
  }

  const cabecera = cabeceraDePaciente(paciente);
  const valores = valoresDeFichaPaciente(paciente);

  return (
    <ScreenContainer>
      <PageHeader
        title={cabecera.nombreCompleto ?? "Paciente sin nombre"}
        subtitle={
          cabecera.numeroFicha ? `Expediente ${cabecera.numeroFicha}` : "Expediente sin número"
        }
        accent={moduleAccents.pacientes}
      />

      <Card style={estilos.identidad}>
        <Text style={estilos.dpi}>
          {valores.dpi ? `DPI: ${valores.dpi}` : "Sin DPI registrado"}
        </Text>

        <View style={estilos.chips}>
          {valores.tipoSangre ? (
            <View style={estilos.chipDato}>
              <Text style={estilos.chipDatoTexto}>TIPO {valores.tipoSangre}</Text>
            </View>
          ) : null}
          {valores.sexo ? (
            <View style={estilos.chipDato}>
              <Text style={estilos.chipDatoTexto}>{String(valores.sexo).toUpperCase()}</Text>
            </View>
          ) : null}
          {valores.fechaBaja ? <StatusChip status="inactivo" label="Dado de baja" /> : null}
        </View>

        <View style={estilos.resumen}>
          <Dato etiqueta="Edad" valor={cabecera.edad} />
          <Dato etiqueta="Comunidad" valor={cabecera.comunidad} />
          <Dato etiqueta="Teléfono" valor={valores.telefonoContacto} />
        </View>

        {cabecera.condiciones.length > 0 ? (
          <View style={estilos.condiciones}>
            <Text style={estilos.rotulo}>Condiciones</Text>
            <View style={estilos.chips}>
              {cabecera.condiciones.map((condicion) => (
                <StatusChip
                  key={condicion.id}
                  status={condicion.estado}
                  label={`${condicion.nombre} · ${condicion.etiquetaEstado}`}
                />
              ))}
            </View>
          </View>
        ) : null}
      </Card>

      <View style={estilos.acciones}>
        {permisos.puedeTomarTriaje ? (
          <PrimaryButton
            title="Nuevo triaje"
            onPress={() => navigation.navigate(ROUTES.TRIAJE, { paciente })}
            style={estilos.accion}
          />
        ) : null}
        {permisos.puedeCrearConsulta ? (
          <PrimaryButton
            title="Nueva consulta"
            onPress={() => navigation.navigate(ROUTES.CONSULTA, { paciente })}
            style={estilos.accion}
          />
        ) : null}
        {permisos.puedeEditar ? (
          <SecondaryButton
            title="Editar datos"
            onPress={() => setEditando(true)}
            style={estilos.accion}
          />
        ) : null}
      </View>

      <Tabs tabs={pestanias} activo={pestaniaActiva} onChange={setPestaniaPedida}>
        {pestaniaActiva === "generales" ? (
          <Card>
            {CAMPOS_FICHA_PACIENTE.map((campo) => (
              <View key={campo.id} style={estilos.fila}>
                <Text style={estilos.rotulo}>{campo.label}</Text>
                <Text style={estilos.valor}>{textoDeCampoDeFicha(campo, valores)}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {pestaniaActiva === "historial" ? (
          <CondicionesPacienteSeccion pacienteId={paciente.id} rol={rol} />
        ) : null}

        {pestaniaActiva === "signos" ? <SignosVitalesSeccion pacienteId={paciente.id} /> : null}

        {pestaniaActiva === "recetas" ? <RecetasPacienteSeccion pacienteId={paciente.id} /> : null}
      </Tabs>

      {editando ? (
        <ModalEdicionPaciente
          visible
          paciente={paciente}
          onClose={() => setEditando(false)}
          onGuardado={() => {
            setEditando(false);
            recargar();
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}

/** Un par rotulo/valor del bloque de identidad. El guion marca el hueco, igual que en la web. */
function Dato({ etiqueta, valor }) {
  return (
    <View style={estilos.dato}>
      <Text style={estilos.rotulo}>{etiqueta}</Text>
      <Text style={estilos.valor}>{valor ?? "—"}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  identidad: {
    marginBottom: spacing.md,
  },
  dpi: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  chipDato: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipDatoTexto: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  resumen: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  dato: {
    minWidth: 90,
  },
  condiciones: {
    marginTop: spacing.md,
  },
  rotulo: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    textTransform: "uppercase",
  },
  valor: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  acciones: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  accion: {
    flexGrow: 1,
  },
  fila: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
  },
});
