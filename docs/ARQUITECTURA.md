# Arquitectura del sistema - Ecopac Digital

Este documento es la **puerta de entrada tecnica** al repositorio: que construye el sistema, en
que piezas se divide, por que estan divididas asi, y donde esta escrito cada detalle.

Se lee de arriba hacia abajo sin necesidad de tener el codigo abierto. Cuando una seccion agota
lo que se puede explicar de forma general, enlaza al documento de referencia que lo desarrolla.

| Si buscas...                                | Ve a                                                     |
| ------------------------------------------- | -------------------------------------------------------- |
| Tablas, columnas, funciones y politicas RLS | [MODELO-DE-DATOS.md](./MODELO-DE-DATOS.md)               |
| Que pantallas existen y en que estado       | [MODULOS.md](./MODULOS.md)                               |
| Que exporta `packages/shared`               | [API-SHARED.md](./API-SHARED.md)                         |
| Como se comparte el frontend                | [ARQUITECTURA-FRONTEND.md](./ARQUITECTURA-FRONTEND.md)   |
| Quien puede hacer que                       | [PERMISOS.md](./PERMISOS.md)                             |
| Correr el proyecto                          | [QUICKSTART.md](./QUICKSTART.md)                         |

---

## 1. El problema

Ecopac Guatemala es una ONG que ejecuta jornadas medicas y dentales gratuitas en comunidades
rurales. Antes de este sistema, la operacion completa se sostenia sobre papel y WhatsApp:

- El expediente del paciente era una hoja fisica que viajaba en una caja. Si el paciente volvia
  en otra jornada, en otra comunidad, su historial no estaba ahi.
- El inventario de medicamentos se llevaba en cuadernos por bodega. Los vencimientos se
  descubrian al abrir la caja, en la comunidad, con el paciente enfrente.
- La planificacion de jornadas -quien va, con que turno, con que presupuesto- vivia en hilos de
  chat.
- Los reportes para donantes y junta directiva se armaban a mano al final de cada jornada.

El sistema digitaliza esas cuatro cosas, y agrega la que el papel nunca pudo dar: **trazabilidad**
(quien registro que, cuando) y **control de acceso** (que un voluntario no vea lo que no le toca).

### Restricciones que moldean el diseno

Estas no son detalles: explican casi todas las decisiones de las secciones siguientes.

| Restriccion                            | Consecuencia en el diseno                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Se trabaja en campo, sin buena senal   | La operacion de jornada vive en la app movil, no en la web                                |
| Son datos clinicos de personas reales  | El control de acceso se aplica en la base de datos (RLS), no en el cliente                |
| El equipo tecnico es pequeno           | Una sola implementacion de la logica, reutilizada por las dos apps                        |
| Plan gratuito de Supabase              | Sin `pg_cron`: las rutinas programadas se disparan desde GitHub Actions                   |
| Rotacion de voluntariado               | Roles y permisos finos, y auditoria de quien hizo cada cosa                               |

---

## 2. Vista de contexto

```mermaid
graph TB
    subgraph Personas
        ADMIN[Administradora]
        JUNTA[Junta directiva /<br/>Socio fundador]
        MEDICO[Medico]
        VOL[Voluntario]
    end

    subgraph Aplicaciones
        WEB[apps/web<br/>React + Vite<br/>Panel de administracion]
        MOV[apps/mobile<br/>React Native + Expo<br/>Operacion en campo]
    end

    LOGICA[packages/shared<br/>API, validaciones, permisos,<br/>descriptores y hooks]

    subgraph Supabase
        AUTH[Auth]
        PG[(PostgreSQL<br/>+ Row Level Security)]
        EDGE[Edge Functions]
    end

    GH[GitHub Actions<br/>CI/CD y cron]

    ADMIN --> WEB
    JUNTA --> WEB
    MEDICO --> MOV
    VOL --> MOV

    WEB --> LOGICA
    MOV --> LOGICA
    LOGICA --> AUTH
    LOGICA --> PG
    LOGICA --> EDGE
    EDGE --> PG
    PG -->|pg_net: incidencia nueva| EDGE
    EDGE -->|correo SMTP| SMTP[Proveedor de correo]
    GH -->|dispara diariamente| EDGE
    GH -->|aplica migraciones| PG
```

