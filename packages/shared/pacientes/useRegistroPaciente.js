import { useCallback, useEffect, useMemo, useState } from "react";

import { calcularEdad } from "../formato/fechas.js";
import { useAltaDeComunidadEnLinea } from "../territorio/useAltaDeComunidadEnLinea.js";
import { useCascadaTerritorial } from "../territorio/useCascadaTerritorial.js";
import { listarIdiomas } from "./idiomas.api.js";
import { buscarPacientes, registrarPaciente } from "./api.js";
import { CAMPOS_REGISTRO_PACIENTE, OPCIONES_SEXO } from "./campos.js";
import { advertirPacienteDuplicado } from "./validaciones.js";

const VALORES_INICIALES = CAMPOS_REGISTRO_PACIENTE.reduce((valores, campo) => {
  valores[campo.id] = "";
  return valores;
}, {});

export function useRegistroPaciente({ comunidadInicial = null, nombresInicial = "", rol } = {}) {
  const [valores, setValores] = useState(() =>
    nombresInicial ? { ...VALORES_INICIALES, nombres: nombresInicial } : VALORES_INICIALES,
  );
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [registrado, setRegistrado] = useState(null);

  const [idiomas, setIdiomas] = useState([]);
  const [advertenciaDuplicado, setAdvertenciaDuplicado] = useState(null);

  useEffect(() => {
    let vigente = true;
    // listarIdiomas() ya devuelve las opciones con value/label.
    listarIdiomas().then(({ idiomas: opciones }) => {
      if (vigente) setIdiomas(opciones);
    });
    return () => {
      vigente = false;
    };
  }, []);

  // setCampo se declara ANTES de registrarComunidad, que lo captura en su cuerpo y lo lista en
  // sus dependencias. Estaba declarado mas abajo, y como `const` no se iza, el useCallback de
  // registrarComunidad leia la variable dentro de su zona muerta temporal: el modal de alta
  // reventaba en el primer render con "Cannot access 'setCampo' before initialization" y la
  // pantalla quedaba en blanco. El orden de las declaraciones es lo unico que cambia.
  const setCampo = useCallback((id, valor) => {
    setValores((anteriores) => ({ ...anteriores, [id]: valor }));
    setErrores((anteriores) => {
      if (!(id in anteriores)) return anteriores;
      return Object.fromEntries(Object.entries(anteriores).filter(([clave]) => clave !== id));
    });
  }, []);

  const elegirComunidad = useCallback(
    (comunidadId) => setCampo("comunidad", comunidadId),
    [setCampo],
  );

  // La cascada departamento -> municipio -> comunidad vive en territorio desde la #840: el
  // formulario de edicion tenia en su lugar una lista plana de todas las comunidades del pais, y
  // hacer una segunda copia aqui era lo que llevo a que los dos formularios se separaran.
  const {
    departamentoId,
    municipioId,
    setDepartamento,
    setMunicipio,
    recargarComunidades,
    reiniciar: reiniciarTerritorio,
    catalogos: catalogosDeTerritorio,
  } = useCascadaTerritorial({
    comunidadInicial,
    alElegirComunidad: elegirComunidad,
  });

  // El alta de comunidad sin salir del formulario vive en useAltaDeComunidadEnLinea desde la
  // #838: la estrenó esta pantalla, pero el alta de jornada tiene el mismo problema y hacer dos
  // copias del mismo flujo era lo que se venia haciendo en el resto de los catalogos.
  const alCrearComunidad = useCallback(
    async (comunidad) => {
      await recargarComunidades();
      setCampo("comunidad", comunidad.id);
    },
    [recargarComunidades, setCampo],
  );

  const {
    puedeCrear: puedeCrearComunidad,
    crear: registrarComunidad,
    errores: erroresComunidad,
    creando: creandoComunidad,
  } = useAltaDeComunidadEnLinea({ municipioId, rol, alCrear: alCrearComunidad });

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

  const reiniciar = useCallback(() => {
    setValores(VALORES_INICIALES);
    setErrores({});
    setError(null);
    setRegistrado(null);
    reiniciarTerritorio();
    setAdvertenciaDuplicado(null);
  }, [reiniciarTerritorio]);

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
    puedeCrearComunidad,
    registrarComunidad,
    erroresComunidad,
    creandoComunidad,
    catalogos: { ...catalogosDeTerritorio, idiomas, sexo: OPCIONES_SEXO },
  };
}
