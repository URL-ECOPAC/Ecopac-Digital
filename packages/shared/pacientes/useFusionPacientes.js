// View model de la comparacion y confirmacion de fusion de dos expedientes (issue #637).
//
// Mismo patron que useDesactivacionUsuario.js (packages/shared/usuarios/): `abrir()` deja el
// dialogo listo, `confirmar()` envia y devuelve { ok }. La diferencia es que aca `abrir()` no
// solo prepara estado local: trae los dos expedientes completos con obtenerPaciente() (api.js),
// que ya devuelve todo lo que CAMPOS_FICHA_PACIENTE necesita (comunidad con municipio y
// departamento embebidos, catalogoIdioma, condicionesCronicas), asi que la pantalla de
// comparacion no arma una consulta propia.
//
// Quien decide cual paciente sobrevive es la persona que usa la pantalla (criterio 3 de #637):
// este hook no elige por su cuenta, `elegirSobreviviente(id)` solo guarda la eleccion hasta que
// `confirmar()` la envia.
//
// El chequeo real de quien puede fusionar vive en el servidor (fn_fusionar_pacientes, 00101, mas
// estrecho que "puede editar pacientes"): fusionarPacientes() (duplicados.api.js) ya hace el
// espejo de UX con puedeFusionarPacientes(rolUsuario) antes de llamar, asi que este hook no lo
// repite -- mismo criterio que useDesactivacionUsuario.js no repite el rol, solo pasa `rol` para
// que la funcion de api.js decida.

import { useCallback, useState } from "react";

import { obtenerPaciente } from "./api.js";
import { fusionarPacientes } from "./duplicados.api.js";

const ESTADO_INICIAL = {
  pacienteA: null,
  pacienteB: null,
  sobrevivienteId: null,
  cargando: false,
  enviando: false,
  error: null,
};

/**
 * @param {{ rol?: string }} [opciones]
 * @returns {{
 *   pacienteA: object|null,
 *   pacienteB: object|null,
 *   sobrevivienteId: string|null,
 *   cargando: boolean,
 *   enviando: boolean,
 *   error: object|null,
 *   abrir: (pacienteAId: string, pacienteBId: string) => Promise<void>,
 *   elegirSobreviviente: (id: string) => void,
 *   cerrar: () => void,
 *   confirmar: () => Promise<{ ok: boolean, fusion?: object|null }>,
 * }}
 */
export function useFusionPacientes({ rol } = {}) {
  const [estado, setEstado] = useState(ESTADO_INICIAL);

  const abrir = useCallback(async (pacienteAId, pacienteBId) => {
    setEstado({ ...ESTADO_INICIAL, cargando: true });

    const [respuestaA, respuestaB] = await Promise.all([
      obtenerPaciente(pacienteAId),
      obtenerPaciente(pacienteBId),
    ]);

    setEstado({
      pacienteA: respuestaA.paciente,
      pacienteB: respuestaB.paciente,
      sobrevivienteId: null,
      cargando: false,
      enviando: false,
      error: respuestaA.error ?? respuestaB.error,
    });
  }, []);

  const elegirSobreviviente = useCallback((id) => {
    setEstado((anterior) => ({ ...anterior, sobrevivienteId: id }));
  }, []);

  const cerrar = useCallback(() => setEstado(ESTADO_INICIAL), []);

  const confirmar = useCallback(async () => {
    const { pacienteA, pacienteB, sobrevivienteId } = estado;
    if (!pacienteA?.id || !pacienteB?.id || !sobrevivienteId) return { ok: false };

    const absorbidoId = sobrevivienteId === pacienteA.id ? pacienteB.id : pacienteA.id;

    setEstado((anterior) => ({ ...anterior, enviando: true, error: null }));
    const resultado = await fusionarPacientes(sobrevivienteId, absorbidoId, { rolUsuario: rol });
    setEstado((anterior) => ({ ...anterior, enviando: false, error: resultado.error }));

    if (resultado.error) return { ok: false };
    return { ok: true, fusion: resultado.fusion };
  }, [estado, rol]);

  return {
    pacienteA: estado.pacienteA,
    pacienteB: estado.pacienteB,
    sobrevivienteId: estado.sobrevivienteId,
    cargando: estado.cargando,
    enviando: estado.enviando,
    error: estado.error,
    abrir,
    elegirSobreviviente,
    cerrar,
    confirmar,
  };
}
