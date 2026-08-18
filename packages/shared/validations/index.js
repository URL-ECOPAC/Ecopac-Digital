// Piezas genericas de validacion, compartidas por todos los modulos.
//
// Aqui no vive ninguna regla de negocio: solo el motor que aplica lo que los descriptores de
// campos ya declaran, y la forma del resultado. Las reglas de cada modulo van en su propio
// validaciones.js (packages/shared/usuarios/validaciones.js, y asi con el resto), como manda
// docs/ARQUITECTURA-FRONTEND.md.
//
// La forma del resultado es siempre un objeto plano { campo: mensaje }, vacio cuando todo
// esta bien. Nunca un booleano: un booleano obliga a cada pantalla a inventarse el texto que
// muestra, y web y movil terminarian diciendo cosas distintas ante el mismo error.

/** Resultado cuando no hay nada que corregir. */
export const SIN_ERRORES = Object.freeze({});

/** Indica si un objeto de errores trae al menos un campo con problema. */
export function hayErrores(errores) {
  return Object.keys(errores ?? {}).length > 0;
}

/** Recorta espacios y trata cualquier cosa que no sea texto como cadena vacia. */
export function normalizarTexto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Un campo esta vacio si no hay texto, o si es una lista sin elementos. */
export function esTextoVacio(valor) {
  if (Array.isArray(valor)) return valor.length === 0;
  if (valor === null || valor === undefined) return true;
  if (typeof valor === "boolean") return false;
  return normalizarTexto(valor) === "";
}

/**
 * Aplica las reglas declaradas en un arreglo de descriptores de campo.
 *
 * Los descriptores son los mismos que dibujan el formulario (por ejemplo CAMPOS_USUARIO en
 * packages/shared/usuarios/campos.js), asi que el limite de longitud se escribe una sola vez
 * y no puede desincronizarse entre lo que el formulario permite y lo que la validacion
 * acepta. Solo se aplica lo que el descriptor puede expresar; el formato de un correo o de
 * un telefono es regla de negocio y va en el modulo.
 *
 * @param {Array<object>} campos Descriptores con { id, label, validacion }.
 * @param {object} valores Valores del formulario, indexados por el id del campo.
 * @returns {Record<string, string>} Errores por campo.
 */
export function validarConDescriptores(campos, valores) {
  const errores = {};

  for (const campo of campos ?? []) {
    const reglas = campo?.validacion;
    if (!reglas) continue;

    const valor = valores?.[campo.id];
    const etiqueta = campo.label ?? campo.id;

    if (reglas.requerido && esTextoVacio(valor)) {
      errores[campo.id] = `${etiqueta} es obligatorio.`;
      continue;
    }

    // Un campo opcional y vacio no tiene nada mas que revisar.
    if (esTextoVacio(valor)) continue;

    if (reglas.maxLongitud && normalizarTexto(valor).length > reglas.maxLongitud) {
      errores[campo.id] =
        `${etiqueta} no puede pasar de ${reglas.maxLongitud} caracteres. ` +
        `Escribiste ${normalizarTexto(valor).length}.`;
      continue;
    }

    if (reglas.maxLongitudPorEtiqueta && Array.isArray(valor)) {
      const larga = valor.find(
        (elemento) => normalizarTexto(elemento).length > reglas.maxLongitudPorEtiqueta,
      );
      if (larga !== undefined) {
        errores[campo.id] =
          `Cada valor de ${etiqueta} debe caber en ` +
          `${reglas.maxLongitudPorEtiqueta} caracteres.`;
      }
    }
  }

  return errores;
}

/**
 * Une varios objetos de errores en uno solo.
 *
 * Gana el primero que reporte cada campo: las reglas del descriptor se evaluan antes, y una
 * regla de negocio posterior no debe tapar un "es obligatorio" con un "formato invalido"
 * cuando el campo simplemente esta vacio.
 */
export function combinarErrores(...gruposDeErrores) {
  const combinados = {};

  for (const grupo of gruposDeErrores) {
    for (const [campo, mensaje] of Object.entries(grupo ?? {})) {
      if (combinados[campo] === undefined) combinados[campo] = mensaje;
    }
  }

  return combinados;
}
