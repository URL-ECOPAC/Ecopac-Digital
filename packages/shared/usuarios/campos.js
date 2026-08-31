import { labels } from "@ecopac/ui-tokens";
import { ROLES, TODOS_LOS_ROLES, ETIQUETAS_ROL } from "./roles.js";
import { TIPOS_DE_CAMPO } from "../descriptores.js";

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
    label: "Correo electronico",
    tipo: TIPOS_DE_CAMPO.EMAIL,
    placeholder: "nombre@ejemplo.org",
    validacion: { requerido: true, unico: true },
  },
  {
    id: "telefono",
    label: "Telefono",
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
    id: "activo",
    label: "Usuario activo",
    tipo: TIPOS_DE_CAMPO.BOOLEANO,
    valorPorDefecto: true,
    validacion: { requerido: false },
  },
];

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
