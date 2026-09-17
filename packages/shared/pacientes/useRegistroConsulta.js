import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CODIGOS_DE_ERROR_DE_SUPABASE } from "../api/errores-de-supabase.js";
import { iniciarAtencion, obtenerCola } from "../atenciones/api.js";
import { puedeRegistrarEnJornada } from "../jornadas/validaciones.js";
import { CAMPOS_CONSULTA } from "./campos.js";
import { crearDiagnostico, listarDiagnosticos, registrarConsulta } from "./consultas.api.js";
import { puedeAdministrarDiagnosticos } from "./permisos.js";
import { seccionesConCampos } from "./consultas.secciones.js";
import { obtenerTriajes } from "./triaje.api.js";

const VALORES_INICIALES = CAMPOS_CONSULTA.reduce((valores, campo) => {
  valores[campo.id] = campo.tipo === "multi_select" ? [] : "";
  return valores;
}, {});

export const RETARDO_DE_BORRADOR_MS = 800;

export function claveDeBorrador(atencionId) {
  return `ecopac:consulta:${atencionId}`;
}

export function hayBorradorConDatos(valores = {}) {
  return Object.values(valores).some((valor) =>
    Array.isArray(valor) ? valor.length > 0 : String(valor ?? "").trim() !== "",
  );
}

export function aDatosDeConsulta(valores = {}, { expedienteId, atencionId, medicoId, jornadaId }) {
  return {
    expediente: expedienteId,
    atencion: atencionId,
    medico: medicoId,
    jornada: jornadaId,
    motivoConsulta: valores.motivoConsulta,
    antecedentes: valores.antecedentes || null,
    sintomas: valores.sintomas || null,
    exploracion: valores.exploracion || null,
    tratamiento: valores.tratamiento || null,
    observaciones: valores.observaciones || null,
    planSeguimiento: valores.planSeguimiento || null,
    diagnosticos: (valores.diagnosticos ?? []).map((id, indice) => ({
      diagnosticoId: id,
      esPrincipal: indice === 0,
    })),
  };
}