Quien usa que:

- **Web**: administracion, planificacion, reportes y gobernanza. La usa la administradora; los
  roles consultivos (junta directiva, socio fundador) entran **solo a Reportes** desde la #864.
- **Movil**: lo que pasa durante la jornada. La usan medicos y voluntarios: registrar al
  paciente, tomar el triaje, hacer la consulta, emitir la receta, descontar del botiquin. Los
  roles consultivos no pueden usarla (`puedeUsarAppMovil` en `packages/shared/navegacion.js`).
- **Reportes**, donaciones, presupuestos, proyectos, colaboradores, la matriz de permisos y la
  bitacora de auditoria existen unicamente en la web (`movil: false` en `navegacion.js`).

---

## 3. Las cuatro capas

```mermaid
graph TD
    A["<b>1. Apps</b><br/>apps/web (jsx) - apps/mobile (js)<br/>Solo presentacion: renderizan descriptores"]
    B["<b>2. Logica compartida</b><br/>packages/shared<br/>api.js, validaciones.js, campos.js, columnas.js,<br/>filtros.js, permisos.js, use&lt;Pantalla&gt;.js"]
    C["<b>3. Cliente de datos</b><br/>packages/shared/api<br/>Cliente Supabase, sesion, normalizacion de errores"]
    D["<b>4. Base de datos</b><br/>PostgreSQL + RLS + funciones + triggers<br/>supabase/migrations"]

    A -->|importa hooks y descriptores| B
    B -->|obtenerSupabase| C
    C -->|PostgREST / RPC| D
    D -.->|<b>decide de verdad quien puede que</b>| D
```

La regla que sostiene todo esto:

> Una pantalla es **un hook y unos descriptores en `packages/shared`**, mas **un componente por
> app**.

Ese es el contrato completo, y esta desarrollado en
[ARQUITECTURA-FRONTEND.md](./ARQUITECTURA-FRONTEND.md), lectura obligatoria antes de tocar
`apps/` o `packages/shared`.

### Que vive en cada capa

| Capa                | Contiene                                                                       | Nunca contiene                                                    |
| ------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `apps/web`          | JSX con `react-bootstrap`, rutas, layout                                       | Validaciones, reglas de negocio, decisiones de permisos, SQL      |
| `apps/mobile`       | JSX con los componentes propios, navegacion                                    | Lo mismo                                                          |
| `packages/shared`   | Todo lo que no es JSX ni estilos                                               | `react-dom`, `react-native`, `react-bootstrap`, `document`, `window`, `localStorage`, JSX |
| `packages/ui-tokens`| Colores, tipografia, espaciado y textos comunes                                | Componentes                                                       |
| `supabase/`         | Esquema versionado, politicas RLS, funciones, Edge Functions                   | Nada que solo exista en la nube y no en un archivo                |

Las dos apps implementan **el mismo catalogo de componentes con las mismas props** (`FilterBar`,
`DataList`, `TextField`, `StatusChip`, `Modal`, `KanbanBoard`, `Tabs`, ...), de modo que portar
una pantalla de web a movil sea mecanico: cambia el import, no la logica.

---

## 4. Como se descompone una pantalla

Cada modulo de `packages/shared` sigue el mismo esqueleto. `packages/shared/pacientes/` es el
ejemplar de referencia.

| Archivo               | Responsabilidad                                                              |
| --------------------- | ---------------------------------------------------------------------------- |
| `api.js`              | Las llamadas a Supabase. Es el unico lugar del modulo que habla con la base   |
| `validaciones.js`     | Que datos son validos, y el mensaje exacto cuando no lo son                   |
| `campos.js`           | Descriptores de formulario: id, etiqueta, tipo, opciones, obligatoriedad      |
| `columnas.js`         | Columnas de tabla (web) y campos de tarjeta (movil), del mismo descriptor     |
| `filtros.js`          | Definicion de los filtros y su estado vacio                                   |
| `permisos.js`         | Que roles pueden que, del lado del cliente (la restriccion real es RLS)       |
| `use<Pantalla>.js`    | Un hook por pantalla: orquesta estado, carga, validacion y guardado           |

