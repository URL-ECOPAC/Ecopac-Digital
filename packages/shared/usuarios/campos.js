import { labels } from "@ecopac/ui-tokens";
import { ROLES, TODOS_LOS_ROLES, ETIQUETAS_ROL } from "./roles.js";
import { TIPOS_DE_CAMPO } from "../descriptores.js";
import { camposDeEdicion } from "../formularios.js";

export const ESTADOS_USUARIO = [
  { value: true, clave: "activo", label: labels.usuarioActivo },
  { value: false, clave: "inactivo", label: labels.usuarioInactivo },
];

export const OPCIONES_ROL = TODOS_LOS_ROLES.map((rol) => ({
  value: rol,
  label: ETIQUETAS_ROL[rol],
}));

export const CAMPOS_USUARIO = [
  {
    id: "nombres",
    label: "Nombres",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: true, maxLongitud: 100 },
  },
  {
    id: "apellidos",
    label: "Apellidos",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: true, maxLongitud: 100 },
  },
  {
    id: "email",
    label: "Correo electrónico",
    tipo: TIPOS_DE_CAMPO.EMAIL,
    placeholder: "nombre@ejemplo.org",
    validacion: { requerido: true, unico: true },
  },
  {
    id: "telefono",
    label: "Teléfono",
    tipo: TIPOS_DE_CAMPO.TELEFONO,
    validacion: { requerido: false, maxLongitud: 20 },
  },
  {
    id: "rol",
    label: "Rol",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opciones: OPCIONES_ROL,
    valorPorDefecto: ROLES.VOLUNTARIO,
    permiso: "usuarios.gestionar_permisos",
    validacion: { requerido: true },
  },
  {
    id: "especialidades",
    label: "Especialidades",
    tipo: TIPOS_DE_CAMPO.ETIQUETAS,
    desde: "perfil_especialidad",
    validacion: { requerido: false, maxLongitudPorEtiqueta: 100 },
  },
  {
    id: "fechaIngreso",
    label: "Fecha de ingreso",
    tipo: TIPOS_DE_CAMPO.FECHA,
    validacion: { requerido: false },
  },
  {
    id: "direccion",
    label: "Dirección",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    validacion: { requerido: false },
  },
  {
    id: "notas",
    label: "Notas",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    validacion: { requerido: false },
  },
  {
    id: "activo",
    label: "Usuario activo",
    tipo: TIPOS_DE_CAMPO.BOOLEANO,
    valorPorDefecto: true,
    validacion: { requerido: false },
  },
];

/**
 * El formulario de un colaborador: el mismo para darlo de alta y para editarlo (issue #840, B1).
 *
 * Hasta la #840 eran dos subconjuntos distintos de CAMPOS_USUARIO -el alta pedia cinco campos y
 * la edicion otros siete-, asi que fecha de ingreso, direccion y notas solo se podian escribir
 * despues de invitar, y el correo desaparecia al editar. Ahora es un solo juego, en este orden.
 * `especialidades` y `activo` no estan: viven en su propio bloque y en su propia accion
 * (ModalEdicionUsuario.jsx, ModalConfirmarDesactivacion.jsx), porque se escriben de otra forma.
 */
const IDS_FORMULARIO_USUARIO = [
  "nombres",
  "apellidos",
  "email",
  "telefono",
  "rol",
  "fechaIngreso",
  "direccion",
  "notas",
];

export const CAMPOS_ALTA_USUARIO = IDS_FORMULARIO_USUARIO.map((id) =>
  CAMPOS_USUARIO.find((campo) => campo.id === id),
);

/**
 * La edicion: el mismo juego, con el correo de solo lectura. El correo es la cuenta de Supabase
 * Auth, no una columna que actualizarUsuario() pueda cambiar.
 */
export const CAMPOS_EDICION_USUARIO = camposDeEdicion(
  CAMPOS_ALTA_USUARIO,
  IDS_FORMULARIO_USUARIO.filter((id) => id !== "email"),
);

/**
 * Lo que la invitacion no lleva: invitar-usuario (Edge Function) solo recibe nombres, apellidos,
 * correo, telefono y rol, asi que el resto del alta se escribe despues, sobre el perfil ya creado.
 */
export const IDS_COMPLEMENTO_DE_ALTA = Object.freeze(["fechaIngreso", "direccion", "notas"]);

export const CAMPOS_ESPECIALIDAD = [
  {
    id: "nombreEspecialidad",
    label: "Especialidad",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: true, maxLongitud: 100 },
  },
];

export const VALORES_USUARIO_VACIOS = {
  nombres: "",
  apellidos: "",
  email: "",
  telefono: "",
  rol: ROLES.VOLUNTARIO,
  especialidades: [],
  fechaIngreso: null,
  activo: true,
};
