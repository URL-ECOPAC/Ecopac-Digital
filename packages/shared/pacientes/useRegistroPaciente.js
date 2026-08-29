import { useCallback, useEffect, useMemo, useState } from "react";

import { calcularEdad } from "../formato/fechas.js";
import { listarComunidades, listarDepartamentos, listarMunicipios } from "../territorio/api.js";
import { buscarPacientes, registrarPaciente } from "./api.js";
import { CAMPOS_REGISTRO_PACIENTE } from "./campos.js";
import { OPCIONES_SEXO } from "./usePacientesListado.js";
import { advertirPacienteDuplicado } from "./validaciones.js";

const VALORES_INICIALES = CAMPOS_REGISTRO_PACIENTE.reduce((valores, campo) => {
  valores[campo.id] = "";
  return valores;
}, {});

function aOpciones(filas = []) {
  return filas.map((fila) => ({ valor: fila.id, etiqueta: fila.nombre }));
}

export function useRegistroPaciente() {
  const [valores, setValores] = useState(VALORES_INICIALES);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [registrado, setRegistrado] = useState(null);

  const [departamentoId, setDepartamentoId] = useState(null);
  const [municipioId, setMunicipioId] = useState(null);
  const [departamentos, setDepartamentos] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [comunidades, setComunidades] = useState([]);
  const [advertenciaDuplicado, setAdvertenciaDuplicado] = useState(null);

  useEffect(() => {
    let vigente = true;
    listarDepartamentos().then(({ departamentos: filas }) => {
      if (vigente) setDepartamentos(aOpciones(filas));
    });
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (!departamentoId) {
      setMunicipios([]);
      return undefined;
    }
    let vigente = true;
    listarMunicipios({ departamentoId }).then(({ municipios: filas }) => {
      if (vigente) setMunicipios(aOpciones(filas));
    });
    return () => {
      vigente = false;
    };
  }, [departamentoId]);

  useEffect(() => {
    if (!municipioId) {
      setComunidades([]);
      return undefined;
    }
    let vigente = true;
    listarComunidades({ municipioId }).then(({ comunidades: filas }) => {
      if (vigente) setComunidades(aOpciones(filas));
    });
    return () => {
      vigente = false;
    };
  }, [municipioId]);

  const { nombres, apellidos, fechaNacimiento } = valores;

  useEffect(() => {
    if (!nombres || !apellidos || !fechaNacimiento) {
      setAdvertenciaDuplicado(null);
      return undefined;
    }

    let vigente = true;
    buscarPacientes({ termino: `${nombres} ${apellidos}`.trim(), porPagina: 20 }).then(
      ({ pacientes, error: errorDeConsulta }) => {
        if (!vigente) return;
        setAdvertenciaDuplicado(
          errorDeConsulta
            ? null
            : advertirPacienteDuplicado({ pacientes, nombres, apellidos, fechaNacimiento }),
        );
      },
    );

    return () => {
      vigente = false;
    };
  }, [nombres, apellidos, fechaNacimiento]);

  const setCampo = useCallback((id, valor) => {
    setValores((anteriores) => ({ ...anteriores, [id]: valor }));
    setErrores((anteriores) => {
      if (!(id in anteriores)) return anteriores;
      return Object.fromEntries(Object.entries(anteriores).filter(([clave]) => clave !== id));
    });
  }, []);

  const setDepartamento = useCallback((id) => {
    setDepartamentoId(id);
    setMunicipioId(null);
    setComunidades([]);
    setValores((anteriores) => ({ ...anteriores, comunidad: "" }));
  }, []);

  const setMunicipio = useCallback((id) => {
    setMunicipioId(id);
    setValores((anteriores) => ({ ...anteriores, comunidad: "" }));
  }, []);

  const reiniciar = useCallback(() => {
    setValores(VALORES_INICIALES);
    setErrores({});
    setError(null);
    setRegistrado(null);
    setDepartamentoId(null);
    setMunicipioId(null);
    setComunidades([]);
    setAdvertenciaDuplicado(null);
  }, []);

  const registrar = useCallback(async () => {
    setEnviando(true);
    const resultado = await registrarPaciente(valores);
    setEnviando(false);
    setErrores(resultado.errores ?? {});
    setError(resultado.error);

    if (resultado.error) return { ok: false };

    setRegistrado(resultado.paciente);
    return { ok: true, paciente: resultado.paciente };
  }, [valores]);

  const edad = useMemo(
    () => calcularEdad(valores.fechaNacimiento)?.texto ?? null,
    [valores.fechaNacimiento],
  );

  return {
    campos: CAMPOS_REGISTRO_PACIENTE,
    valores,
    errores,
    error,
    enviando,
    edad,
    advertenciaDuplicado,
    registrado,
    departamentoId,
    municipioId,
    setCampo,
    setDepartamento,
    setMunicipio,
    registrar,
    reiniciar,
    catalogos: { departamentos, municipios, comunidades, sexo: OPCIONES_SEXO },
  };
}