El componente de la app recibe eso ya resuelto y solo dibuja:

```jsx
// apps/web - la pantalla no sabe validar, ni consultar, ni decidir permisos
const { valores, errores, guardar, cargando } = useRegistroPaciente(sesion);
return <Formulario campos={CAMPOS_REGISTRO_PACIENTE} valores={valores} errores={errores} />;
```

---

## 5. Recorrido de una peticion

Un ejemplo real de punta a punta: **un voluntario toma los signos vitales de un paciente en la jornada**. Desde la issue #840 los
signos no tienen pantalla propia: son el primer paso de la consulta.

```mermaid
sequenceDiagram
    participant V as Voluntario
    participant S as ConsultaScreen<br/>(apps/mobile)
    participant H as useConsulta<br/>(shared/pacientes)
    participant A as triaje.api.js
    participant C as obtenerSupabase<br/>(shared/api)
    participant DB as PostgreSQL

    V->>S: Captura presion, peso, talla
    S->>H: onChange
    H->>H: validarTriaje() + avisosDeSignos()
    Note over H: Si hay error, nunca sale de aqui
    V->>S: Guardar
    S->>H: guardar()
    H->>A: registrarTriaje(datos)
    A->>C: obtenerSupabase()
    C->>DB: INSERT INTO triajes ... (con el JWT de la sesion)
    DB->>DB: RLS 00082 - "medico y voluntario solo el suyo"
    DB->>DB: Columna generada imc = peso / talla^2
    DB->>DB: Trigger actualizar_timestamp_updated_at
    DB-->>A: fila insertada
    A-->>H: resultado normalizado
    H-->>S: guardado = true
    S-->>V: Tarjeta de confirmacion
```

Lo importante de este recorrido son las **dos validaciones distintas**, que no son redundancia:

1. La del cliente (`validarTriaje`) existe para dar un mensaje util antes de gastar una ida al
   servidor.
2. La de la base (RLS + `CHECK` + columnas generadas) existe porque **es la unica que de verdad
   protege**. Un cliente modificado se salta la primera; nunca se salta la segunda.

El calculo del IMC ilustra la misma idea en pequeno: `calcularImc()` existe en el hook para
previsualizarlo mientras se escribe, pero el valor que se guarda es la **columna generada** de la
tabla `triajes`, calculada por Postgres. El cliente no puede mentir sobre el IMC.

---

## 6. Decisiones de arquitectura, y por que

### 6.1 La seguridad vive en la base de datos, no en el cliente

Las **130 politicas RLS** son la frontera real. El cliente esconde botones; la base niega filas.

La postura de partida es **denegacion por defecto** (migracion `00030`): una tabla sin politica no
devuelve nada a nadie. Encima de eso:

- Un perfil desactivado pierde su rol efectivo (`00079`): no basta con quitarle la contrasena.
- No se puede quedar sin administrador activo (`00072` y `00103`), ni desactivarse a si mismo.
- Los roles consultivos (junta directiva, socio fundador) ven agregados, **no filas clinicas**
  (`00054`): la junta directiva puede ver cuantos pacientes se atendieron, no quienes son. Desde la
  `00141` tampoco leen la operacion del dia (jornadas, proyectos, gastos, donaciones).
- "Esta jornada es mia" es estar en su cuadro de turnos **o** ser su responsable
  (`pertenece_a_jornada`, `00141`): antes el responsable de una jornada no la veia.
- El acceso directo por id ajeno esta cerrado (`00082`, IDOR clinico): un medico no registra en la
  consulta de otro medico aunque conozca el UUID.
- `anon` no tiene privilegios (`00049`, `00056`), y el registro publico de cuentas esta cerrado
  (`00074`): las cuentas se crean por invitacion.

