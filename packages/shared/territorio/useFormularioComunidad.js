import { useEffect, useState } from "react";

import { listarDepartamentos, listarMunicipios, obtenerComunidad } from "./api.js";

/**
 * Cascada departamento -> municipio para el formulario de alta/edicion de una comunidad (issue
 * #756). Mismo hueco que resuelve useFormularioJornada.js (jornadas/): la fila de una comunidad
 * ya guardada solo trae `municipioId`, nunca `departamentoId`, asi que editar una comunidad
 * existente primero pide obtenerComunidad(id) -que si embebe el departamento- para poder
 * preseleccionar el primer paso de la cascada.
 *
 * Los campos de texto (nombre, referenciaAcceso, esVigente) y la ubicacion del mapa no viven
 * aqui: ModalComunidad los maneja como estado local, igual que ModalPrincipioActivo.jsx -son
 * bindings simples que no necesitan pedir nada a la red.
 */
export function useFormularioComunidad(comunidadId) {
  const [departamentos, setDepartamentos] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [departamentoId, setDepartamentoId] = useState(null);
  const [municipioId, setMunicipioId] = useState(null);
  const [cargando, setCargando] = useState(Boolean(comunidadId));

  useEffect(() => {
    listarDepartamentos().then(({ departamentos: filas }) => setDepartamentos(filas ?? []));
  }, []);

  useEffect(() => {
    if (!comunidadId) {
      setDepartamentoId(null);
      setMunicipioId(null);
      setCargando(false);
      return;
    }

    setCargando(true);
    obtenerComunidad(comunidadId).then(({ comunidad }) => {
      setDepartamentoId(comunidad?.departamentoId ?? null);
      setMunicipioId(comunidad?.municipioId ?? null);
      setCargando(false);
    });
  }, [comunidadId]);

  useEffect(() => {
    if (!departamentoId) {
      setMunicipios([]);
      return;
    }
    listarMunicipios({ departamentoId }).then(({ municipios: filas }) => setMunicipios(filas ?? []));
  }, [departamentoId]);

  /** Elegir un departamento distinto invalida el municipio: puede no pertenecer al nuevo. */
  const elegirDepartamento = (nuevoDepartamentoId) => {
    setDepartamentoId(nuevoDepartamentoId);
    setMunicipioId(null);
  };

  return {
    departamentos: departamentos.map((departamento) => ({
      value: departamento.id,
      label: departamento.nombre,
    })),
    municipios: municipios.map((municipio) => ({ value: municipio.id, label: municipio.nombre })),
    departamentoId,
    elegirDepartamento,
    municipioId,
    setMunicipioId,
    cargando,
  };
}
