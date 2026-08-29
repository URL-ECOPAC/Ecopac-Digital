# Referencia de diseno - Ecopac Digital

Este documento es la fuente unica de verdad sobre como se ven las pantallas del sistema. Toda
issue de frontend (`platform:web` o `platform:mobile`) apunta aqui desde su seccion
`Referencia de diseno`.

## Fuente del diseno

| Recurso              | Donde                                                                        |
| -------------------- | ---------------------------------------------------------------------------- |
| Prototipo navegable  | https://www.figma.com/make/OMT8OXRXlNdbwwEh4yXGYd/Control-de-inventario?p=f  |
| Wireframes anotados  | `docs/entregables/Entregable Semana 6.pdf`, paginas 61 a 68                   |
| Mapas de navegacion  | `docs/entregables/Entregable Semana 6.pdf`, paginas 69 y 70                   |

El PDF es la referencia citable porque queda versionada en el repositorio. El prototipo de
Figma manda para el detalle visual que el wireframe no captura: color, tipografia, estados de
interaccion y espaciado fino. Los wireframes del PDF son en escala de grises, asi que **para
color siempre manda el prototipo**.

## Paleta

La marca es **verde**, matiz ~127 grados. Los valores se midieron sobre el prototipo en vivo y
estan implementados en `packages/ui-tokens/index.js`, que es la unica fuente de color del
proyecto.

| Token | Valor | Donde se usa en el diseno |
| ----- | ----- | ------------------------- |
| `primary` | `#2A9C36` | Marca, banner, botones principales, elemento activo del sidebar |
| `primaryDark` / `primaryLight` | `#1E7E2A` / `#36AE42` | Extremos del degradado del banner |
| `success` | `#2A9C36` | Estado Disponible y estado Aprobado |
| `warning` | `#F1A239` | Estado Por vencer y alertas que no bloquean |
| `danger` | `#B81F6F` | Estado Critico, Sin stock y Rechazado |
| `info` | `#3C9CC0` | Estado Pendiente de validacion y valores informativos |
| `background` / `surface` | `#F7F8FA` / `#FFFFFF` | Fondo de pagina y tarjetas |
| `border` | `#E9E9E9` | Bordes, separadores y pista de las barras de progreso |

Cada modulo tiene ademas un color de acento con el que el diseno lo identifica en tarjetas y
puntos de KPI: Pacientes verde, Donaciones azul, Inventario naranja, Presupuestos magenta.
Estan en `moduleAccents`.

Los hex exactos salen de muestreo de pixel sobre capturas del prototipo. Los matices son
fiables; conviene que el autor del diseno confirme los valores finales.

## Mapa de navegacion

Tras autenticarse, el usuario entra a un punto distinto segun su rol:

- **administrador, junta directiva y socio fundador** entran al Dashboard / Metricas de Impacto.
  Socio fundador entra al mismo destino que junta directiva: los dos son roles de gobernanza
  de solo lectura con permisos identicos (issue #404).
- **medico y voluntario general** entran al Tablero de Jornadas Activas.

Los cinco nombres son los valores del enum `rol_usuario` (`packages/shared/usuarios/roles.js`),
no las etiquetas que se muestran en pantalla: el rol es `voluntario general`, aunque la interfaz
lo muestre como "Voluntario" (`ETIQUETAS_ROL`).

Esconder una opcion del menu no es control de acceso: la restriccion real vive en las
politicas RLS y en el guard de rutas.

### Web: navegacion lateral, nueve modulos en cinco secciones

| Seccion | Modulos |
| ------- | ------- |
| Principal | Inicio |
| Atencion medica | Pacientes, Donaciones |
| Operaciones | Inventario, Presupuestos |
| Administracion | Proyectos, Reportes |
| Jornadas | Kanban Jornadas, Voluntarios |

La definicion vive una sola vez en `packages/shared/navegacion.js`, con la ruta, la seccion, el
modulo de permisos y los roles de cada uno. El sidebar de la web y la tab bar del movil salen de
ahi.

### Movil: tab bar de cinco

Inicio, Pacientes, Jornadas, Inventario, Ajustes. La pantalla de inicio ademas expone un grid
de modulos navegables, de modo que la app movil tiene paridad de modulos con la web salvo
Reportes, que existe solo en web.