Se comprueba con **48 archivos de pruebas pgTAP** (754 pruebas) en `supabase/tests/database/`,
que corren en CI.

La matriz completa esta en [PERMISOS.md](./PERMISOS.md).

### 6.2 Una sola implementacion de la logica, dos presentaciones

La alternativa habitual -escribir la pantalla dos veces, una por plataforma- se descarto porque
duplica tambien las reglas de negocio, y las reglas de negocio duplicadas divergen. El costo es que
`packages/shared` no puede usar nada especifico de plataforma; el beneficio es que una correccion
de validacion se hace una vez.

Los detalles de la frontera estan en [ARQUITECTURA-FRONTEND.md](./ARQUITECTURA-FRONTEND.md).

### 6.3 Las migraciones son la fuente de verdad

Cuando el codigo, la documentacion y la base no coinciden, **manda lo que esta en
`supabase/migrations/`**.

Dos reglas que se hacen cumplir en CI:

- **Una migracion aplicada no se edita nunca.** Supabase la registra en
  `supabase_migrations.schema_migrations` y no vuelve a ejecutarla: editarla cambia lo que valida
  el CI (que aplica todo desde cero) pero no cambia nada en las bases reales. La divergencia
  aparece despues del merge. Se corrige hacia adelante, con una migracion nueva.
- **Una migracion no se aplica a mano.** Nadie corre `supabase db push` desde su maquina contra
  `ecopac-dev` ni `ecopac-prod`. Se mergea el PR y la aplica el workflow.

El numero es de cinco digitos, secuencial, y se **vuelve a verificar antes de mergear**: otra rama
pudo tomarlo mientras tanto. Repetir un numero rompe el despliegue (`version` es clave primaria:
`db push` aborta con SQLSTATE 23505 y no aplica esa migracion ni las siguientes). Detalle completo
en [CI-CD.md](./CI-CD.md).

### 6.4 Sin `pg_cron`: el reloj esta en GitHub Actions

El proyecto esta en el plan gratuito de Supabase, que no incluye `pg_cron`. Las rutinas
programadas se disparan desde workflows (`.github/workflows/alertas-vencimiento.yml`), que llaman a
una Edge Function autenticada con la llave de servicio.

La logica de la rutina **no vive en la Edge Function**: vive en SQL (`fn_generar_alertas_caducidad`,
migracion `00088`). La funcion es un envoltorio delgado. Asi la rutina es comprobable con pgTAP y
no depende del disparador.

