#!/usr/bin/env node
/* global console, process */
// Guarda de CI: lo que apps/ lee tiene que existir en el contrato de packages/shared (issue #821).
//
// POR QUE EXISTE
//
// El repositorio tenia cuatro guardas y **las cuatro miran packages/shared**. Ninguna miraba
// apps/. El contraste que dio origen a esta: la ficha del paciente en movil estaba rota de punta
// a punta -tres pestanias vacias, la cabecera sin nombre- con `npm run lint` en verde, 2.145
// pruebas en verde y `verificar:shared-esquema` en verde.
//
// LA CLASE DE ERROR QUE ATRAPA
//
// El paquete no tiene una forma unica de sobre. Conviven `{ datos, error }`, `{ triajes, error }`,
// `{ recetas, error }`, `{ condiciones, error }`... Cada una esta documentada en su archivo, pero
// desde fuera **equivocarse no da rojo: da una lista vacia**. Asi fue el defecto que dejo la
// pestania de signos vitales vacia para siempre (issue #818):
//
//   const respuesta = await obtenerTriajes(pacienteId);
//   const lista = Array.isArray(respuesta) ? respuesta : respuesta?.datos || [];
//
// `obtenerTriajes()` devuelve `{ triajes, error }`. Ni un arreglo, ni `datos`. `lista` era siempre
// `[]`, sin excepcion, sin mensaje y sin log. La guarda comprueba tres cosas:
//
//   (a) EL SOBRE. Quien llama a una funcion de `*.api.js` lee claves que esa funcion devuelve.
//   (b) LA FORMA DEL ITEM. Cuando el sobre trae `X: (data ?? []).map(aAlgo)`, las claves de cada
//       elemento son las que arma ese mapeador, y la cadena se sigue por el hook que lo guarda en
//       estado hasta el componente que lo pinta. Un componente que lea `receta.fecha` cuando
//       `aReceta()` produce `createdAt` sale en rojo.
//   (c) LOS DESCRIPTORES. `COLUMNAS_LOTE` nombra los campos que la tabla va a leer de cada fila:
//       tienen que ser los que arma `aLote()`.
//
// QUE NO COMPRUEBA, A PROPOSITO
//
// Se informa el conteo de lo que queda fuera, como hacen las otras guardas; una omision declarada
// no es un silencio. Queda fuera, hoy:
//
//   - Las llamadas dentro de `Promise.all`, las de `.then(...)` y los `return await`: solo se
//     siguen las dos formas de consumo directas.
//   - Los mapeadores cuya forma es ABIERTA, es decir que devuelven `{ ...fila, algo }`. Ahi las
//     claves salen de la consulta, no del literal, y suponer lo contrario daba falsos positivos
//     -`aCondicionDelPaciente()` es el caso-.
//   - Los descriptores de un modulo que no tiene un mapeador del mismo nombre. Se cuentan.
//
// Es deliberado que la guarda comprueba menos de lo que se podria: un check requerido que se
// equivoca se termina ignorando, que es justo lo que le paso al aviso de huerfanos. Lo que amplia
// la cobertura de verdad es unificar el sobre de las funciones de API, y esa es otra issue.
//
// Uso:
//   npm run verificar:contratos
//   npm run verificar:contratos -- --autoprueba

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR_SHARED = join(RAIZ, "packages", "shared");
const DIR_APPS = join(RAIZ, "apps");
const IGNORADOS = new Set(["node_modules", "dist", "build", ".expo", "coverage", "android", "ios"]);

// Sobre una lista, esto no es un campo del elemento: es un metodo de Array.
const METODOS_DE_ARREGLO =
  /^(map|filter|find|findIndex|forEach|some|every|reduce|reduceRight|sort|slice|concat|join|flat|flatMap|includes|indexOf|lastIndexOf|at|reverse|push|pop|shift|unshift|splice|keys|values|entries|length)$/;

/** Ruta relativa con "/" siempre, para que `::error file=` enlace tambien en Windows. */
function rutaRelativa(ruta) {
  return relative(RAIZ, ruta).split(sep).join("/");
}

function lineaDe(texto, indice) {
  return texto.slice(0, indice).split("\n").length;
}

