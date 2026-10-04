import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import {
  FILTROS_AGENDA_CITAS,
  OPCIONES_VISTA_AGENDA,
  useAgendaCitas,
  useCambioEstadoCita,
  VISTAS_AGENDA,
} from "@ecopac/shared";
import { colors, moduleAccents, radii, spacing, typography } from "@ecopac/ui-tokens";

import {
  ErrorState,
  FilterBar,
  LoadingState,
  PageHeader,
  ScreenContainer,
  SecondaryButton,
} from "../components";
import { useJornadaActivaCompartida } from "../contexto/JornadaActivaProvider";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { ROUTES } from "../navigation/rutas";
import AgendaDelDia from "./agenda-citas/AgendaDelDia";
import CalendarioAnio from "./agenda-citas/CalendarioAnio";
import CalendarioMes from "./agenda-citas/CalendarioMes";
import ModalDetalleCita from "./agenda-citas/ModalDetalleCita";

// La agenda de citas en el telefono (issue #927): el dia, por horario, de la jornada activa. Los
// mismos filtros que la web, el cambio de estado y Atender, que abre la consulta movil de siempre
// con la cita. No se agenda desde aqui: la issue pide la agenda del dia, no el formulario.
//
// Arranca en el dia. El mes y el anio sirven para moverse (pedido en la revision de la fase 7):
// cada dia dice cuantas citas tiene, y al tocarlo se vuelve a la lista de ese dia.
//
// Todo lo que decide es useAgendaCitas() y useCambioEstadoCita() en shared, como en la web.
export default function AgendaCitasScreen() {
  const navigation = useNavigation();
  const { rol, perfil } = useSesionCompartida();
  const { jornadaId: jornadaActivaId } = useJornadaActivaCompartida();
  const agenda = useAgendaCitas({
    rol,
    perfilId: perfil?.id ?? null,
    vistaInicial: VISTAS_AGENDA.DIA,
  });
  const estado = useCambioEstadoCita({ rol, perfilId: perfil?.id ?? null });
  const [abierta, setAbierta] = useState(null);

  // Arranca filtrada por la jornada activa, una sola vez: si despues se quita el filtro, se respeta.
  const filtroInicialPuesto = useRef(false);
  const { setFiltro } = agenda;
  useEffect(() => {
    if (filtroInicialPuesto.current || !jornadaActivaId) return;
    filtroInicialPuesto.current = true;
    setFiltro("jornadaId", jornadaActivaId);
  }, [jornadaActivaId, setFiltro]);

  // Al volver de la consulta, la cita ya cambio de estado.
  const { recargar } = agenda;
  useFocusEffect(
    useCallback(() => {
      recargar();
    }, [recargar]),
  );

  if (!agenda.permitido) {
    return (
      <ScreenContainer scrollable={false}>
        <ErrorState message="Tu rol no tiene acceso a la agenda de citas." />
      </ScreenContainer>
    );
  }

  const cerrar = () => {
    estado.limpiarError();
    setAbierta(null);
  };

  const trasCambio = async (cita) => {
    await agenda.recargar();
    setAbierta(cita ?? null);
  };

  return (
    <ScreenContainer>
      <PageHeader title="Citas" subtitle={agenda.titulo} accent={moduleAccents.pacientes} />

      <FilterBar
        campos={FILTROS_AGENDA_CITAS}
        valores={agenda.filtros}
        onChange={agenda.setFiltro}
        catalogos={agenda.catalogos}
      />

      <View style={estilos.vistas} accessibilityRole="tablist">
        {OPCIONES_VISTA_AGENDA.map((opcion) => {
          const activa = agenda.vista === opcion.value;
          return (
            <Pressable
              key={opcion.value}
              onPress={() => agenda.setVista(opcion.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activa }}
              style={[estilos.vista, activa && estilos.vistaActiva]}
            >
              <Text style={[estilos.vistaTexto, activa && estilos.vistaTextoActiva]}>
                {opcion.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={estilos.barra}>
        <SecondaryButton title="Anterior" size="sm" variant="neutra" onPress={agenda.anterior} />
        <SecondaryButton title="Hoy" size="sm" variant="neutra" onPress={agenda.irAHoy} />
        <SecondaryButton title="Siguiente" size="sm" variant="neutra" onPress={agenda.siguiente} />
      </View>

      {agenda.puedeVerMisCitas || agenda.hayFiltros ? (
        <View style={estilos.barra}>
          {agenda.puedeVerMisCitas ? (
            <SecondaryButton
              title={agenda.misCitas ? "Ver todas las citas" : "Mis citas"}
              size="sm"
              onPress={() => agenda.setMisCitas(!agenda.misCitas)}
            />
          ) : null}
          {agenda.hayFiltros ? (
            <SecondaryButton
              title="Limpiar filtros"
              size="sm"
              variant="neutra"
              onPress={agenda.limpiarFiltros}
            />
          ) : null}
        </View>
      ) : null}

      {agenda.vista === VISTAS_AGENDA.DIA && !agenda.clinicaFiltrada ? (
        <Text style={estilos.nota}>
          Filtra por una clínica para ver cuántas salas quedan libres en cada horario.
        </Text>
      ) : null}

      {agenda.error ? (
        <ErrorState message={agenda.error.mensaje} onRetry={agenda.recargar} />
      ) : agenda.cargando && agenda.citas.length === 0 ? (
        <LoadingState />
      ) : agenda.vista === VISTAS_AGENDA.ANIO ? (
        <CalendarioAnio
          meses={agenda.meses}
          onAbrirMes={(fecha) => agenda.irA(fecha, VISTAS_AGENDA.MES)}
        />
      ) : agenda.vista === VISTAS_AGENDA.MES ? (
        <CalendarioMes semanas={agenda.semanas} onAbrirDia={(fecha) => agenda.irA(fecha)} />
      ) : (
        <AgendaDelDia
          horarios={agenda.horarios}
          clinica={agenda.clinicaFiltrada}
          puedeAgendar={false}
          onAbrirCita={setAbierta}
        />
      )}

      {abierta ? (
        <ModalDetalleCita
          // Otra cita u otro estado: el detalle empieza de nuevo.
          key={`${abierta.id}-${abierta.estado}`}
          cita={abierta}
          acciones={estado.acciones(abierta)}
          enviando={estado.enviando}
          error={estado.error}
          errores={estado.errores}
          onClose={cerrar}
          onVerPaciente={() => {
            cerrar();
            navigation.navigate(ROUTES.FICHA_PACIENTE, { pacienteId: abierta.pacienteId });
          }}
          onAtender={async () => {
            const resultado = await estado.atender(abierta);
            if (!resultado.ok) return;
            cerrar();
            navigation.navigate(ROUTES.CONSULTA, {
              pacienteId: abierta.pacienteId,
              cita: resultado.paraConsulta,
            });
          }}
          onRegresar={async () => {
            const resultado = await estado.regresar(abierta);
            if (resultado.ok) await trasCambio(resultado.cita);
          }}
          onCancelar={async (motivo) => {
            const resultado = await estado.cancelar(abierta, motivo);
            if (resultado.ok) await trasCambio(resultado.cita);
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}

const estilos = StyleSheet.create({
  vistas: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    padding: spacing.xs,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  vista: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  vistaActiva: {
    backgroundColor: colors.primary,
  },
  vistaTexto: {
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  vistaTextoActiva: {
    color: colors.surface,
    fontWeight: typography.weights.semibold,
  },
  barra: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  nota: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
});