Lo que tiene que pasar **en el momento** y no una vez al dia -avisar a la administracion de un
movimiento por validar, un gasto por aprobar o un medicamento sin stock- no usa GitHub Actions:
un trigger escribe la fila en `notificaciones` y `pg_net` (incluido en el plan gratuito) llama a la
Edge Function `enviar-notificaciones`, que manda el correo por un proveedor SMTP propio (`00138`,
issue #755). Otra vez, la decision de que se notifica vive en SQL; la funcion solo entrega.

### 6.5 JavaScript, no TypeScript

El paquete compartido fue TypeScript y dejo de serlo (issue #493). El tipado se conserva donde
importa -`packages/shared/types/index.js` y los `Object.freeze` de `enums.js` y `roles.js`, que
hacen que un editor autocomplete los valores- sin pagar el costo de dos toolchains distintas
resolviendo extensiones de archivo de forma distinta (Vite y Metro no resuelven igual el cambio de
`.js` a `.ts`, que fue el bug #390).

### 6.6 Los nombres de columna son una decision, no un accidente

Convencion unificada en el issue #412:

- El **actor** de una accion lleva sufijo `_por`: `registrado_por`, `aprobado_por`, `atendida_por`,
  `anulada_por`, `tomado_por`, `realizado_por`.
- Su **marca de tiempo** usa la misma raiz con sufijo `_en`, nunca el prefijo `fecha_`:
  `aprobado_en`, `atendida_en`, `anulada_en`, `tomado_en`.
- La **persona responsable de una entidad completa** (no de una accion puntual) es
  `responsable_id`.

Cuando dos columnas parecen el mismo concepto pero nombran cosas distintas, no se fuerza un nombre
unico: se deja la diferencia y se documenta con `COMMENT ON` en la migracion. Los dos casos
existentes son `tipo_proveedor` / `origen_lote` (`00090`) y `pacientes.telefono_contacto`
(`00093`).

### 6.7 Los errores pasan por un solo punto, y sin datos de paciente

Todo error que la aplicacion no puede resolver pasa por `reportarError`
(`packages/shared/observabilidad/errores.js`), que quita UUID, DPI, telefonos, correos y tokens
antes de mandarlo a ningun sitio. Las dos apps enganchan ahi lo que solo ellas ven -un limite de
error de React alrededor de las pantallas y el manejador global de errores de cada plataforma-, y
las dos muestran un aviso cuando se pierde la red. Conectar una herramienta de monitoreo es cambiar
el destino con `configurarDestinoDeErrores`, no recorrer cada `catch`.

La regla que lo motiva es la de `AGENTS.md` aplicada a la observabilidad: **algo que no funciona no
puede verse igual que algo que si**. Por eso un error se pinta en la pantalla que lo provoco, nunca
se sustituye por una lista vacia, y nunca se reporta en un dialogo que se cierra y no deja rastro.
Estado y lo que falta: [SEGURIDAD.md, "Observabilidad"](./SEGURIDAD.md).

---

## 7. Que hay construido hoy

Estado sobre `develop`, 24 de septiembre de 2026. El esquema se cuenta en el catalogo de Postgres
despues de un `supabase db reset`, no contando archivos (ver [MODELO-DE-DATOS.md](./MODELO-DE-DATOS.md)).

| Area                       | Tamano                                                                  |
| -------------------------- | ----------------------------------------------------------------------- |
| Migraciones                | 139 archivos, numerados hasta la `00147`                                |
| Esquema                    | 49 tablas, 23 enums, 76 funciones, 7 vistas, 130 politicas RLS, 68 triggers |
| `packages/shared`          | 20 carpetas (dominio e infraestructura), 419 archivos versionados       |
| `apps/web`                 | 86 paginas, 42 componentes, 35 rutas                                    |
| `apps/mobile`              | 43 pantallas, 40 componentes, 5 tabs (cuatro modulos y Ajustes)         |
| Edge Functions             | 3 (`invitar-usuario`, `alertas-vencimiento`, `enviar-notificaciones`)  |
| Pruebas                    | 240 archivos de prueba (vitest y jest) + 48 de pgTAP (754 pruebas)      |
| Workflows de CI/CD         | 5                                                                       |

Los once modulos del sistema, definidos una sola vez en `packages/shared/navegacion.js`:

| Modulo                | Web | Movil | Quien lo ve                         |
| --------------------- | --- | ----- | ----------------------------------- |
| Inicio                | Si  | Tab   | Todos                               |
| Pacientes             | Si  | Tab   | Administrador, medico, voluntario   |
| Inventario            | Si  | Tab   | Administrador, medico, voluntario   |
| Jornadas              | Si  | Tab   | Administrador, medico, voluntario   |
| Proyectos             | Si  | No    | Administrador y medico (solo los de sus jornadas, sin editar) |
| Donaciones            | Si  | No    | Solo administrador                  |
| Presupuestos          | Si  | No    | Solo administrador                  |
| Colaboradores         | Si  | No    | Solo administrador                  |
| Matriz de permisos    | Si  | No    | Solo administrador                  |
| Bitacora de auditoria | Si  | No    | Solo administrador                  |
| Reportes              | Si  | No    | Administrador y consultivos         |

El reparto por rol es el de la #864: la administradora ve todo, junta directiva y socio fundador
solo reportes, y medico y voluntario la operacion de sus jornadas. La lista de `navegacion.js`
decide que se muestra; lo que cada rol puede leer de verdad lo decide RLS
([PERMISOS.md](./PERMISOS.md)).

Detalle pantalla por pantalla en [MODULOS.md](./MODULOS.md).

> **Nota sobre el estado real.** Las pantallas que mostraban datos de ejemplo como si fueran reales
> (#687, #688, #689) y las piezas que nadie habia conectado (#693) ya estan resueltas. Aun asi, que
> un modulo aparezca aqui significa que existe; antes de asumir que algo funciona de punta a punta,
> revisar las issues abiertas del modulo.

---

## 8. Ambientes y despliegue

| Ambiente             | Rama      | Base de datos    | Frontend             |
| -------------------- | --------- | ---------------- | -------------------- |
| Desarrollo / Staging | `develop` | `ecopac-dev`     | Vercel Preview       |
| Produccion           | `main`    | `ecopac-prod`    | Vercel (main)        |
| Local                | -         | `supabase start` | `npm run dev:web`    |

```mermaid
graph LR
    PR[Pull Request] --> CI[ci.yml<br/>lint, formato, pruebas, build]
    CI --> SB[supabase.yml<br/>migraciones no editadas,<br/>numeracion, db lint, pgTAP]
    SB --> M{Merge a develop}
    M --> APLICA[Aplica migraciones<br/>a ecopac-dev]
    M --> VERCEL[Vercel Preview]
    APLICA --> PROD{Merge a main}
    VERCEL --> PROD
    PROD --> PRODDB[ecopac-prod + Vercel]
```

Las variables de entorno se copian desde `.env.example`. **Nunca se suben llaves reales al
repositorio**, y `packages/shared/entorno/reglas.js` rechaza al arrancar una `service_role` que
aparezca en el bundle del cliente.

**Lo que este diagrama describe y lo que hay hoy no es lo mismo.** `ecopac-prod` esta pausado,
`main` no tiene los secrets de produccion, y el plan Hobby de Vercel no puede conectarse a un
repositorio de una organizacion. Todo eso -y la eleccion entre desplegar por CLI, pagar Vercel Pro o
mover la web- se resuelve en la #252. Los limites y costos de cada servicio estan en
[COSTOS-Y-LIMITES.md](./COSTOS-Y-LIMITES.md).

Que valida cada workflow y que hacer cuando falla: [CI-CD.md](./CI-CD.md).
Nube contra stack local: [SUPABASE.md](./SUPABASE.md).

---

## 9. Mapa de la documentacion

```
Empezar aqui
  ARQUITECTURA.md          <- este documento: vision general y decisiones

Referencia tecnica
  MODELO-DE-DATOS.md       tablas, enums, funciones, vistas, RLS
  MODULOS.md               que pantalla existe, en que app, servida por que hook
  API-SHARED.md            que exporta cada modulo de packages/shared
  ARQUITECTURA-FRONTEND.md la regla de la frontera, en detalle
  PERMISOS.md              matriz de permisos por rol (fuente de verdad de acceso)

Operacion
  QUICKSTART.md            instalar y correr
  CI-CD.md                 workflows, migraciones, despliegue, respaldos y restauracion
  SUPABASE.md              nube contra local
  CONFIGURACION-SUPABASE.md lo que se configura a mano en el Dashboard de cada ambiente
  COSTOS-Y-LIMITES.md      capas gratuitas, que se agota primero, siguiente escalon
  DATOS-DEMO.md            datos de prueba
  DEPENDENCIES.md          politica de versionado

Seguridad
  SEGURIDAD.md             contrasenas, sesion, credenciales, observabilidad
  PROTECCION-DE-DATOS.md   logs, almacenamiento movil, cifrado, secretos

Calidad
  PLAN-DE-PRUEBAS.md       tipos de prueba y criterio de aprobacion
  CASOS-DE-PRUEBA.md       cada caso vinculado a su requerimiento

Proceso y diseno
  CONTRIBUTING.md          ramas, commits, PRs, tablero
  DISENO.md                pantallas, navegacion, paleta
  DISENO-MOVIL.md          criterio de diseno de la app movil
```