function archivosDe(dir, filtro, acumulado = []) {
  for (const entrada of readdirSync(dir)) {
    if (IGNORADOS.has(entrada)) continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) archivosDe(ruta, filtro, acumulado);
    else if (filtro(ruta)) acumulado.push(ruta);
  }
  return acumulado;
}

function leer(rutas) {
  return rutas.map((ruta) => ({ ruta, texto: readFileSync(ruta, "utf8") }));
}

/** Indice del parentesis, llave o corchete que cierra al que abre en `desde`. */
export function cierreDe(texto, desde) {
  const abre = texto[desde];
  const cierra = abre === "{" ? "}" : abre === "(" ? ")" : "]";
  let profundidad = 0;
  for (let i = desde; i < texto.length; i += 1) {
    if (texto[i] === abre) profundidad += 1;
    else if (texto[i] === cierra) {
      profundidad -= 1;
      if (profundidad === 0) return i;
    }
  }
  return -1;
}

/**
 * Claves de nivel cero de un cuerpo de objeto o de una desestructuracion.
 *
 * `abierta` avisa de un `...resto`: entonces las claves del literal son un subconjunto, no la
 * forma entera, y no se puede concluir nada de lo que falta.
 */
export function clavesDeNivelCero(texto) {
  const partes = [];
  let profundidad = 0;
  let actual = "";
  for (const ch of texto) {
    if ("{[(".includes(ch)) profundidad += 1;
    else if ("}])".includes(ch)) profundidad -= 1;
    if (ch === "," && profundidad === 0) {
      partes.push(actual);
      actual = "";
      continue;
    }
    actual += ch;
  }
  partes.push(actual);

  const claves = [];
  let abierta = false;
  for (const parte of partes) {
    const limpia = parte.trim();
    if (!limpia) continue;
    if (limpia.startsWith("...")) {
      abierta = true;
      continue;
    }
    const nombre = limpia.match(/^(\w+)/)?.[1];
    if (nombre) claves.push(nombre);
  }
  return { claves, abierta };
}

/** El cuerpo `{...}` de la funcion cuyo parentesis de parametros abre en `indice`. */
function cuerpoDeFuncion(texto, indice) {
  const cierraParen = cierreDe(texto, indice);
  if (cierraParen === -1) return null;
  const abreCuerpo = texto.indexOf("{", cierraParen);
  if (abreCuerpo === -1) return null;
  const fin = cierreDe(texto, abreCuerpo);
  return fin === -1 ? null : texto.slice(abreCuerpo, fin);
}

