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

La marca son **los cuatro colores del logo de Ecopac**: verde, azul, naranja y magenta. El verde
manda, y los otros tres son los acentos con los que el diseno identifica cada modulo.

Los valores estan implementados en `packages/ui-tokens/index.js`, que es la unica fuente de color
del proyecto.

| Token | Valor | Donde se usa en el diseno |
| ----- | ----- | ------------------------- |
| `primary` | `#3DB648` | Marca, banner, botones principales, elemento activo del sidebar |
| `primaryLight` / `primaryDark` | `#2D9E3A` / `#1E7A28` | Pasos del degradado del banner: `#3DB648` -> `#2D9E3A` -> `#1E7A28`. El oscuro es ademas el hover del boton primario |
| `success` | `#3DB648` | Estado Disponible y estado Aprobado |
| `warning` | `#F7941D` | Estado Por vencer y alertas que no bloquean |
| `danger` | `#E91E8C` | Estado Critico, Sin stock y Rechazado |
| `info` | `#29ABE2` | Estado Pendiente de validacion y valores informativos |
| `background` / `surface` | `#F7F8FA` / `#FFFFFF` | Fondo de pagina y tarjetas |
| `border` | `#E2E4E9` | Bordes, separadores y pista de las barras de progreso |
| `text` / `textMuted` | `#2D2D2D` / `#7A7A8A` | Texto principal y texto secundario |
| `secondary` | `#4D4D4D` | Botones secundarios e iconos de menor jerarquia |

Cada modulo tiene ademas un color de acento: Pacientes verde, Donaciones azul, Inventario naranja,
Presupuestos magenta. Estan en `moduleAccents`, y son los mismos cuatro del logo.

### De donde salen estos valores (issue #700)

**Del prototipo, leidos y no estimados.** Hasta la issue #700 este documento decia que los hex
salian de "muestreo de pixel sobre capturas" y que convenia que el autor del diseno los
confirmara. Se confirmaron abriendo el prototipo publicado y leyendo el **color calculado** de cada
elemento en sus ocho pantallas, que es exacto y repetible.

**Siete de los nueve tokens no coincidian con el prototipo**, y no por poco:

| Token | Decia | Dice el prototipo |
| ----- | ----- | ----------------- |
| `primary` | `#2A9C36` | `#3DB648` |
| `danger` | `#B81F6F` | `#E91E8C` |
| `warning` | `#F1A239` | `#F7941D` |
| `info` | `#3C9CC0` | `#29ABE2` |
| `border` | `#E9E9E9` | `#E2E4E9` |
| `text` | `#111827` | `#2D2D2D` |
| `textMuted` | `#4B5563` | `#7A7A8A` |

Solo `background` y `surface` estaban bien. Es la deriva que el muestreo a ojo produce, y por eso
ahora el metodo queda escrito: si hay que volver a medir, se leen los colores calculados del
prototipo publicado, no se estiman sobre una captura.

**Una advertencia para quien lea el codigo de las pantallas**: `apps/` todavia tiene cientos de
colores escritos a mano que no son ni esta paleta ni la anterior -son los de Tailwind, que se
colaron pantalla por pantalla-. Migrarlos es la segunda mitad de la issue #700. Hasta que eso
ocurra, **lo que se ve en pantalla no es del todo lo que dice esta tabla**.

## Tipografia

El proyecto usa **una sola familia: la letra del sistema** de cada dispositivo (Segoe UI en
Windows, San Francisco en macOS e iOS, Roboto en Android). No se descarga ninguna fuente web: la
interfaz se usa en jornada, con datos moviles escasos, y la letra del sistema es la que mejor se
lee en cada pantalla.

| Token (`typography`) | Plataforma | Uso |
| -------------------- | ---------- | --- |
| `fontFamilyBase` | Movil | `"System"`, el nombre que entiende React Native |
| `fontFamilyWeb` | Web | Pila del sistema, publicada como `--fuente-base` y colgada de `--bs-body-font-family` |
| `fontFamilyMonoWeb` | Web | Monoespaciada, publicada como `--fuente-mono` |

La monoespaciada es **solo para identificadores** que se leen caracter por caracter: numero de
lote, DPI, correlativo de una constancia, id de un movimiento. Los rotulos (micro-etiquetas en
mayuscula, cabeceras de tabla) van en la letra base.

Ninguna pantalla declara `font-family`: la hereda de Bootstrap. Donde haga falta la monoespaciada
se usa `var(--fuente-mono)` o la clase `.font-monospace`.

## Mapa de navegacion

Tras autenticarse, el usuario entra a un punto distinto segun su rol:

- **administrador, junta directiva y socio fundador** entran al Dashboard / Metricas de Impacto.
  Socio fundador entra al mismo destino que junta directiva: los dos son roles de gobernanza
  de solo lectura con permisos identicos (issue #404).
- **medico y voluntario general** entran al Tablero de Jornadas Activas.

Los cinco nombres son los valores del enum `rol_usuario` (`packages/shared/usuarios/roles.js`),
no las etiquetas que se muestran en pantalla: el rol es `voluntario general`, aunque la interfaz
lo muestre como "Colaborador" (`ETIQUETAS_ROL`).

Esconder una opcion del menu no es control de acceso: la restriccion real vive en las
politicas RLS y en el guard de rutas.

### Web: navegacion lateral, nueve modulos en cinco secciones

| Seccion | Modulos |
| ------- | ------- |
| Principal | Inicio |
| Atencion medica | Pacientes, Donaciones |
| Operaciones | Inventario, Presupuestos |
| Administracion | Proyectos, Reportes |
| Jornadas | Kanban Jornadas, Colaboradores |

La definicion vive una sola vez en `packages/shared/navegacion.js`, con la ruta, la seccion, el
modulo de permisos y los roles de cada uno. El sidebar de la web y la tab bar del movil salen de
ahi.

### Movil: tab bar de cinco

Inicio, Pacientes, Jornadas, Inventario, Ajustes. La pantalla de inicio ademas expone un grid
de modulos navegables, de modo que la app movil tiene paridad de modulos con la web salvo
Reportes, que existe solo en web.