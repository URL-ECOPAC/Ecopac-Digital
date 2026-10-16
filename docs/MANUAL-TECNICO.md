# Manual técnico de Ecopac Digital

Este es el documento de entrada para quien tenga que **retomar, operar o ampliar** el sistema sin
haber estado en su construcción. Dice con qué está hecho, qué hay que instalar y configurar, qué
claves hacen falta y dónde se consiguen, cómo está organizado el código y la base de datos, y qué
convenciones se siguieron. Cada tema remite al documento que lo desarrolla; los documentos marcados
como **generados** salen del código y de la base, y se vuelven a generar con un comando.

## Contenido

1. [Qué es el sistema](#1-qué-es-el-sistema)
2. [Herramientas y tecnologías](#2-herramientas-y-tecnologías)
3. [Qué se necesita para trabajar](#3-qué-se-necesita-para-trabajar)
4. [Puesta en marcha en local, paso a paso](#4-puesta-en-marcha-en-local-paso-a-paso)
5. [Configuración y claves de acceso](#5-configuración-y-claves-de-acceso)
6. [Arquitectura](#6-arquitectura)
7. [Código compartido entre web y móvil](#7-código-compartido-entre-web-y-móvil)
8. [Buenas prácticas de interfaz](#8-buenas-prácticas-de-interfaz)
9. [Base de datos](#9-base-de-datos)
10. [Pantallas](#10-pantallas)
11. [Calidad: pruebas y guardas](#11-calidad-pruebas-y-guardas)
12. [Ambientes y despliegue](#12-ambientes-y-despliegue)
13. [Cómo hacer un cambio típico](#13-cómo-hacer-un-cambio-típico)
14. [Mapa de la documentación](#14-mapa-de-la-documentación)

---

## 1. Qué es el sistema

Ecopac Guatemala es una ONG que hace jornadas médicas y dentales gratuitas en comunidades rurales.
Ecopac Digital reemplaza el papel y los grupos de WhatsApp con los que se organizaba:

- **Web** (`apps/web`): el panel de administración. Pacientes, jornadas, inventario, presupuestos,
  proyectos sociales, donaciones, reportes, colaboradores, permisos y bitácora.
- **Móvil** (`apps/mobile`): la operación en campo, el día de la jornada. Buscar y registrar
  pacientes, signos vitales, consulta, receta, entrega de medicamentos e inventario de la bodega
  que viaja. Solo entran el personal de campo y la administración.
- **Supabase**: la base de datos PostgreSQL, la autenticación, las Edge Functions (correo y
  alertas) y el control de acceso fila por fila (Row Level Security).

```mermaid
flowchart LR
  subgraph Personas
    A[Administración]
    C[Junta directiva y socio fundador]
    M[Personal de campo: médico, voluntario]
  end
  A -->|navegador| W[Web - React + Vite en Vercel]
  C -->|navegador| W
  M -->|teléfono| MO[App móvil - React Native + Expo]
  A -->|teléfono| MO
  W --> S[(Supabase: PostgreSQL + Auth + Edge Functions)]
  MO --> S
  S -->|SMTP| E[Correo de invitaciones y notificaciones]
  GH[GitHub Actions] -->|migraciones, alertas diarias| S
  S -.errores.-> SE[Sentry]
  W -.errores.-> SE
  MO -.errores.-> SE
```

La visión completa, con las decisiones de arquitectura y sus razones, está en
[ARQUITECTURA.md](ARQUITECTURA.md).

## 2. Herramientas y tecnologías

| Capa | Herramienta | Versión | Para qué |
| --- | --- | --- | --- |
| Entorno | Node.js | 22.x (`engines` de `package.json`) | Correr todo: apps, pruebas, scripts |
| Entorno | npm workspaces | la de Node 22 | Monorepo: un `npm install` para las cuatro partes |
| Web | React | 19 | Interfaz |
| Web | Vite | 8 | Servidor de desarrollo y compilación |
| Web | React Router | 7 | Rutas de la web |
| Web | React Bootstrap / Bootstrap | 2 / 5 | Componentes y rejilla de la web |
| Web | lucide-react | 1 | Iconos de la web |
| Web | Leaflet | 1.9 | Mapa de ubicación de comunidades |
| Web | html2pdf.js | 0.14 | Imprimir o guardar en PDF (receta, constancias, reportes) |
| Móvil | Expo SDK | 57 | Plataforma de la app móvil (documentación versionada: <https://docs.expo.dev/versions/v57.0.0/>) |
| Móvil | React Native | 0.86 | Interfaz móvil |
| Móvil | React Navigation | 7 | Pestañas y pilas de pantallas |
| Móvil | @expo/vector-icons (Ionicons) | 15 | Iconos del móvil |
| Móvil | expo-secure-store, AsyncStorage | 57 / 2 | Sesión y borradores en el teléfono |
| Móvil | expo-print, expo-sharing | 57 | Imprimir o compartir la receta |
| Móvil | expo-notifications, NetInfo | 57 / 12 | Avisos y detección de "sin conexión" |
| Datos | Supabase (supabase-js) | 2.112 | Cliente de la base, autenticación y funciones |
| Datos | PostgreSQL | 15 (`supabase/config.toml`) | Base de datos |
| Datos | Supabase CLI | fija en los workflows (ver [CI-CD.md](CI-CD.md)) | Base local, migraciones, pruebas de la base |
| Datos | pgTAP | la del stack de Supabase | Pruebas de la base (`supabase/tests/database`) |
| Datos | Deno (Edge Functions) | el runtime de Supabase | `supabase/functions`: invitar usuarios, enviar notificaciones, alertas de vencimiento |
| Pruebas | Vitest | 4 | Pruebas de `packages/shared`, `ui-tokens` y web |
| Pruebas | Testing Library | React 16 / RN 13 | Pruebas de componentes y pantallas |
| Pruebas | Jest + jest-expo | 30 / 57 | Pruebas de la app móvil |
| Calidad | ESLint | 9 | Reglas de código, incluidas las de arquitectura |
| Calidad | Prettier | 3 | Formato |
| Operación | Docker / Docker Compose | cualquiera reciente | Stack local de Supabase; web en contenedor opcional |
| Operación | GitHub Actions | — | CI, migraciones, alertas diarias, mantener activa la base |
| Operación | Vercel | — | Hospedaje de la web (`vercel.json`) |
| Operación | Sentry | — | Registro de errores (opcional: vacío = solo consola) |
| Operación | Mailpit | la del stack de Supabase | Bandeja de correo local (<http://localhost:54424>) |

La lista de dependencias con su razón de ser está en [DEPENDENCIES.md](DEPENDENCIES.md).

## 3. Qué se necesita para trabajar

**En la máquina:**

- Node.js 22 y npm.
- Docker Desktop (o Docker Engine) corriendo: el stack local de Supabase son contenedores.
- Git.
- Para el móvil: la app **Expo Go** en un teléfono, o un emulador de Android o simulador de iOS.

La CLI de Supabase no se instala aparte: se usa con `npx supabase`.

**Cuentas y accesos** (los administra la organización; ver [CONFIGURACION-SUPABASE.md](CONFIGURACION-SUPABASE.md)):

| Servicio | Para qué | Quién necesita acceso |
| --- | --- | --- |
| GitHub (`URL-ECOPAC/Ecopac-Digital`) | Código, PRs, secrets de los workflows | Todo el equipo; secrets solo quien administra |
| Supabase: proyectos `ecopac-dev` y `ecopac-prod` | Base de datos, Auth, Edge Functions | Quien administra; el resto trabaja en local |
| Vercel | Despliegue de la web (preview por PR, producción desde `main`) | Quien administra |
| Sentry | Errores de web, móvil y Edge Functions | Quien da soporte |
| Proveedor SMTP | Correo de invitaciones y notificaciones | Quien administra |
| Expo (EAS) | Compilar la app móvil para tiendas o APK. Todavía no está configurado (ver sección 12) | Quien publique la app |

## 4. Puesta en marcha en local, paso a paso

```bash
# 1. Código y dependencias
git clone https://github.com/URL-ECOPAC/Ecopac-Digital.git
cd Ecopac-Digital
git checkout develop
npm install

# 2. Base de datos local (Docker tiene que estar corriendo)
npx supabase start          # levanta Postgres, Auth, Storage, Studio y Mailpit
npx supabase db reset --local   # aplica TODAS las migraciones y los datos de demostracion

# 3. Variables de entorno
cp .env.example .env.development
# Pegar en .env.development la URL y la llave anonima que imprimio `supabase start`
# (tambien las muestra `npx supabase status`): VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY y
# EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.

# 4. Web: http://localhost:5173
npm run dev:web

# 5. Movil: escanear el QR con Expo Go (o `npm run dev:mobilet` para usar un tunel)
npm run dev:mobile

# 6. (Opcional) Edge Functions en local, con su propio archivo de variables
npx supabase functions serve --env-file supabase/functions/.env
```

- **Usuarios de prueba**: los crea el seed de demostración; los correos, contraseñas y roles están en
  [DATOS-DEMO.md](DATOS-DEMO.md). Son datos inventados: nunca se usan datos reales de pacientes.
- **Studio** (el panel de la base local): <http://localhost:54423>. La API local queda en el
  puerto 54421 (los puertos están en `supabase/config.toml`).
- **Correo local**: todo lo que "se envía" en local cae en Mailpit, <http://localhost:54424>.
- Con Docker también se puede levantar la web en un contenedor: `npm run docker:dev`.

La guía corta equivalente es [QUICKSTART.md](QUICKSTART.md).

## 5. Configuración y claves de acceso

> **Regla:** ninguna llave real se sube al repositorio. `.env.development`, `.env.production` y
> `supabase/functions/.env` están en `.gitignore`. Los nombres de las variables sí están
> documentados; los valores, nunca.

### 5.1 Variables de las apps (`.env.development` / `.env.production`)

| Variable | La lee | Qué es | Dónde se obtiene | ¿Secreta? |
| --- | --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | web | URL del proyecto de Supabase | `supabase status` (local) o Dashboard > Project Settings > API | No |
| `VITE_SUPABASE_ANON_KEY` | web | Llave anónima (publishable): solo permite lo que RLS deja | Igual que la anterior | No, es pública por diseño |
| `EXPO_PUBLIC_SUPABASE_URL` | móvil | Igual que `VITE_SUPABASE_URL` | Igual | No |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | móvil | Igual que `VITE_SUPABASE_ANON_KEY` | Igual | No |
| `VITE_SENTRY_DSN` | web | DSN de Sentry; vacío = los errores quedan en la consola | Sentry > Project Settings > Client Keys | No (solo envía eventos) |
| `EXPO_PUBLIC_SENTRY_DSN` | móvil | Igual para el móvil | Igual | No |

La llave anónima es pública a propósito: quien protege los datos es Row Level Security, no el
secreto de la llave (ver [SEGURIDAD.md](SEGURIDAD.md)). La **service role key** salta RLS y
**jamás** va en una app ni en un archivo `VITE_*` / `EXPO_PUBLIC_*`.

### 5.2 Secrets de las Edge Functions

Se configuran en Supabase (Dashboard > Edge Functions > Secrets) en cada ambiente, y en local en
`supabase/functions/.env`:

| Secret | Qué es |
| --- | --- |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Servidor de correo para invitaciones y notificaciones (en local, Mailpit: `inbucket:1025`) |
| `WEB_URL` | URL pública de la web; con ella se arman los enlaces de los correos y el destino de la invitación (`/nueva-contrasena`) |
| `ALLOWED_ORIGINS` | Los orígenes de la web del ambiente, separados por comas. **Obligatorio**: sin él las funciones no aceptan ninguna llamada desde el navegador (`_shared/cors.ts` falla cerrado a propósito) y, por ejemplo, invitar a un colaborador da error de conexión |
| `SENTRY_DSN` | DSN de Sentry de las funciones (opcional) |
| `AMBIENTE` | Etiqueta de ambiente de los errores que reporta una función (opcional) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Los inyecta Supabase solo; no se configuran a mano |

Las Edge Functions son tres: `invitar-usuario` (alta de colaboradores),
`enviar-notificaciones` (correo de las notificaciones internas) y `alertas-vencimiento` (rutina
diaria de lotes por vencer).

### 5.3 Secrets de GitHub Actions

GitHub > Settings > Secrets and variables > Actions. Mientras falten, los workflows avisan en el
resumen de la corrida sin fallar; la excepción es el respaldo de la base, que falla en rojo.

| Secret | Lo usa | Qué es |
| --- | --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase, verificar despliegue, respaldo | Token personal de la CLI para vincular con el proyecto remoto |
| `SUPABASE_DB_PASSWORD` | Supabase, verificar despliegue | Contraseña de la base remota |
| `SUPABASE_PROJECT_REF_DEV`, `SUPABASE_PROJECT_REF_PROD` | Supabase (el de producción, también el respaldo) | Identificador de cada proyecto |
| `SUPABASE_URL_DEV`, `SUPABASE_SERVICE_ROLE_KEY_DEV` | Alertas de vencimiento (los dos) y mantener activo (la llave) | Para correr la rutina diaria y la consulta de mantenimiento contra `ecopac-dev` |
| `VITE_SUPABASE_URL_DEV`, `VITE_SUPABASE_ANON_KEY_DEV` | CI (compilar la web en `develop`) y mantener activo (la URL) | URL y llave anónima de `ecopac-dev` |
| `VITE_SUPABASE_URL_PROD`, `VITE_SUPABASE_ANON_KEY_PROD` | Solo CI, al compilar la web en `main` | URL y llave anónima de `ecopac-prod` |
| `SUPABASE_DB_PASSWORD_PROD` | Respaldo de la base | Contraseña de la base de producción, distinta de la de desarrollo |
| `RESPALDO_GPG_CLAVE_PUBLICA`, `RESPALDO_DRIVE_CLIENT_ID`, `RESPALDO_DRIVE_CLIENT_SECRET`, `RESPALDO_DRIVE_TOKEN` | Respaldo de la base | Llave pública con la que se cifra el respaldo y credencial de la cuenta de Drive de la organización |

Ningún workflow programado usa hoy secrets de producción salvo el respaldo: las alertas de
vencimiento y "mantener activo" apuntan a `ecopac-dev`. Los secrets de producción y los del
respaldo todavía no están configurados (ver sección 12).

El detalle de cada workflow y de cada secret está en [CI-CD.md](CI-CD.md).

### 5.4 Configuración de Supabase por ambiente

URLs de redirección de Auth, plantillas de correo, longitud mínima de contraseña, duración de la
sesión, SMTP y límites del plan: [CONFIGURACION-SUPABASE.md](CONFIGURACION-SUPABASE.md). En local
todo eso sale de `supabase/config.toml`.

## 6. Arquitectura

### 6.1 El monorepo

```
apps/
  web/            React + Vite: el panel de administracion
    src/pages/      una pagina por pantalla (y sus modales)
    src/components/ el catalogo de componentes de la web
    src/theme.js    publica los tokens como variables CSS (--color-*)
  mobile/         React Native + Expo: la operacion en campo
    src/screens/    una pantalla por archivo
    src/components/ el catalogo de componentes del movil (mismos nombres y props)
    src/navigation/ pestañas, pilas y guardas de rol
packages/
  shared/         la logica: API, validaciones, descriptores, permisos, hooks. Sin JSX.
  ui-tokens/      colores, tipografia, espaciados y textos comunes
supabase/
  migrations/     el esquema, en migraciones numeradas (00001 ... )
  tests/database/ pruebas pgTAP
  functions/      Edge Functions (Deno)
  seed*.sql       datos de demostracion
scripts/          guardas de CI y generadores de documentacion
docs/             documentacion
.github/          workflows, plantillas de issues y de PR
```

### 6.2 Las capas

```mermaid
flowchart TB
  subgraph Apps
    W[apps/web: paginas y componentes react-bootstrap]
    M[apps/mobile: pantallas y componentes React Native]
  end
  subgraph Compartido
    SH[packages/shared: hooks use*, descriptores, validaciones, permisos, *.api.js]
    T[packages/ui-tokens: colores, tipografia, textos]
  end
  DB[(Supabase: RLS, triggers, funciones, vistas)]
  W --> SH
  M --> SH
  W --> T
  M --> T
  SH -->|supabase-js| DB
```

**La regla central** ([ARQUITECTURA-FRONTEND.md](ARQUITECTURA-FRONTEND.md)): *una pantalla es un
hook y unos descriptores en `packages/shared`, más un componente por app.* Lo que la pantalla sabe
-qué consultar, cómo validar, qué columnas y filtros tiene, qué puede hacer cada rol- vive una sola
vez en shared; cada app solo lo dibuja.

Lo que se prohíbe, y lo comprueban ESLint y las guardas de CI:

- `packages/shared` no importa `react-dom`, `react-native` ni `react-bootstrap`, ni usa `window`,
  `document`, `localStorage` o `AsyncStorage`, ni devuelve JSX.
- Las apps no importan `@supabase/supabase-js`, ni escriben validaciones, formato o reglas de
  permisos dentro de un componente.
- Ningún color, espaciado o tamaño de letra se escribe a mano.
- Un contrato de API que cambia tiene que romper algo, no devolver una lista vacía
  (`npm run verificar:contratos`).

### 6.3 Recorrido de una petición

1. La pantalla llama al hook de shared (por ejemplo `useProyectosSociales`).
2. El hook llama a una función de `*.api.js` (`listarProyectos`).
3. La función usa el cliente de Supabase (`obtenerSupabase()`), que lleva la sesión del usuario.
4. PostgREST aplica **RLS**: la base decide qué filas ve y qué puede escribir esa persona.
5. Los triggers de la base validan reglas de negocio (transiciones de estado, inventario,
   presupuesto, cupo de la agenda, proyectos cancelados o finalizados, auditoría) y pueden
   rechazar la escritura.
6. El error, si lo hay, se normaliza en shared (`errores-de-supabase.js`) a un mensaje para la
   persona y un detalle saneado para el registro (sin datos de pacientes).
7. Si la escritura pasó, la base avisa por Realtime a las pantallas abiertas que muestran esa
   tabla, y cada una vuelve a leer con su consulta de siempre (`useCambiosEnTiempoReal`, migración
   `00163`). Nadie tiene que recargar para ver lo que otra persona acaba de cambiar.

## 7. Código compartido entre web y móvil

### 7.1 Qué hay en `packages/shared`

| Carpeta | Contenido |
| --- | --- |
| `api/` | Cliente de Supabase, sesión, paginación, errores |
| `entorno/` | Variables de entorno validadas al arrancar; rechaza una llave de servicio en el cliente |
| `hooks/` | Hooks transversales: sesión, búsqueda de pacientes, expiración por inactividad, panel de inicio, tiempo real |
| `observabilidad/` | Reporte de errores por un solo punto, sin datos de paciente |
| `pacientes/` | Pacientes, expediente, áreas de atención, triaje, consultas, recetas, condiciones crónicas, duplicados |
| `citas/` | Catálogo de clínicas y agenda de citas por jornada |
| `atenciones/` | Cola de la jornada y cierre de atenciones |
| `jornadas/` | Jornadas, equipo, insumos previstos, bodega de la jornada (carga, devolución y consumo), kanban, cierre |
| `inventario/` | Catálogo, lotes, existencias, movimientos, traslados entre bodegas, alertas y avisos de vencimiento, bodegas |
| `presupuestos/` | Presupuestos, orígenes del presupuesto, gastos y su aprobación, sobrante de la jornada y caja |
| `proyectos/` | Proyectos sociales, equipo, hitos, seguimiento, insumos |
| `donaciones/` | Donantes, donaciones, constancias |
| `reportes/` | Indicadores de impacto, pacientes atendidos, inventario, vencimientos, enfermedades, jornada |
| `usuarios/` | Roles, permisos, acceso por módulo, perfil, inicio de sesión |
| `notificaciones/`, `auditoria/`, `territorio/` | Buzón y envíos de correo, bitácora, departamentos/municipios/comunidades |
| `formato/`, `validations/` | Fechas en hora de Guatemala, moneda, opciones, tipo de acción de un botón; validadores |
| `navegacion.js`, `enums.js` | Módulos de la navegación por rol; valores y etiquetas de los enums |

Cada módulo sigue la misma estructura: `api.js` (consultas), `validaciones.js`, `campos.js`
(esquema de formulario), `columnas.js` (columnas de tabla y campos de tarjeta), `filtros.js`,
`permisos.js` y un `use<Pantalla>.js` por pantalla. `pacientes/` es el ejemplar de referencia.

Toda función exportada tiene JSDoc con parámetros y valor de retorno (lo exige
`npm run verificar:jsdoc -- --estricto`). El índice de la API está en [API-SHARED.md](API-SHARED.md).

### 7.2 El catálogo de componentes

Las dos apps implementan **los mismos componentes con las mismas props**, para que portar una
pantalla sea mecánico. Solo cambia el nombre del evento (`onClick` en la web, `onPress` en el
móvil) y la disposición en un teléfono.

| Componente | Web | Móvil | Para qué |
| --- | --- | --- | --- |
| `ScreenContainer`, `PageHeader`, `SectionHeader`, `Card` | si | si | Estructura de pantalla |
| `DataList` | tabla | tarjetas | Listas a partir de un descriptor de columnas |
| `FilterBar` | fila de filtros | buscador + panel lateral | Filtros a partir de un descriptor |
| `TextField`, `NumberField`, `DateField`, `PasswordField`, `Selector`, `MultiSelector`, `SelectorConAlta`, `CampoDeFormulario` | si | si | Campos de formulario |
| `PrimaryButton`, `SecondaryButton`, `BotonLimpiarFiltros` | si | si | Botones (ver 8.3) |
| `StatusChip`, `StatCard` | si | si | Estados e indicadores |
| `LoadingState`, `EmptyState`, `ErrorState` | si | si | Los tres estados de toda pantalla con datos |
| `Modal`, `Tabs`, `KanbanBoard` | si | si | Diálogos, pestañas y tableros |
| `FormularioSignosVitales`, `CascadaDeComunidad` | si | si | Piezas de formulario del dominio |
| `BotonExportarCSV`, `BotonImprimir`, `BotonesDeRango`, `GraficaDeBarras`, `Paginacion` | si | — | Reportes en la web |
| `MenuLateral`, `PanelLateral` | — | si | Opciones de una sección y filtros en un teléfono |

### 7.3 Archivos que usan las dos apps

- **`@ecopac/shared`**: toda la lógica (hooks, API, validaciones, descriptores, permisos,
  formato). Una pantalla web y su pantalla móvil llaman al mismo hook.
- **`@ecopac/ui-tokens`**: colores, tipografía, espaciados, sombras, acentos por módulo, colores de
  estado y textos comunes.
- **`navegacion.js`**: qué módulos ve cada rol, en la web y en las pestañas del móvil.

## 8. Buenas prácticas de interfaz

### 8.1 Colores, tipografía y espaciado: un solo archivo

Todo sale de `packages/ui-tokens/index.js`:

| Token | Valor | Uso |
| --- | --- | --- |
| `colors.primary` | `#3DB648` | Acción principal, marca (verde Ecopac) |
| `colors.primaryDark` | `#1E7A28` | Texto sobre fondos claros de marca |
| `colors.secondary` | `#4D4D4D` | Acciones neutras |
| `colors.danger` | `#E91E8C` | Error, borrado |
| `colors.warning` | `#F7941D` | Advertencia, por vencer |
| `colors.info` | `#29ABE2` | Información |
| `colors.background` / `surface` | `#F7F8FA` / `#FFFFFF` | Fondo de pantalla / de tarjeta |
| `colors.border` | `#E2E4E9` | Bordes |
| `colors.text` / `textMuted` | `#2D2D2D` / `#7A7A8A` | Texto / texto secundario |

Además: `typography` (familia, tamaños `xxs` a `xxl`, pesos), `spacing` (`xs` 4 a `xl` 32),
`radii`, `shadows`, `moduleAccents` (el color de cada módulo) y `statusColors` (el color de cada
estado: pendiente, aprobado, en curso, cancelado...).

- En la web se consumen como variables CSS `var(--color-*)`, que publica `apps/web/src/theme.js`.
- En el móvil se importan directo: `colors.primary`, `spacing.md`.
- **Nunca un color a mano.** `npm run verificar:paleta` compara los colores que usa cada archivo
  contra una línea base y falla si aparece uno nuevo sin explicación.

La paleta y el porqué de cada color: [DISENO.md](DISENO.md).

### 8.2 Textos en un solo lugar

- **Textos comunes** (estados, avisos, "Cargando..."): `labels` de `@ecopac/ui-tokens`.
- **Etiquetas de enums** (estados de jornada, tipos de donación, roles): `ETIQUETAS_*` en
  `packages/shared` (`enums.js` y cada módulo), derivadas del mismo enum de la base.
- **Etiquetas de campos, columnas y filtros**: en los descriptores de shared (`campos.js`,
  `columnas.js`, `filtros.js`), no en el componente. Una pantalla no escribe la etiqueta de un campo.
- **Fechas y moneda**: `formato/fechas.js` y `formato/moneda.js` (hora local de Guatemala, "Q").
- Sin emojis en código, textos, commits, issues ni PRs (`npm run verificar:sin-emojis`).

### 8.3 Botones

| Botón | Cuándo |
| --- | --- |
| `PrimaryButton` (verde) | La acción que resuelve la pantalla o confirma el formulario. **Una por pantalla.** |
| `SecondaryButton` (contorno o gris) | Lo demás: cancelar, volver, acciones secundarias |
| `BotonLimpiarFiltros` | Siempre visible en la barra de filtros; gris y deshabilitado sin filtros, verde con filtros |
| `BotonExportarCSV` ("Exportar CSV") | Descargar una tabla o reporte |
| `BotonImprimir` ("Imprimir / PDF") | Imprimir o guardar en PDF |

**El icono sale del verbo, no de quien escribe el botón.** `tipoDeAccion()`
(`packages/shared/formato/acciones.js`) clasifica el rótulo y cada app pone su icono:

| Empieza con | Tipo | Icono |
| --- | --- | --- |
| Nuevo, Crear, Agregar, Registrar, Alta de, o "+" | alta | "+" (dentro de un formulario, disquete: confirma) |
| Guardar, Confirmar | guardado | disquete |
| Cancelar | cancelar | X, en gris |
| Eliminar, Borrar, Quitar | borrado | basurero |
| Volver, Regresar, Atrás | retorno | flecha |
| Editar, Corregir, Modificar | edición | lápiz |
| Ver, Detalle, Abrir | detalle | ojo |

"Desactivar", "Anular" y "Rechazar" **no** son borrado: cambian un estado que queda registrado.

### 8.4 Estados y pantallas

- Toda pantalla con datos dibuja **cargando, vacío y error** (`LoadingState`, `EmptyState`,
  `ErrorState`); un error de red ofrece "Reintentar" y una lista vacía por filtros ofrece
  "Limpiar filtros".
- El estado de algo se dice con texto y color a la vez (`StatusChip` con su etiqueta y el color de
  `statusColors`).
- En el móvil: área táctil mínima de 48 dp, el texto se ajusta en vez de truncarse, filtros y
  opciones de sección en panel lateral, una acción principal por pantalla. Las reglas completas:
  [DISENO-MOVIL.md](DISENO-MOVIL.md).

## 9. Base de datos

### 9.1 En números

Al cierre de este documento (13 de octubre de 2026, migración `00188`; 180 archivos de migración):
**60 tablas, 9 vistas, 23 tipos enumerados, 545 columnas, 113 llaves foráneas, 70 restricciones
CHECK, 157 políticas RLS, 154 triggers (47 de ellos de auditoría) y 145 funciones (78 de negocio o
de autorización y 67 de trigger).** Las cifras son las del resumen del diccionario de datos, que
se genera del catálogo de la base. Todas las tablas tienen RLS activo y todas las tablas,
columnas, vistas, enums y funciones tienen descripción (lo exige la prueba
`diccionario_de_datos.sql`).

- **Diccionario de datos completo** -cada tabla con sus campos, tipos, nulos, valores por defecto,
  llaves, restricciones, políticas y triggers, con diagramas entidad-relación por módulo-:
  [DICCIONARIO-DE-DATOS.md](DICCIONARIO-DE-DATOS.md) (**generado**).
- **Por qué es así cada tabla** y las decisiones de modelado: [MODELO-DE-DATOS.md](MODELO-DE-DATOS.md).

### 9.2 Diagrama general

Las relaciones principales entre módulos (el detalle, con todas las columnas, está en el
diccionario):

```mermaid
erDiagram
  departamentos ||--o{ municipios : "tiene"
  municipios ||--o{ comunidades : "tiene"
  comunidades ||--o{ jornadas : "se hace en"
  comunidades |o--o{ pacientes : "vive en"
  pacientes ||--|| expedientes : "tiene"
  pacientes ||--o{ paciente_area : "se atiende en"
  areas_atencion ||--o{ paciente_area : "agrupa"
  pacientes ||--o{ atenciones : "visita"
  jornadas ||--o{ atenciones : "recibe"
  atenciones ||--o{ triajes : "signos vitales"
  atenciones ||--o{ consultas : "consulta"
  consultas ||--o{ consulta_diagnostico : "diagnosticos"
  pacientes ||--o{ citas : "agenda"
  jornadas ||--o{ citas : "agenda"
  clinicas ||--o{ citas : "en"
  areas_atencion ||--o{ citas : "para"
  citas |o--o{ consultas : "se atiende con"
  consultas ||--o{ recetas : "receta"
  recetas ||--o{ receta_detalle : "renglones"
  medicamentos ||--o{ lotes : "lotes"
  lotes ||--o{ existencias : "por bodega"
  bodegas ||--o{ existencias : "guarda"
  bodegas |o--o{ jornadas : "bodega de la jornada"
  proveedores ||--o{ lotes : "provee"
  donantes |o--o| proveedores : "su proveedor"
  lotes ||--o{ movimientos_inventario : "ingresos y salidas"
  lotes |o--o{ receta_detalle : "se entrega de"
  jornadas ||--o{ jornada_personal : "equipo"
  perfiles ||--o{ jornada_personal : "participa"
  jornadas ||--o{ gastos : "gastos"
  jornadas ||--o{ jornada_insumos : "insumos previstos"
  jornadas ||--o{ jornada_presupuesto_origen : "aportes al presupuesto"
  donaciones |o--o{ jornada_presupuesto_origen : "origen"
  jornada_presupuesto_origen ||--o{ movimientos_de_caja : "caja"
  proyectos ||--o{ jornadas : "agrupa"
  proyectos ||--o{ proyecto_hitos : "hitos"
  proyectos ||--o{ proyecto_personal : "equipo"
  donantes ||--o{ donaciones : "dona"
  donaciones ||--o{ donacion_detalle : "renglones"
  proyectos |o--o{ donaciones : "destino"
  jornadas |o--o{ donaciones : "destino"
```

Toda jornada nueva pertenece a un proyecto y lleva una bodega, móvil o la principal. Las dos
columnas admiten nulo solo por las jornadas anteriores: lo exigen triggers, no un `NOT NULL`
(migraciones `00169` y `00178`).

### 9.3 Cómo está protegida

- **Row Level Security en todas las tablas.** Quien protege los datos es la base, no la interfaz:
  un botón escondido no es seguridad. Cada política dice qué filas ve y escribe cada rol.
- **Roles** (enum `rol_usuario`): administrador, junta directiva, socio fundador, médico y
  voluntario general. **Permisos finos** delegables por rol o por persona (`permisos`,
  `rol_permiso`, `usuario_permiso`) y **módulos** que la administración abre a un rol
  (`rol_modulo`).
- Las políticas preguntan con funciones como `es_administrador()`, `tiene_permiso('clave')`,
  `participa_en_jornada(id)`, `pertenece_a_proyecto(id)` y `puede_consultar_reportes()`.
- **Sin sesión no se ve nada**: el rol `anon` no tiene privilegios sobre las tablas
  (`privilegios_anon.sql` lo prueba).
- **Funciones `SECURITY DEFINER`** solo cuando hace falta saltar RLS para una operación puntual, y
  validan por dentro quién las llama; las de trigger no se pueden llamar directamente.
- **Vistas agregadas** para los reportes: los roles consultivos ven totales, no filas clínicas.
- **Reglas de negocio en triggers**: transiciones de estado de jornadas y proyectos; proyecto
  cancelado o finalizado de solo lectura (`00154`, `00172`); inventario que no queda negativo y
  que no se entrega dos veces mientras espera aprobación (`00186`); gastos aprobados que no
  cambian y que no pasan del presupuesto de su jornada (`00159`); cupo de la clínica y traslapes
  de la agenda de citas (`00184`); toda jornada con proyecto y con bodega (`00169`, `00178`).
- **Una donación registrada no se corrige ni se anula**: desde la `00173` no tiene política de
  UPDATE y la función que la anulaba ya no existe.
- **Tiempo real con el mismo RLS**: las tablas de negocio están en la publicación
  `supabase_realtime` (`00163`) y el aviso de un cambio solo llega a quien puede leer esa fila.
- **Bitácora de auditoría** (`eventos_auditoria`): cada alta, cambio y baja de las tablas de
  negocio, con quién y cuándo.

La matriz completa de qué puede hacer cada rol, con la política que lo implementa:
[PERMISOS.md](PERMISOS.md). Protección de datos personales: [PROTECCION-DE-DATOS.md](PROTECCION-DE-DATOS.md).
Autenticación y endurecimiento: [SEGURIDAD.md](SEGURIDAD.md).

### 9.4 Migraciones

- El esquema **es** `supabase/migrations/`: cuando el código, la documentación y la base no
  coinciden, mandan las migraciones.
- **Una migración aplicada no se edita nunca**: se corrige con una nueva.
- Nombre `NNNNN_descripcion.sql`, cinco dígitos, **mayor que la última de `develop`**; el número se
  vuelve a revisar antes de mergear.
- **Nadie corre `supabase db push` a mano**: se mergea el PR y la aplica el workflow.
- Cada migración nueva lleva su prueba pgTAP y el `COMMENT ON` de lo que crea.

Todo el detalle, y qué hacer cuando falla un despliegue: [CI-CD.md](CI-CD.md).

## 10. Pantallas

**40 rutas en la web y 31 pantallas en el móvil.** Para cada una, qué tablas, vistas, funciones de
la base y Edge Functions usa, y a la inversa, qué pantallas usan cada tabla:
[PANTALLAS.md](PANTALLAS.md) (**generado**).

Por módulo, en la web: inicio, pacientes (listado, ficha, crónicos, condiciones, diagnósticos,
comunidades, áreas de atención, clínicas, agenda de citas, duplicados), jornadas (tablero y
detalle, con sus pestañas de equipo, presupuesto, gastos, insumos, consumo y cierre), inventario
(con la configuración de los avisos de vencimiento), presupuestos (con la caja), proyectos
(listado y seguimiento), donaciones (resumen, registro, historial, constancia, donantes), reportes
(impacto, vencimientos, pacientes atendidos, inventario, enfermedades, reporte de jornada),
colaboradores, matriz de permisos, bitácora, perfil y notificaciones.

En el móvil, en cinco pestañas: Inicio, Pacientes (búsqueda, ficha, registro, historial, consulta,
receta, entrega, crónicos, condiciones, diagnósticos, citas), Jornadas (asignadas, en curso,
selección, kanban, detalle de la jornada, proyectos), Inventario (stock, ingreso, salida y
traslado, existencias, alertas, movimientos, detalle de lote, principios activos, por aprobar) y
Ajustes (perfil y notificaciones). El detalle pantalla por pantalla, con el hook que sirve a cada
una, está en [MODULOS.md](MODULOS.md).

Qué módulo ve cada rol lo decide `packages/shared/navegacion.js`; las pantallas del móvil además
llevan una guarda de rol (`conGuardaDeRol`), y la prueba `guardaDeRol.test.js` comprueba que
ninguna quede sin ella.

## 11. Calidad: pruebas y guardas

| Comando | Qué comprueba |
| --- | --- |
| `npm run lint` | ESLint en todo el monorepo, incluidas las reglas de arquitectura |
| `npm test` | Vitest (shared, ui-tokens, web) y Jest (móvil) |
| `npx supabase test db --local` | pgTAP: políticas RLS, triggers, funciones y reglas de la base |
| `npm run test:e2e` | Flujos críticos de punta a punta contra el stack local (atención clínica, agenda de citas, validación de inventario, reportes). No corre con `npm test`: necesita `supabase start` |
| `npm run build` | Que la web compile |
| `npm run verificar:jsdoc -- --estricto` | Toda función exportada de shared con JSDoc completo |
| `npm run verificar:contratos` | Que las apps lean la clave que de verdad devuelve cada función de shared |
| `npm run verificar:shared-esquema` | Que shared no pida columnas o tablas que no existen en el esquema |
| `npm run verificar:paleta` | Que ningún archivo cambie de color sin que se note |
| `npm run verificar:sin-emojis` | Sin emojis en el repositorio |
| `npm run verificar:rewrite-vercel`, `verificar:cabeceras-http` | Configuración de Vercel: rutas y cabeceras de seguridad |
| `npm run verificar:redireccion` | Enlace de recuperación de contraseña contra un despliegue real |
| `npm run verificar:concurrencia-ficha` | Prueba manual: varias conexiones registran pacientes a la vez contra el stack local y ninguna repite número de ficha |

Los workflows `ci.yml` y `supabase.yml` corren esto en cada PR, salvo las dos últimas filas, que
son manuales. El plan y los casos de prueba:
[PLAN-DE-PRUEBAS.md](PLAN-DE-PRUEBAS.md) y [CASOS-DE-PRUEBA.md](CASOS-DE-PRUEBA.md).

## 12. Ambientes y despliegue

> **Estado al 13 de octubre de 2026.** El sistema funciona en local y en el ambiente de desarrollo.
> **Producción todavía no está desplegada**: el diseño está decidido y varias piezas están escritas,
> pero la salida a producción es la issue #252 y sigue abierta. Esta sección dice qué hay de verdad
> hoy y qué falta; no describe un despliegue que no existe.

### 12.1 Los tres ambientes

| Ambiente | Rama | Base | Web | Estado hoy |
| --- | --- | --- | --- | --- |
| Local | cualquiera | `supabase start` (Docker) | `npm run dev:web` | Funciona. Es donde se desarrolla y se prueba |
| Desarrollo / staging | `develop` | Supabase `ecopac-dev` (proyecto `Ecopac-Digital-Dev`) | No se despliega: se corre en local apuntando a `ecopac-dev` | Funciona. Las migraciones y las Edge Functions se aplican solas al mergear |
| Producción | `main` | Supabase `ecopac-prod` (proyecto `Ecopac-Digital-Prod`) | Pensada para Vercel | **Sin desplegar.** Ver 12.3 |

### 12.2 Lo que funciona hoy

- **Flujo de Git**: rama desde `develop` (`feature/...`, `fix/...`, `chore/...`), PR hacia
  `develop` con "Closes #X", commits con Conventional Commits, squash and merge. `main` solo recibe
  `develop` con PR aprobado. Ver [CONTRIBUTING.md](CONTRIBUTING.md).
- **Base de desarrollo**: al mergear a `develop`, el workflow `supabase.yml` aplica las migraciones
  nuevas a `ecopac-dev` y despliega las Edge Functions. Nadie corre `supabase db push` a mano.
- **Configuración de `ecopac-dev`**: las 23 comprobaciones de
  [CONFIGURACION-SUPABASE.md](CONFIGURACION-SUPABASE.md) están recorridas y registradas. El SMTP de
  las Edge Functions se dejó sin configurar a propósito hasta producción.
- **Web**: se compila en cada PR (`npm run build` en el CI) y `vercel.json` ya define las rutas y
  las cabeceras de seguridad, que dos guardas comprueban. Hay además una imagen autohospedable:
  `npm run docker:prod` (Nginx, `apps/web/Dockerfile`).
- **Móvil**: se prueba con Expo Go o en un emulador (`npm run dev:mobile`).
- **Tareas programadas**: son workflows de GitHub Actions (alertas de vencimiento, mantener activa
  la base, verificar el despliegue, respaldo). Se pueden correr a mano desde la pestaña Actions.
  Las alertas y "mantener activo" apuntan a `ecopac-dev`.

### 12.3 Producción: qué hay y qué falta

Lo que **ya está preparado** en el repositorio:

- **El esquema completo viaja en las migraciones.** Levantar la base de producción es aplicarlas
  desde cero; ningún `seed` se ejecuta en producción, y los catálogos del primer día (territorio,
  permisos, bodegas, catálogos clínicos) ya vienen en ellas
  ([DESPLIEGUE_BASE_DE_DATOS.md](DESPLIEGUE_BASE_DE_DATOS.md)).
- **El administrador inicial** (issue #913, migración `00188`): al aplicarse, crea la cuenta de
  administración de la organización sin contraseña. La contraseña se fija en el primer ingreso con
  "Olvidé mi contraseña", así que no hay ninguna credencial en el repositorio.
- **El respaldo de la base** (issue #914): `respaldo-base.yml` saca un volcado diario, lo cifra con
  la llave pública de la organización y lo sube a su Google Drive, conservando los 30 más
  recientes. El respaldo y la restauración están ensayados de punta a punta contra el stack local.
  Producción queda en el plan gratuito de Supabase, que no incluye respaldos: este es el único.
  Plan y procedimiento: [RESPALDO-Y-RECUPERACION.md](RESPALDO-Y-RECUPERACION.md).
- **La lista de lo que se configura a mano** en el Dashboard de un ambiente nuevo, con cómo se
  comprueba cada punto y el orden de aprovisionamiento:
  [CONFIGURACION-SUPABASE.md](CONFIGURACION-SUPABASE.md).

Lo que **no existe todavía**, y por qué:

- **`main` no tiene el sistema.** Su último commit es del 13 de agosto de 2026 y está 428 commits
  detrás de `develop`. Nada de lo construido desde entonces ha llegado a la rama de producción.
- **`ecopac-prod` no está en uso.** Según [CI-CD.md](CI-CD.md) y
  [CONFIGURACION-SUPABASE.md](CONFIGURACION-SUPABASE.md), el proyecto está pausado y su
  configuración no se puede leer sin reanudarlo: las 23 comprobaciones del registro por ambiente
  están pendientes en la columna de producción.
- **Faltan los secrets de producción en GitHub**: `SUPABASE_PROJECT_REF_PROD`,
  `SUPABASE_DB_PASSWORD_PROD` y los cuatro del respaldo no estaban creados al 11 de octubre de 2026.
- **La web no está publicada.** El diseño es Vercel conectado al repositorio (preview por PR y
  producción desde `main`), pero el plan Hobby de Vercel no se puede conectar a un repositorio que
  pertenece a una organización de GitHub. Las salidas -desplegar por CLI desde un workflow, pagar
  Vercel Pro o mover la web a otro servicio- y su costo están en
  [COSTOS-Y-LIMITES.md](COSTOS-Y-LIMITES.md); la decisión no está tomada.
- **La app móvil no tiene compilación distribuible.** No hay `eas.json` ni perfil de compilación;
  `apps/mobile/app.config.js` declara `slug: ecopac-digital` y `version: 0.1.0`. Cómo se va a
  distribuir (EAS, APK directo o tiendas) está por decidir.
- **Las tareas programadas no corren solas.** GitHub solo dispara un horario desde la rama por
  defecto, que es `main`, y ahí solo existe "mantener activo". Alertas de vencimiento, verificar
  despliegue y respaldo empezarán a correr por horario cuando `develop` entre a `main`.
- **El respaldo no ha corrido nunca contra una base real**: faltan la credencial de Drive y el par
  de llaves de la organización, y con ellos la primera corrida y la primera restauración real.

### 12.4 Pendiente de la issue #252

Para que esta sección describa una producción real hace falta, en este orden:

1. Reanudar `ecopac-prod` y confirmar su plan.
2. Crear los secrets de producción en GitHub y mergear `develop` a `main`: el workflow aplica las
   180 migraciones y despliega las Edge Functions.
3. Recorrer [CONFIGURACION-SUPABASE.md](CONFIGURACION-SUPABASE.md) en `ecopac-prod`, empezando por
   cerrar el registro público, y llenar su columna: URLs de Auth, política de contraseñas, plantillas de
   correo, SMTP, secrets de las Edge Functions (`ALLOWED_ORIGINS` y `WEB_URL` con el dominio real),
   extensiones y Vault.
4. Fijar la contraseña del administrador inicial y comprobar el ingreso.
5. Decidir y montar el despliegue de la web, con su dominio.
6. Apuntar las alertas de vencimiento y "mantener activo" a producción: hoy leen secrets `_DEV`.
7. Configurar el respaldo (cuenta de Google, credencial de Drive, par de llaves), correrlo y hacer
   **la primera restauración real** antes de que producción reciba datos reales.
8. Decidir la distribución de la app móvil y, si es con EAS, agregar `eas.json` y sus variables.

Cuando eso cierre, esta sección, la 8 de [ARQUITECTURA.md](ARQUITECTURA.md) y las tablas de
ambientes de [CI-CD.md](CI-CD.md) se reescriben con lo que haya quedado.

**Costos y límites** del plan gratuito y cuánto crece la base:
[COSTOS-Y-LIMITES.md](COSTOS-Y-LIMITES.md).

## 13. Cómo hacer un cambio típico

**Agregar un campo a una entidad** (por ejemplo, un dato nuevo del paciente):

1. Rama desde `develop`.
2. Migración nueva con el `ALTER TABLE`, su `COMMENT ON COLUMN` y, si cambia quién puede leerlo o
   escribirlo, la política. Prueba pgTAP en `supabase/tests/database/`.
3. `npx supabase db reset --local` y `npx supabase test db --local`.
4. En shared: la columna en `api.js`, el campo en `campos.js`, la columna en `columnas.js`, la
   validación en `validaciones.js`, con sus pruebas.
5. Las dos apps lo toman de los descriptores; si hace falta, se ajusta el componente.
6. Si cambió una política o un permiso: [PERMISOS.md](PERMISOS.md) en el mismo PR.
7. Regenerar la documentación generada: `npm run docs:diccionario` y `npm run docs:pantallas`.
8. `npm run lint`, `npm test`, las guardas y el PR hacia `develop`.

**Agregar una pantalla**: el hook y los descriptores en shared, la página web y la pantalla móvil
con el catálogo de componentes, la ruta (`App.jsx` / `AppNavigator.js`, con su guarda de rol) y un
acceso visible hacia ella. La receta completa: [ARQUITECTURA-FRONTEND.md](ARQUITECTURA-FRONTEND.md),
"Cómo construir una pantalla nueva".

## 14. Mapa de la documentación

| Documento | De qué trata |
| --- | --- |
| [QUICKSTART.md](QUICKSTART.md) | Arrancar en cinco minutos |
| [ARQUITECTURA.md](ARQUITECTURA.md) | Contexto, capas, decisiones y su porqué |
| [ARQUITECTURA-FRONTEND.md](ARQUITECTURA-FRONTEND.md) | La regla de shared + un componente por app |
| [MODULOS.md](MODULOS.md) | Cada pantalla, en qué app está, qué hook la sirve y contra qué tablas trabaja |
| [API-SHARED.md](API-SHARED.md) | Índice de la API de `packages/shared` |
| [API-E-INTEGRACIONES.md](API-E-INTEGRACIONES.md) | Cómo se comunican las apps, la capa compartida y los servicios externos |
| [DICCIONARIO-DE-DATOS.md](DICCIONARIO-DE-DATOS.md) | **Generado.** Todas las tablas, campos, relaciones, políticas y triggers |
| [PANTALLAS.md](PANTALLAS.md) | **Generado.** Pantallas y los datos que usa cada una |
| [MODELO-DE-DATOS.md](MODELO-DE-DATOS.md) | El porqué del modelo de datos |
| [PERMISOS.md](PERMISOS.md) | Qué puede hacer cada rol y qué política lo implementa |
| [SEGURIDAD.md](SEGURIDAD.md), [PROTECCION-DE-DATOS.md](PROTECCION-DE-DATOS.md) | Autenticación, endurecimiento y datos personales |
| [CI-CD.md](CI-CD.md), [CONFIGURACION-SUPABASE.md](CONFIGURACION-SUPABASE.md) | Workflows, secrets, migraciones, ambientes |
| [SUPABASE.md](SUPABASE.md) | Proyecto en la nube contra stack local, y el flujo de una migración |
| [DESPLIEGUE_BASE_DE_DATOS.md](DESPLIEGUE_BASE_DE_DATOS.md) | Cómo se levanta la base de producción desde cero y el administrador inicial |
| [RESPALDO-Y-RECUPERACION.md](RESPALDO-Y-RECUPERACION.md) | Plan de respaldo de la base de producción y procedimiento de recuperación |
| [DISENO.md](DISENO.md), [DISENO-MOVIL.md](DISENO-MOVIL.md) | Paleta, navegación y criterio de diseño móvil |
| [COSTOS-Y-LIMITES.md](COSTOS-Y-LIMITES.md) | Plan gratuito y crecimiento |
| [PLAN-DE-PRUEBAS.md](PLAN-DE-PRUEBAS.md), [CASOS-DE-PRUEBA.md](CASOS-DE-PRUEBA.md) | Estrategia y casos de prueba |
| [CUMPLIMIENTO-DE-REQUERIMIENTOS.md](CUMPLIMIENTO-DE-REQUERIMIENTOS.md) | Cada requerimiento y su estado |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Flujo de trabajo del equipo |
| [manual/](manual/README.md) | Manuales de usuario por rol y material de capacitación |
| [formal/documentacion-tecnica.docx](formal/documentacion-tecnica.docx) | Documento formal para quien no tiene acceso al repositorio: consolida este manual y los documentos que resume |

**Mantener los generados al día:** con la base local actualizada (`npx supabase db reset --local`),
`npm run docs:diccionario` y `npm run docs:pantallas`. No se editan a mano.
