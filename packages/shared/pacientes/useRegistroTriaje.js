import { useCallback, useMemo, useState } from "react";

import { CODIGOS_DE_ERROR_DE_SUPABASE } from "../api/errores-de-supabase.js";
import { iniciarAtencion, obtenerCola } from "../atenciones/api.js";
import { calcularEdad } from "../formato/fechas.js";
import { CAMPOS_TRIAJE } from "./campos.js";
import { puedeTomarTriaje } from "./permisos.js";
import { registrarTriaje } from "./triaje.api.js";
import { advertenciasDeTriaje, calcularImc } from "./triaje.validaciones.js";

export const VALORES_INICIALES = CAMPOS_TRIAJE.reduce((valores, campo) => {
  valores[campo.id] = "";
  return valores;
}, {});

/**
 * Si el formulario tiene algo que se perderia al salir sin guardar (issue #110).
 *
 * Mismo patron que hayCambiosPendientes de useEdicionPaciente.js: compara contra el estado
 * inicial. Un guardar() exitoso apaga el flag aunque valores no se limpie -guardado no es null
 * hasta que la persona pide explicitamente "Tomar otro triaje" (reiniciar())-, porque en ese
 * momento la pantalla ya dejo de mostrar el formulario editable (TriajeScreen renderiza la
 * tarjeta de confirmacion en su lugar) y no hay nada que un cierre de sesion pudiera perder.
 */
export function hayCambiosDeTriaje(valores, guardado) {
  if (guardado) return false;
  return Object.keys(VALORES_INICIALES).some((id) => valores[id] !== VALORES_INICIALES[id]);
}

// calcularImc() se mudo a triaje.validaciones.js en la #699: ahi vive tambien la regla que acota el
// IMC, y las dos tienen que usar la misma formula. Un nombre exportado por el barril nace en un solo
// archivo (regla del bug #365), asi que aqui se importa, no se reexporta.

export function soloSignosCapturados(valores = {}) {
  return Object.fromEntries(
    Object.entries(valores).filter(
      ([, valor]) => valor !== "" && valor !== null && valor !== undefined,
    ),
  );
}

export function useRegistroTriaje({
  pacienteId,
  fechaNacimiento,
  jornadaId,
  estadoDeJornada,
  perfilId,
  rol,
} = {}) {
  const [valores, setValores] = useState(VALORES_INICIALES);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [guardado, setGuardado] = useState(null);

  const setCampo = useCallback((id, valor) => {
    setValores((anteriores) => ({ ...anteriores, [id]: valor }));
    setErrores((anteriores) => {
      if (!(id in anteriores)) return anteriores;
      return Object.fromEntries(Object.entries(anteriores).filter(([clave]) => clave !== id));
    });
  }, []);

  const reiniciar = useCallback(() => {
    setValores(VALORES_INICIALES);
    setErrores({});
    setError(null);
    setGuardado(null);
  }, []);

  // PREVISUALIZACION, no el dato. El IMC que se guarda lo calcula la base (columna generada de la
  // 00013) y triaje.api.js nunca lo envia; esto es para que quien captura vea el numero mientras
  // escribe y note un error de unidades antes de guardar. Los dos usan la misma formula: la de
  // calcularImc(), que espeja ROUND(peso / POWER(talla/100.0, 2), 1).
  const imc = useMemo(
    () => calcularImc(valores.peso, valores.talla),
    [valores.peso, valores.talla],
  );

  const advertencias = useMemo(
    () => advertenciasDeTriaje(valores, calcularEdad(fechaNacimiento)),
    [valores, fechaNacimiento],
  );

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

    return {
      atencionId: enCola?.atencionId ?? null,
      error: enCola ? null : inicio.error,
    };
  }, [pacienteId, jornadaId, estadoDeJornada]);

  const guardar = useCallback(async () => {
    setEnviando(true);
    setError(null);

    const { atencionId, error: errorDeAtencion } = await resolverAtencion();
    if (!atencionId) {
      setEnviando(false);
      setError(errorDeAtencion);
      return { ok: false };
    }

    const resultado = await registrarTriaje(atencionId, soloSignosCapturados(valores), {
      tomadoPor: perfilId,
    });

    setEnviando(false);
    setErrores(resultado.errores ?? {});
    setError(resultado.error);

    if (resultado.error || Object.keys(resultado.errores ?? {}).length > 0) return { ok: false };

    setGuardado({ ...resultado.triaje, atencionId });
    return { ok: true, triaje: resultado.triaje, atencionId };
  }, [valores, resolverAtencion, perfilId]);

  return {
    campos: CAMPOS_TRIAJE,
    valores,
    errores,
    advertencias,
    error,
    enviando,
    guardado,
    imc,
    permitido: puedeTomarTriaje(rol),
    hayCambios: hayCambiosDeTriaje(valores, guardado),
    setCampo,
    reiniciar,
    guardar,
  };
}