export function useRegistroConsulta({
  pacienteId,
  expedienteId,
  jornadaId,
  estadoDeJornada,
  perfilId,
  almacenamiento,
  rol,
} = {}) {
  const [valores, setValores] = useState(VALORES_INICIALES);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [guardada, setGuardada] = useState(null);
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [errorDiagnostico, setErrorDiagnostico] = useState(null);
  const [signos, setSignos] = useState(null);
  const [atencionId, setAtencionId] = useState(null);
  const [preparando, setPreparando] = useState(true);
  const borradorCargado = useRef(false);

  const bloqueo = useMemo(() => {
    if (!jornadaId) {
      return { puede: false, motivo: "No hay una jornada en curso asignada." };
    }
    if (estadoDeJornada === undefined) return { puede: true, motivo: null };
    return puedeRegistrarEnJornada(estadoDeJornada);
  }, [jornadaId, estadoDeJornada]);

  const resolverAtencion = useCallback(async () => {
    const inicio = await iniciarAtencion(pacienteId, jornadaId, { estadoDeJornada });
    if (inicio.atencion) return { atencionId: inicio.atencion.id, error: null };

    if (inicio.error?.codigo !== CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD) {
      return { atencionId: null, error: inicio.error };
    }

    const { cola, error: errorDeCola } = await obtenerCola(jornadaId);
    if (errorDeCola) return { atencionId: null, error: errorDeCola };

    const enCola = Object.values(cola)
      .flat()
      .find((fila) => fila.pacienteId === pacienteId);

    return { atencionId: enCola?.atencionId ?? null, error: enCola ? null : inicio.error };
  }, [pacienteId, jornadaId, estadoDeJornada]);

  useEffect(() => {
    let vigente = true;

    (async () => {
      if (!pacienteId || !bloqueo.puede) {
        setPreparando(false);
        return;
      }

      setPreparando(true);

      const [resuelta, respuestaTriajes] = await Promise.all([
        resolverAtencion(),
        obtenerTriajes(pacienteId),
      ]);

      if (!vigente) return;

      setAtencionId(resuelta.atencionId);
      if (resuelta.error) setError(resuelta.error);

      const delDia = (respuestaTriajes.triajes ?? []).find(
        (triaje) => triaje.atencionId === resuelta.atencionId,
      );
      setSignos(delDia ?? null);
      setPreparando(false);
    })();

    return () => {
      vigente = false;
    };
  }, [pacienteId, bloqueo.puede, resolverAtencion]);

  useEffect(() => {
    let vigente = true;
    listarDiagnosticos().then((respuesta) => {
      if (!vigente) return;
      setDiagnosticos(
        (respuesta.diagnosticos ?? []).map((fila) => ({
          value: fila.id,
          label: [fila.codigo, fila.nombre].filter(Boolean).join(" "),
        })),
      );
    });
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (!atencionId || !almacenamiento || borradorCargado.current) return;

    let vigente = true;
    (async () => {
      const guardado = await almacenamiento.getItem(claveDeBorrador(atencionId));
      if (!vigente || !guardado) {
        borradorCargado.current = true;
        return;
      }

      try {
        setValores({ ...VALORES_INICIALES, ...JSON.parse(guardado) });
      } catch {
        await almacenamiento.removeItem(claveDeBorrador(atencionId));
      }
      borradorCargado.current = true;
    })();

    return () => {
      vigente = false;
    };
  }, [atencionId, almacenamiento]);

  useEffect(() => {
    if (!atencionId || !almacenamiento || !borradorCargado.current) return undefined;
    if (!hayBorradorConDatos(valores)) return undefined;

    const temporizador = setTimeout(() => {
      almacenamiento.setItem(claveDeBorrador(atencionId), JSON.stringify(valores));
    }, RETARDO_DE_BORRADOR_MS);

    return () => clearTimeout(temporizador);
  }, [valores, atencionId, almacenamiento]);

  const setCampo = useCallback((id, valor) => {
    setValores((anteriores) => ({ ...anteriores, [id]: valor }));
  }, []);

  const descartarBorrador = useCallback(async () => {
    setValores(VALORES_INICIALES);
    if (atencionId && almacenamiento) {
      await almacenamiento.removeItem(claveDeBorrador(atencionId));
    }
  }, [atencionId, almacenamiento]);

  const guardar = useCallback(async () => {
    if (!bloqueo.puede) {
      setError({ mensaje: bloqueo.motivo });
      return { ok: false };
    }

    if (!atencionId) {
      setError({ mensaje: "No se pudo resolver la atención del paciente en esta jornada." });
      return { ok: false };
    }

    setEnviando(true);
    setError(null);

    const resultado = await registrarConsulta(
      aDatosDeConsulta(valores, { expedienteId, atencionId, medicoId: perfilId, jornadaId }),
      { estadoDeJornada },
    );

    setEnviando(false);

    if (resultado.error) {
      setError(resultado.error);
      return { ok: false };
    }

    if (almacenamiento) await almacenamiento.removeItem(claveDeBorrador(atencionId));
    setGuardada(resultado.consulta);
    return { ok: true, consulta: resultado.consulta };
  }, [
    bloqueo,
    atencionId,
    valores,
    expedienteId,
    perfilId,
    jornadaId,
    estadoDeJornada,
    almacenamiento,
  ]);

  // Alta de un diagnostico sin salir de la consulta. Antes habia que cerrarla, ir al catalogo,
  // crearlo y volver a escribir la consulta. Solo para quien puede mantener el catalogo
  // (puedeAdministrarDiagnosticos, espejo de la politica de INSERT de la 00105): a cualquier otro
  // rol la base se lo rechazaria, asi que ni se ofrece. Devuelve el id para que el selector lo
  // elija en el acto.
  const crearDiagnosticoNuevo = useCallback(async (nombre) => {
    setErrorDiagnostico(null);
    const { diagnostico, error: fallo } = await crearDiagnostico({ nombre });
    if (fallo || !diagnostico) {
      setErrorDiagnostico(fallo ?? null);
      return null;
    }
    setDiagnosticos((actuales) =>
      [
        ...actuales,
        {
          value: diagnostico.id,
          label: [diagnostico.codigo, diagnostico.nombre].filter(Boolean).join(" "),
        },
      ].sort((uno, otro) => uno.label.localeCompare(otro.label, "es")),
    );
    return diagnostico.id;
  }, []);

  return {
    secciones: seccionesConCampos(),
    valores,
    error,
    enviando,
    preparando,
    guardada,
    signos,
    atencionId,
    bloqueo,
    setCampo,
    descartarBorrador,
    guardar,
    catalogos: { diagnosticos },
    crearDiagnosticoNuevo: puedeAdministrarDiagnosticos(rol) ? crearDiagnosticoNuevo : null,
    errorDiagnostico,
  };
}
