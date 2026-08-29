import { useCallback, useEffect, useMemo, useState } from "react";

import { listarComunidades } from "../territorio/api.js";
import { actualizarPaciente } from "./api.js";
import { CAMPOS_REGISTRO_PACIENTE } from "./campos.js";
import { OPCIONES_SEXO } from "./usePacientesListado.js";

export const CAMPOS_EDICION_PACIENTE = CAMPOS_REGISTRO_PACIENTE;

export function valoresDesdePaciente(paciente) {
  return CAMPOS_EDICION_PACIENTE.reduce((valores, campo) => {
    const valor = campo.id === "comunidad" ? paciente?.comunidadId : paciente?.[campo.id];
    valores[campo.id] = valor ?? "";
    return valores;
  }, {});
}

export function hayCambiosPendientes(valores, iniciales) {
  return CAMPOS_EDICION_PACIENTE.some((campo) => valores[campo.id] !== iniciales[campo.id]);
}

export function useEdicionPaciente(paciente) {
  const iniciales = useMemo(() => valoresDesdePaciente(paciente), [paciente]);
  const [valores, setValores] = useState(iniciales);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [comunidades, setComunidades] = useState([]);

  useEffect(() => {
    setValores(iniciales);
    setErrores({});
    setError(null);
  }, [iniciales]);

  useEffect(() => {
    let vigente = true;
    listarComunidades().then((respuesta) => {
      if (!vigente) return;
      setComunidades(
        (respuesta.comunidades ?? []).map((comunidad) => ({
          valor: comunidad.id,
          etiqueta: comunidad.nombre,
        })),
      );
    });
    return () => {
      vigente = false;
    };
  }, []);

  const setCampo = useCallback((id, valor) => {
    setValores((anteriores) => ({ ...anteriores, [id]: valor }));
    setErrores((anteriores) => {
      if (!(id in anteriores)) return anteriores;
      return Object.fromEntries(Object.entries(anteriores).filter(([clave]) => clave !== id));
    });
  }, []);

  const descartar = useCallback(() => {
    setValores(iniciales);
    setErrores({});
    setError(null);
  }, [iniciales]);

  const guardar = useCallback(async () => {
    if (!paciente?.id) return { ok: false };

    setEnviando(true);
    const resultado = await actualizarPaciente(paciente.id, valores);
    setEnviando(false);
    setErrores(resultado.errores ?? {});
    setError(resultado.error);

    if (resultado.error) return { ok: false };
    return { ok: true, paciente: resultado.paciente };
  }, [paciente, valores]);

  return {
    campos: CAMPOS_EDICION_PACIENTE,
    valores,
    errores,
    error,
    enviando,
    hayCambios: hayCambiosPendientes(valores, iniciales),
    setCampo,
    descartar,
    guardar,
    catalogos: { comunidades, sexo: OPCIONES_SEXO },
  };
}
