// Tipo de una accion por su rotulo: de el sale el icono de los botones de las dos apps.
//
// Las altas se escribian de tres maneras -"+ Nuevo Proyecto" con el signo dentro del texto,
// "Nuevo paciente" sin nada, "Registrar Lote" con un "+" a veces si y a veces no- y los borrados
// igual: "Eliminar" en texto rojo, en contorno, con icono o sin el. Se decide aqui, una vez, a
// partir del verbo con que empieza el rotulo, para que ningun boton dependa de que quien lo
// escribio se acordara. Cada app traduce el tipo a su icono (el "+" y el basurero): shared no
// devuelve JSX.
//
//   - Alta (Nuevo, Nueva, Crear, Agregar, Anadir, Registrar, Alta de, o un "+" inicial).
//   - Borrado (Eliminar, Borrar, Quitar).
//
// "Desactivar", "Anular" y "Rechazar" NO son borrado a proposito: no borran nada, cambian un
// estado que se puede revertir o que queda en la bitacora, y dibujarlos con un basurero diria lo
// contrario de lo que hacen.

export const TIPOS_DE_ACCION = Object.freeze({
  ALTA: "alta",
  BORRADO: "borrado",
});

const PATRON_ALTA = /^(nuev[oa]s?|crear|agregar|añadir|anadir|registrar|alta de)(\s|$)/i;
const PATRON_BORRADO = /^(eliminar|borrar|quitar)(\s|$)/i;

// Un "+" escrito dentro del propio texto ("+ Nuevo Proyecto") se quita: el signo lo pone el icono,
// y dejar los dos dibuja "+ + Nuevo Proyecto".
const SIGNO_MAS_INICIAL = /^\+\s*/;

/**
 * @param {unknown} rotulo
 * @returns {"alta"|"borrado"|null}
 */
export function tipoDeAccion(rotulo) {
  if (typeof rotulo !== "string") return null;
  const limpio = rotulo.trim();
  if (SIGNO_MAS_INICIAL.test(limpio)) return TIPOS_DE_ACCION.ALTA;
  if (PATRON_ALTA.test(limpio)) return TIPOS_DE_ACCION.ALTA;
  if (PATRON_BORRADO.test(limpio)) return TIPOS_DE_ACCION.BORRADO;
  return null;
}

/**
 * El rotulo sin el "+" que algunas pantallas escribian a mano. Lo que no es texto pasa tal cual.
 *
 * @template T
 * @param {T} rotulo
 * @returns {T|string}
 */
export function rotuloSinSigno(rotulo) {
  return typeof rotulo === "string" ? rotulo.replace(SIGNO_MAS_INICIAL, "") : rotulo;
}
