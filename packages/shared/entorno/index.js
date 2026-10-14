// Configuracion de entorno compartida entre la web y la app movil.
//
// Punto unico donde el resto de shared consigue la URL y la llave anonima de Supabase. El
// cliente de Supabase (issue #45) consume obtenerEntorno(); nadie mas deberia leer una
// variable de entorno por su cuenta.
//
// El import de la fuente va SIN extension a proposito: es lo que permite a Metro resolver
// fuente.native.js en movil mientras Vite resuelve fuente.js en web. Es la unica excepcion
// a la convencion de extensiones explicitas del repositorio.
import { leerFuente } from "./fuente";
import { resolverEntorno } from "./reglas.js";

export {
  ARCHIVOS_DE_ENTORNO,
  CODIGOS_DE_ERROR,
  ErrorDeEntorno,
  NOMBRES_DE_VARIABLES,
  PLATAFORMAS,
  resolverEntorno,
} from "./reglas.js";

/** Resultado ya validado. Se guarda para no repetir la validacion en cada llamada. */
let entorno = null;

/**
 * Configuracion de Supabase validada para la plataforma actual.
 *
 * Lanza ErrorDeEntorno si falta una variable, si la URL no sirve o si la llave configurada
 * es una service_role. Falla al arrancar y no a media consulta: un .env incompleto tiene que
 * notarse antes de que alguien crea que la aplicacion funciona.
 *
 * @returns {{ supabaseUrl: string, supabaseAnonKey: string, plataforma: string }}
 */
export function obtenerEntorno() {
  if (entorno === null) {
    entorno = resolverEntorno(leerFuente());
  }
  return entorno;
}

/**
 * Olvida la configuracion ya validada.
 *
 * Existe para las pruebas, que necesitan evaluar varios entornos en el mismo proceso. En la
 * aplicacion no hay razon para llamarla.
 */
export function reiniciarEntorno() {
  entorno = null;
}
