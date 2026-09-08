import { View, Text, StyleSheet, RefreshControl, ScrollView } from "react-native";
import { useReporteJornada } from "../../../../packages/shared/reportes/useReporteJornada";
// ✅ Ruta corregida — usa el hook desde shared que SÍ existe
import { useJornadaActiva } from "../../../../packages/shared/jornadas/useJornadaActiva";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { LoadingState, ErrorState } from "../components";

const ETIQUETAS_ESTADO = {
  planificada: " Planificada",
  en_curso: " En curso",
  finalizada: " Finalizada",
  cancelada: " Cancelada",
};

export default function ResumenJornadaScreen() {
  // ✅ El hook ya se llama correctamente y trae jornadaActiva
  const { jornadaActiva } = useJornadaActiva();
  const { rol } = useSesionCompartida();

  const {
    cargando,
    error,
    ficha,
    personal,
    medicamentos,
    recargar,
  } = useReporteJornada(jornadaActiva?.id, { rol });

  if (!jornadaActiva) {
    return (
      <View style={estilos.contenedorCentrado}>
        <Text style={estilos.texto}>No hay jornada activa seleccionada</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={estilos.contenedor}
      refreshControl={
        <RefreshControl refreshing={cargando} onRefresh={recargar} />
      }
    >
      {/* 📋 Cabecera de la jornada */}
      <View style={estilos.tarjetaPrincipal}>
        <Text style={estilos.titulo}>{ficha?.nombre || jornadaActiva.nombre}</Text>
        <Text style={estilos.subtitulo}>
          {ficha?.fecha || jornadaActiva.fecha} · {ficha?.comunidad || jornadaActiva.comunidad?.nombre}
        </Text>
        <View style={estilos.filaEstado}>
          <Text style={estilos.etiquetaEstado}>Estado:</Text>
          <Text style={estilos.valorEstado}>
            {ETIQUETAS_ESTADO[ficha?.estado] || ficha?.estado || jornadaActiva.estado}
          </Text>
        </View>
      </View>

      {cargando && <LoadingState mensaje="Cargando resumen..." />}

      {error && error.codigo === "SIN_PERMISO" ? (
        <View style={estilos.contenedorCentrado}>
          <Text style={estilos.texto}>{error.mensaje}</Text>
        </View>
      ) : error ? (
        <ErrorState mensaje={error.mensaje} alReintentar={recargar} />
      ) : null}

      {/* 📊 Contadores principales */}
      {ficha && (
        <>
          <Text style={estilos.seccionTitulo}> Avance del día</Text>

          <View style={estilos.fila}>
            <TarjetaResumen etiqueta="Pacientes Atendidos" valor={ficha.pacientes_atendidos} />
            <TarjetaResumen etiqueta="Consultas Realizadas" valor={ficha.total_consultas} />
          </View>

          <View style={estilos.fila}>
            <TarjetaResumen
              etiqueta="Medicamentos Entregados"
              valor={medicamentos.length ? medicamentos.reduce((s, m) => s + (m.cantidad || 0), 0) : 0}
            />
            <TarjetaResumen etiqueta="Personal Participante" valor={personal.length} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

// Componente tarjeta
const TarjetaResumen = ({ etiqueta, valor }) => (
  <View style={estilos.tarjeta}>
    <Text style={estilos.etiqueta}>{etiqueta}</Text>
    <Text style={estilos.valor}>{valor ?? 0}</Text>
  </View>
);

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f8fafc",
  },
  contenedorCentrado: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  tarjetaPrincipal: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  titulo: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 4,
  },
  subtitulo: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 12,
  },
  filaEstado: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  etiquetaEstado: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  valorEstado: {
    fontSize: 14,
    fontWeight: "700",
    color: "#059669",
  },
  seccionTitulo: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 12,
  },
  fila: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  tarjeta: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  etiqueta: {
    fontSize: 11,
    color: "#64748b",
    marginBottom: 6,
  },
  valor: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f766e",
  },
  texto: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 15,
  },
});