/** El ultimo `return { ... }` de un cuerpo, que en un hook es el que expone lo que devuelve. */
function ultimoObjetoDevuelto(cuerpo) {
  const retornos = [...cuerpo.matchAll(/return\s*\{/g)];
  if (!retornos.length) return null;
  const abre = cuerpo.indexOf("{", retornos[retornos.length - 1].index);
  const cierra = cierreDe(cuerpo, abre);
  return cierra === -1 ? null : cuerpo.slice(abre + 1, cierra);
}

/** Desde una declaracion, hasta donde termina el bloque que la contiene. */
function bloqueDesde(texto, indice) {
  let profundidad = 0;
  for (let i = indice; i < texto.length; i += 1) {
    if (texto[i] === "{") profundidad += 1;
    else if (texto[i] === "}") {
      if (profundidad === 0) return texto.slice(indice, i);
      profundidad -= 1;
    }
  }
  return texto.slice(indice);
}

/**
 * El contrato de cada `*.api.js`: que claves devuelve cada funcion exportada y que forma tiene
 * cada elemento de las que son listas.
 *
 * `formas` va indexada por `"funcion::clave"` -por ejemplo `"obtenerRecetas::recetas"`- porque la
 * misma funcion puede devolver dos listas de forma distinta en el mismo sobre.
 */
export function inventarioDeApi(archivos) {
  const funciones = new Map();
  const formas = new Map();
  let abiertas = 0;

  for (const { texto } of archivos) {
    const mapeadores = new Map();
    for (const m of texto.matchAll(/function\s+(a[A-Z]\w*)\s*\(/g)) {
      const cuerpo = cuerpoDeFuncion(texto, m.index + m[0].length - 1);
      if (!cuerpo) continue;
      const devuelto = ultimoObjetoDevuelto(cuerpo);
      if (devuelto === null) continue;
      const { claves, abierta } = clavesDeNivelCero(devuelto);
      if (abierta) {
        // `{ ...padecimiento, condicion }`: las claves las pone la consulta, no este literal.
        abiertas += 1;
        continue;
      }
      mapeadores.set(m[1], new Set(claves));
    }

    for (const m of texto.matchAll(/export\s+(?:async\s+)?function\s+(\w+)\s*\(/g)) {
      const cuerpo = cuerpoDeFuncion(texto, m.index + m[0].length - 1);
      if (!cuerpo) continue;
      const nombre = m[1];
      const delSobre = new Set();
      let devuelveObjeto = false;

      for (const r of cuerpo.matchAll(/return\s*\{/g)) {
        const abre = cuerpo.indexOf("{", r.index);
        const cierra = cierreDe(cuerpo, abre);
        if (cierra === -1) continue;
        devuelveObjeto = true;
        const dentro = cuerpo.slice(abre + 1, cierra);
        for (const clave of clavesDeNivelCero(dentro).claves) delSobre.add(clave);
        // `recetas: (data ?? []).map(aReceta)` -> los elementos tienen la forma de aReceta.
        for (const a of dentro.matchAll(/(\w+)\s*:[^,]*?\.map\(\s*(a[A-Z]\w*)\s*\)/g)) {
          const forma = mapeadores.get(a[2]);
          if (forma) formas.set(`${nombre}::${a[1]}`, { campos: forma, origen: `${a[2]}()` });
        }
      }

      // `const condiciones = (data ?? []).map((item) => ({ ... }))` y despues `return { condiciones }`.
      for (const a of cuerpo.matchAll(
        /const\s+(\w+)\s*=\s*\([^()]*\)\s*\.map\(\s*\(?\s*\w+\s*\)?\s*=>\s*\(\s*\{/g,
      )) {
        if (!new RegExp(`return\\s*\\{[^{}]*\\b${a[1]}\\b`).test(cuerpo)) continue;
        const abre = cuerpo.lastIndexOf("{", a.index + a[0].length);
        const cierra = cierreDe(cuerpo, abre);
        if (cierra === -1) continue;
        const { claves, abierta } = clavesDeNivelCero(cuerpo.slice(abre + 1, cierra));
        if (abierta) abiertas += 1;
        else
          formas.set(`${nombre}::${a[1]}`, {
            campos: new Set(claves),
            origen: "el map() de la consulta",
          });
      }

      if (devuelveObjeto) funciones.set(nombre, new Set(delSobre));
    }
  }

  return { funciones, formas, abiertas };
}

/**
 * La forma que un hook expone, siguiendo el estado.
 *
 * Es la unica manera de llegar a `apps/`: un componente nunca llama a la API, llama al hook. La
 * cadena es siempre la misma y es mecanica -`useState`, `setX(respuesta.clave)`, `return { X }`-,
 * asi que se sigue entera:
 *
 *   const [recetas, setRecetas] = useState([]);
 *   const respuesta = await obtenerRecetas(pacienteId);   // recetas: (data ?? []).map(aReceta)
 *   setRecetas(respuesta.recetas ?? []);
 *   return { recetas, ... };                              // -> useRecetasPaciente().recetas
 */
export function formasDeHooks(archivos, formasApi) {
  const formas = new Map();

  for (const { texto } of archivos) {
    for (const m of texto.matchAll(/export function (use[A-Z]\w*)\s*\(/g)) {
      const cuerpo = cuerpoDeFuncion(texto, m.index + m[0].length - 1);
      if (!cuerpo) continue;

      const variableDelSetter = new Map();
      for (const s of cuerpo.matchAll(/const\s*\[\s*(\w+)\s*,\s*(set\w+)\s*\]\s*=\s*useState/g))
        variableDelSetter.set(s[2], s[1]);

      const formaDeVariable = new Map();

      // const respuesta = await obtenerRecetas(id);  ->  setRecetas(respuesta.recetas ?? [])
      for (const a of cuerpo.matchAll(/const\s+(\w+)\s*=\s*await\s+(\w+)\s*\(/g)) {
        const bloque = bloqueDesde(cuerpo, a.index);
        for (const s of bloque.matchAll(/(set\w+)\s*\(\s*(\w+)\??\.(\w+)/g)) {
          if (s[2] !== a[1] || !variableDelSetter.has(s[1])) continue;
          const forma = formasApi.get(`${a[2]}::${s[3]}`);
          if (forma) formaDeVariable.set(variableDelSetter.get(s[1]), forma);
        }
      }

      // const { recetas } = await obtenerRecetas(id);  ->  setRecetas(recetas)
      for (const a of cuerpo.matchAll(/const\s*\{([^}]*)\}\s*=\s*await\s+(\w+)\s*\(/g)) {
        const bloque = bloqueDesde(cuerpo, a.index);
        for (const clave of clavesDeNivelCero(a[1]).claves) {
          const forma = formasApi.get(`${a[2]}::${clave}`);
          if (!forma) continue;
          for (const s of bloque.matchAll(new RegExp(`(set\\w+)\\s*\\(\\s*${clave}\\b`, "g")))
            if (variableDelSetter.has(s[1]))
              formaDeVariable.set(variableDelSetter.get(s[1]), forma);
        }
      }

      if (!formaDeVariable.size) continue;
      const devuelto = ultimoObjetoDevuelto(cuerpo);
      if (devuelto === null) continue;
      for (const clave of clavesDeNivelCero(devuelto).claves)
        if (formaDeVariable.has(clave)) formas.set(`${m[1]}::${clave}`, formaDeVariable.get(clave));
    }
  }

  return formas;
}

/**
 * Los campos que un bloque le lee a cada elemento de la lista `nombre`, con donde los lee.
 *
 * La posicion importa: la anotacion de GitHub tiene que caer en la linea que lee el campo que no
 * existe, no en la linea donde se desestructuro la lista, que puede estar cien lineas mas arriba.
 */
function camposDeLosElementos(bloque, nombre) {
  const campos = new Map();
  const recolectar = (variable, desde, base) => {
    for (const a of desde.matchAll(new RegExp(`\\b${variable}\\??\\.(\\w+)`, "g")))
      if (!campos.has(a[1])) campos.set(a[1], base + a.index);
  };

  // lista.map((receta) => ... receta.campo ...)
  const iteradores = new RegExp(
    `\\b${nombre}\\s*\\.\\s*(?:map|filter|find|findIndex|forEach|some|every|flatMap|sort|reduce)\\s*\\(\\s*\\(?\\s*(\\w+)`,
    "g",
  );
  for (const m of bloque.matchAll(iteradores)) {
    const abre = bloque.indexOf("(", m.index + nombre.length);
    const cierra = cierreDe(bloque, abre);
    recolectar(m[1], bloque.slice(abre, cierra === -1 ? bloque.length : cierra), abre);
  }
  // lista[0].campo
  for (const m of bloque.matchAll(
    new RegExp(`\\b${nombre}\\??\\s*\\[\\s*\\d+\\s*\\]\\??\\.(\\w+)`, "g"),
  ))
    if (!campos.has(m[1])) campos.set(m[1], m.index);
  // for (const receta of lista)
  for (const m of bloque.matchAll(
    new RegExp(`for\\s*\\(\\s*const\\s+(\\w+)\\s+of\\s+${nombre}\\b`, "g"),
  ))
    recolectar(m[1], bloqueDesde(bloque, m.index), m.index);

  return [...campos].filter(([campo]) => !METODOS_DE_ARREGLO.test(campo));
}

/**
 * Las dos comprobaciones sobre un archivo que consume: el sobre y la forma de cada elemento.
 */
export function revisarConsumo(texto, { funciones, formas, formasHook = new Map() }) {
  const hallazgos = [];
  let sitios = 0;

  const anota = (indice, detalle) => hallazgos.push({ linea: lineaDe(texto, indice), detalle });
  const enumerar = (claves) => [...claves].map((c) => `"${c}"`).join(", ");

  // (a) El sobre, forma 1: const { triajes, error } = await obtenerTriajes(id)
  for (const m of texto.matchAll(/const\s*\{([^}]*)\}\s*=\s*await\s+(\w+)\s*\(/g)) {
    const sobre = funciones.get(m[2]);
    if (!sobre) continue;
    sitios += 1;
    for (const clave of clavesDeNivelCero(m[1]).claves)
      if (!sobre.has(clave))
        anota(m.index, `${m[2]}() no devuelve "${clave}"; devuelve ${enumerar(sobre)}`);
  }

  // (a) El sobre, forma 2: const respuesta = await obtenerTriajes(id), y despues respuesta.datos.
  //
  // El alcance es el BLOQUE que contiene la declaracion, no una ventana de tamanio fijo: un hook
  // declara `respuesta` en cada una de sus funciones y ademas la reusa como parametro de un
  // `.then()`, asi que cualquier otro criterio se lleva accesos de la funcion de al lado.
  for (const m of texto.matchAll(/const\s+(\w+)\s*=\s*await\s+(\w+)\s*\(/g)) {
    const sobre = funciones.get(m[2]);
    if (!sobre) continue;
    sitios += 1;
    const bloque = bloqueDesde(texto, m.index);
    const accesos = new Set(
      [...bloque.matchAll(new RegExp(`\\b${m[1]}\\??\\.(\\w+)`, "g"))].map((a) => a[1]),
    );
    for (const clave of accesos)
      if (!sobre.has(clave))
        anota(m.index, `${m[2]}() no devuelve "${clave}"; devuelve ${enumerar(sobre)}`);
  }

  // (b) La forma del elemento, desde la API o desde el hook que la guarda en estado.
  const consumos = [
    [/const\s*\{([^}]*)\}\s*=\s*await\s+(\w+)\s*\(/g, formas],
    [/const\s*\{([^}]*)\}\s*=\s*(use[A-Z]\w*)\s*\(/g, formasHook],
  ];
  for (const [patron, catalogo] of consumos) {
    for (const m of texto.matchAll(patron)) {
      const bloque = bloqueDesde(texto, m.index);
      for (const clave of clavesDeNivelCero(m[1]).claves) {
        const forma = catalogo.get(`${m[2]}::${clave}`);
        if (!forma) continue;
        for (const [campo, donde] of camposDeLosElementos(bloque, clave))
          if (!forma.campos.has(campo))
            anota(
              m.index + donde,
              `cada elemento de ${m[2]}().${clave} lo arma ${forma.origen} y no trae "${campo}"; ` +
                `trae ${enumerar(forma.campos)}`,
            );
      }
    }
  }

  return { hallazgos, sitios };
}

/**
 * (c) Los descriptores contra el mapeador de su modulo.
 *
 * `COLUMNAS_LOTE` y `CAMPOS_FICHA_LOTE` nombran los campos que la tabla o la ficha va a leer de
 * cada fila -`desde` manda sobre `id` cuando esta-, y quien arma esa fila es `aLote()`, en el
 * mismo modulo. Cuando el modulo no tiene un mapeador de ese nombre no se supone nada: se cuenta.
 */
export function revisarDescriptores(descriptores, mapeadoresPorModulo) {
  const hallazgos = [];
  let comprobados = 0;
  let sinMapeador = 0;

  for (const { modulo, ruta, nombre, constante, campos, linea } of descriptores) {
    const singular = constante
      .replace(/^(COLUMNAS|CAMPOS_FICHA)_/, "")
      .toLowerCase()
      .replace(/_(\w)/g, (_, c) => c.toUpperCase())
      .replace(/^(\w)/, (c) => c.toUpperCase());
    const forma = mapeadoresPorModulo.get(`${modulo}::a${singular}`);
    if (!forma) {
      sinMapeador += 1;
      continue;
    }
    comprobados += 1;
    for (const campo of campos)
      if (!forma.has(campo))
        hallazgos.push({
          ruta,
          linea,
          detalle: `${constante} nombra "${campo}", que a${singular}() no arma; arma ${[...forma]
            .map((c) => `"${c}"`)
            .join(", ")}`,
          nombre,
        });
  }

  return { hallazgos, comprobados, sinMapeador };
}

/** Los `COLUMNAS_X` / `CAMPOS_FICHA_X` de un archivo, con el campo que cada entrada lee. */
export function descriptoresDe(texto) {
  const salida = [];
  for (const m of texto.matchAll(/export const (COLUMNAS_\w+|CAMPOS_FICHA_\w+)\s*=\s*\[/g)) {
    const abre = texto.indexOf("[", m.index);
    const cierra = cierreDe(texto, abre);
    if (cierra === -1) continue;
    const cuerpo = texto.slice(abre, cierra);
    const desde = new Map(
      [...cuerpo.matchAll(/\{[^{}]*id:\s*"(\w+)"[^{}]*desde:\s*"(\w+)"/g)].map((x) => [x[1], x[2]]),
    );
    const campos = [...cuerpo.matchAll(/\bid:\s*"(\w+)"/g)].map((x) => desde.get(x[1]) ?? x[1]);
    salida.push({ constante: m[1], campos, linea: lineaDe(texto, m.index) });
  }
  return salida;
}

function omisiones(archivos) {
  const cuenta = { promiseAll: 0, then: 0, returnAwait: 0 };
  for (const { texto } of archivos) {
    cuenta.promiseAll += [...texto.matchAll(/await Promise\.all\(/g)].length;
    cuenta.then += [...texto.matchAll(/\)\.then\(/g)].length;
    cuenta.returnAwait += [...texto.matchAll(/return await \w/g)].length;
  }
  return cuenta;
}

const CASOS = [
  {
    nombre: "leer una clave que la funcion no devuelve se detecta (asi entro la #818)",
    api: `export async function obtenerTriajes(id) { return { triajes: [], error: null }; }`,
    consumidor: `async function cargar() { const respuesta = await obtenerTriajes(id); usar(respuesta.datos ?? []); }`,
    esperado: 1,
  },
  {
    nombre: "leer la clave correcta no se marca",
    api: `export async function obtenerTriajes(id) { return { triajes: [], error: null }; }`,
    consumidor: `async function cargar() { const respuesta = await obtenerTriajes(id); usar(respuesta.triajes ?? []); }`,
    esperado: 0,
  },
  {
    nombre: "desestructurar una clave inexistente tambien",
    api: `export async function listarLotes() { return { lotes: [], error: null }; }`,
    consumidor: `async function cargar() { const { datos, error } = await listarLotes(); usar(datos, error); }`,
    esperado: 1,
  },
  {
    nombre: "dos funciones del mismo archivo no se mezclan aunque reusen el nombre",
    api: `export async function unaCosa() { return { cosa: null, error: null }; }
          export async function otraCosa() { return { otra: null, error: null }; }`,
    consumidor: `function a() { const respuesta = await unaCosa(); usar(respuesta.cosa); }
                 function b() { const respuesta = await otraCosa(); usar(respuesta.otra); }`,
    esperado: 0,
  },
  {
    nombre: "un campo que el mapeador no arma se detecta",
    api: `function aReceta(fila) { return { id: fila.id, createdAt: fila.creado_en }; }
          export async function obtenerRecetas(id) { return { recetas: (data ?? []).map(aReceta), error: null }; }`,
    consumidor: `async function cargar() { const { recetas } = await obtenerRecetas(id); recetas.map((receta) => pintar(receta.fecha)); }`,
    esperado: 1,
  },
  {
    nombre: "y el campo que si arma, no",
    api: `function aReceta(fila) { return { id: fila.id, createdAt: fila.creado_en }; }
          export async function obtenerRecetas(id) { return { recetas: (data ?? []).map(aReceta), error: null }; }`,
    consumidor: `async function cargar() { const { recetas } = await obtenerRecetas(id); recetas.map((receta) => pintar(receta.createdAt)); }`,
    esperado: 0,
  },
  {
    nombre: "los metodos de arreglo no cuentan como campo del elemento",
    api: `function aLote(f) { return { id: f.id, numero: f.numero }; }
          export async function listarLotes() { return { lotes: (data ?? []).map(aLote), error: null }; }`,
    consumidor: `async function cargar() { const { lotes } = await listarLotes(); lotes.filter((lote) => lote.numero).length; }`,
    esperado: 0,
  },
  {
    nombre: "una forma abierta -{ ...fila }- no concluye nada: no hay falso positivo",
    api: `function aCondicion(fila) { const { condicion, ...resto } = fila; return { ...resto, condicion }; }
          export async function obtenerCondiciones(id) { return { condiciones: (data ?? []).map(aCondicion), error: null }; }`,
    consumidor: `async function cargar() { const { condiciones } = await obtenerCondiciones(id); condiciones.map((c) => pintar(c.notas)); }`,
    esperado: 0,
  },
  {
    nombre: "la cadena llega hasta el componente pasando por el hook",
    api: `function aReceta(fila) { return { id: fila.id, createdAt: fila.creado_en }; }
          export async function obtenerRecetas(id) { return { recetas: (data ?? []).map(aReceta), error: null }; }`,
    hook: `export function useRecetasPaciente(id) {
             const [recetas, setRecetas] = useState([]);
             const cargar = useCallback(async () => {
               const respuesta = await obtenerRecetas(id);
               setRecetas(respuesta.recetas ?? []);
             }, [id]);
             return { recetas, recargar: cargar };
           }`,
    consumidor: `function Pantalla() { const { recetas } = useRecetasPaciente(id); return recetas.map((receta) => fila(receta.fecha)); }`,
    esperado: 1,
  },
  {
    nombre: "y por el hook con el campo correcto tampoco se marca",
    api: `function aReceta(fila) { return { id: fila.id, createdAt: fila.creado_en }; }
          export async function obtenerRecetas(id) { return { recetas: (data ?? []).map(aReceta), error: null }; }`,
    hook: `export function useRecetasPaciente(id) {
             const [recetas, setRecetas] = useState([]);
             const cargar = useCallback(async () => {
               const respuesta = await obtenerRecetas(id);
               setRecetas(respuesta.recetas ?? []);
             }, [id]);
             return { recetas, recargar: cargar };
           }`,
    consumidor: `function Pantalla() { const { recetas } = useRecetasPaciente(id); return recetas.map((receta) => fila(receta.createdAt)); }`,
    esperado: 0,
  },
];

const CASOS_DESCRIPTOR = [
  {
    nombre: "un descriptor que nombra un campo inexistente se detecta",
    api: `function aLote(f) { return { id: f.id, numeroLote: f.numero_lote }; }`,
    descriptor: `export const COLUMNAS_LOTE = [{ id: "numeroLote", label: "Lote" }, { id: "vence", label: "Vence" }];`,
    esperado: 1,
  },
  {
    nombre: "`desde` manda sobre `id`, que es el nombre de la columna en pantalla",
    api: `function aLote(f) { return { id: f.id, fechaVencimiento: f.vence }; }`,
    descriptor: `export const COLUMNAS_LOTE = [{ id: "vence", label: "Vence", desde: "fechaVencimiento" }];`,
    esperado: 0,
  },
  {
    nombre: "sin un mapeador del mismo nombre no se supone nada",
    api: `function aOtraCosa(f) { return { id: f.id }; }`,
    descriptor: `export const COLUMNAS_LOTE = [{ id: "loQueSea", label: "x" }];`,
    esperado: 0,
  },
];

function autoprueba() {
  let fallos = 0;

  for (const caso of CASOS) {
    const inventario = inventarioDeApi([{ ruta: "x.api.js", texto: caso.api }]);
    const formasHook = caso.hook
      ? formasDeHooks([{ ruta: "useX.js", texto: caso.hook }], inventario.formas)
      : new Map();
    const { hallazgos } = revisarConsumo(caso.consumidor, { ...inventario, formasHook });
    const ok = hallazgos.length === caso.esperado;
    console.log(`  ${ok ? "ok   " : "FALLA"}  ${caso.nombre}`);
    if (!ok) {
      fallos += 1;
      console.log(`         esperado ${caso.esperado} hallazgos, obtenido ${hallazgos.length}`);
      for (const h of hallazgos) console.log(`         - ${h.detalle}`);
    }
  }

  for (const caso of CASOS_DESCRIPTOR) {
    const mapeadores = mapeadoresPorModuloDe([{ ruta: "m/x.api.js", texto: caso.api }], () => "m");
    const descriptores = descriptoresDe(caso.descriptor).map((d) => ({
      ...d,
      modulo: "m",
      ruta: "m/columnas.js",
      nombre: "columnas.js",
    }));
    const { hallazgos } = revisarDescriptores(descriptores, mapeadores);
    const ok = hallazgos.length === caso.esperado;
    console.log(`  ${ok ? "ok   " : "FALLA"}  ${caso.nombre}`);
    if (!ok) {
      fallos += 1;
      console.log(`         esperado ${caso.esperado} hallazgos, obtenido ${hallazgos.length}`);
      for (const h of hallazgos) console.log(`         - ${h.detalle}`);
    }
  }

  const total = CASOS.length + CASOS_DESCRIPTOR.length;
  console.log(`\n${total - fallos}/${total} casos en verde.`);
  return fallos === 0;
}

/** Los mapeadores de cada modulo, indexados como `"modulo::aLote"`. */
export function mapeadoresPorModuloDe(archivos, moduloDe) {
  const salida = new Map();
  for (const { ruta, texto } of archivos) {
    for (const m of texto.matchAll(/function\s+(a[A-Z]\w*)\s*\(/g)) {
      const cuerpo = cuerpoDeFuncion(texto, m.index + m[0].length - 1);
      if (!cuerpo) continue;
      const devuelto = ultimoObjetoDevuelto(cuerpo);
      if (devuelto === null) continue;
      const { claves, abierta } = clavesDeNivelCero(devuelto);
      if (abierta) continue;
      salida.set(`${moduloDe(ruta)}::${m[1]}`, new Set(claves));
    }
  }
  return salida;
}

function moduloDeRuta(ruta) {
  return basename(dirname(ruta));
}

function principal() {
  if (process.argv.includes("--autoprueba")) return autoprueba() ? 0 : 1;

  const esFuente = (p) => /\.jsx?$/.test(p) && !p.includes(".test.");
  const apis = leer(archivosDe(DIR_SHARED, (p) => /\.api\.js$/.test(p) && !p.includes(".test.")));
  const hooks = leer(
    archivosDe(DIR_SHARED, (p) => /use[A-Z]\w*\.js$/.test(p) && !p.includes(".test.")),
  );
  const consumidores = leer([
    ...archivosDe(DIR_APPS, esFuente),
    ...archivosDe(DIR_SHARED, (p) => esFuente(p) && !/\.api\.js$/.test(p)),
  ]);

  const inventario = inventarioDeApi(apis);
  const formasHook = formasDeHooks(hooks, inventario.formas);
  const mapeadores = mapeadoresPorModuloDe(apis, moduloDeRuta);

  const descriptores = [];
  for (const { ruta, texto } of consumidores) {
    if (!/(columnas|campos)[^/\\]*\.js$/.test(ruta)) continue;
    for (const d of descriptoresDe(texto))
      descriptores.push({ ...d, modulo: moduloDeRuta(ruta), ruta: rutaRelativa(ruta) });
  }

  const hallazgos = [];
  let sitios = 0;
  for (const { ruta, texto } of consumidores) {
    const revision = revisarConsumo(texto, { ...inventario, formasHook });
    sitios += revision.sitios;
    for (const h of revision.hallazgos) hallazgos.push({ ruta: rutaRelativa(ruta), ...h });
  }
  const porDescriptor = revisarDescriptores(descriptores, mapeadores);
  hallazgos.push(...porDescriptor.hallazgos);

  console.log(
    `Contrato: ${inventario.funciones.size} funciones de API con sobre declarado, ` +
      `${inventario.formas.size} listas con forma de elemento conocida y ` +
      `${formasHook.size} expuestas por un hook, desde ${apis.length} archivos *.api.js.`,
  );
  console.log(
    `Revisado: ${consumidores.length} archivos de apps/ y packages/shared, ${sitios} consumos y ` +
      `${porDescriptor.comprobados} de ${descriptores.length} descriptores.`,
  );

  const fuera = omisiones(consumidores);
  console.log(
    `Omitido: ${fuera.promiseAll} llamadas dentro de Promise.all, ${fuera.then} con .then() y ` +
      `${fuera.returnAwait} return await -solo se siguen las dos formas directas-; ` +
      `${inventario.abiertas} mapeadores de forma abierta y ` +
      `${porDescriptor.sinMapeador} descriptores sin un mapeador del mismo nombre.`,
  );

  if (!hallazgos.length) {
    console.log("\nTodo lo que apps/ y shared consumen existe en el contrato de la API.");
    return 0;
  }

  console.log(`\n${hallazgos.length} consumos que no coinciden con el contrato:\n`);
  for (const h of hallazgos) {
    console.log(`  ${h.ruta}:${h.linea}  ${h.detalle}`);
    if (process.env.GITHUB_ACTIONS)
      console.log(`::error file=${h.ruta},line=${h.linea}::${h.detalle}`);
  }
  console.log(
    "\n  Equivocarse de clave no da error en ejecucion: da una lista vacia y cero avisos, que es",
  );
  console.log("  como la ficha del paciente en movil estuvo rota entera con el CI en verde.");
  return 1;
}

process.exit(principal());
