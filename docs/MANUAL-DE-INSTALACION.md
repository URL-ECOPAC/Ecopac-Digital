# Manual de instalación y configuración - Ecopac Digital

Cómo levantar el sistema completo desde cero en un ambiente nuevo, de forma que la organización, o
quien contrate en el futuro, pueda reinstalarlo sin el equipo que lo desarrolló (issue #919). Hay
una versión formal en PDF: [formal/manual-de-instalacion-y-configuracion.pdf](./formal/manual-de-instalacion-y-configuracion.pdf).

| | |
| --- | --- |
| Versión | 1.0 |
| Fecha | 14 de octubre de 2026 |
| Versión del sistema | Rama `main` de `ecopacdigital/Ecopac-Digital`, 181 migraciones (hasta la `00189`) |

**De dónde sale.** Se escribió a partir de lo que efectivamente se hizo el 13 y el 14 de octubre de
2026 para poner el sistema en producción en las cuentas de la organización (issue #252), no de lo
que se había planeado. Cada problema que apareció ese día está en la sección 11, con su causa y su
solución. El registro paso a paso de esa instalación está en
[PLAN-DE-IMPLEMENTACION.md](./PLAN-DE-IMPLEMENTACION.md).

**Ningún valor secreto se escribe aquí.** El manual dice qué se configura, dónde y de dónde sale cada
valor, nunca el valor. Las llaves y contraseñas viven en el gestor de contraseñas de la organización
y en los paneles de cada servicio; no van en el repositorio, en un PR, en una issue, en un chat ni en
una captura.

Este manual ordena en un solo recorrido lo que estaba repartido. El detalle de cada pieza sigue en
su documento:

| Documento | Qué tiene |
| --- | --- |
| [PLAN-DE-IMPLEMENTACION.md](./PLAN-DE-IMPLEMENTACION.md) | El registro de la instalación real y lo que queda pendiente |
| [CONFIGURACION-SUPABASE.md](./CONFIGURACION-SUPABASE.md) | Cada ajuste del Dashboard de Supabase (CFG-01 a CFG-23) con su comprobación |
| [CI-CD.md](./CI-CD.md) | Los workflows, los ambientes y los secrets |
| [QUICKSTART.md](./QUICKSTART.md) | Trabajo en local y las URL de cada ambiente |
| [RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md) | El respaldo a Google Drive y la restauración |

## Contenido

1. [Introducción](#1-introducción)
2. [Requisitos](#2-requisitos)
3. [Cuentas y cómo se conectan](#3-cuentas-y-cómo-se-conectan)
4. [Base de datos: Supabase](#4-base-de-datos-supabase)
5. [Repositorio](#5-repositorio)
6. [CI/CD: workflows y secrets](#6-cicd-workflows-y-secrets)
7. [Web: Vercel](#7-web-vercel)
8. [Aplicación móvil: APK](#8-aplicación-móvil-apk)
9. [Respaldos](#9-respaldos)
10. [Verificación de la instalación](#10-verificación-de-la-instalación)
11. [Problemas comunes](#11-problemas-comunes)
12. [Trabajo en local](#12-trabajo-en-local)
13. [Anexo: instalación actual de la organización](#13-anexo-instalación-actual-de-la-organización)

---

## 1. Introducción

Ecopac Digital digitaliza el registro de pacientes, el inventario de medicamentos y la planificación
de las jornadas médicas y dentales de Ecopac Guatemala.

### 1.1. Qué se instala

| Pieza | Dónde vive | Cómo se despliega |
| --- | --- | --- |
| Web (panel de administración) | Vercel, plan Hobby | Automático: Vercel publica `main` en producción, y `develop` y cada PR como vista previa |
| Base de datos, autenticación y Edge Functions | Supabase, plan Free: un proyecto por ambiente | Automático: `supabase.yml` aplica las migraciones y despliega las funciones en cada push a `develop` o `main` |
| Rutinas programadas | GitHub Actions | Alertas de vencimiento, keep-alive, verificación del despliegue y respaldo, programados desde `main` |
| Aplicación móvil (Android) | APK instalado en los teléfonos del personal | EAS Build, en la cuenta de Expo de la organización |
| Respaldo de la base | Google Drive de la organización, cifrado con GPG | Workflow `respaldo-base.yml`, diario |
| Código fuente | GitHub, repositorio público en la cuenta de la organización | - |

### 1.2. Ambientes

Hay dos, cada uno con su base de datos, su contraseña y sus llaves. Nunca comparten credenciales:
quien tiene las de desarrollo no puede entrar a los datos clínicos reales.

| Ambiente | Rama | Base de datos | Web |
| --- | --- | --- | --- |
| Producción | `main` | Proyecto de Supabase `ecopac-prod` | Dominio de producción de Vercel |
| Desarrollo | `develop` | Proyecto de Supabase `ecopac-dev` | Vista previa de `develop` en Vercel (pide iniciar sesión en Vercel) |

Los valores actuales (proyectos, URL, cuentas) están en la sección 13.

### 1.3. Orden de la instalación

El orden importa: varios pasos necesitan un dato del anterior, y cerrar el registro tiene que ir
antes que todo lo demás para que nadie pueda darse de alta en una base recién creada.

1. Cuentas de la organización y sus conexiones (sección 3).
2. Proyectos de Supabase, registro cerrado y autenticación (secciones 4.1 a 4.4).
3. Repositorio y secrets de GitHub (secciones 5 y 6).
4. Primer despliegue de la base por el workflow, sin tocar nada a mano (sección 4.5).
5. Configuración que depende del esquema: secrets de las funciones y Vault (sección 4.6).
6. Vercel, y con su URL, las direcciones de autenticación (sección 7).
7. Primer administrador, aplicación móvil y respaldo (sección 4.7, 8 y 9).
8. Verificación completa (sección 10).

## 2. Requisitos

### 2.1. Cuentas

Todas a nombre de la organización, con el mismo Gmail, con verificación en dos pasos y con el
teléfono de recuperación de la organización, no el de una persona del equipo técnico.

| Cuenta | Plan | Para qué |
| --- | --- | --- |
| Gmail | Gratuito | Registro de las demás cuentas; remitente de los correos del sistema; Drive de los respaldos; usuario administrador inicial |
| GitHub | Free, **cuenta personal** | Dueña del repositorio, los secrets y los workflows. Tiene que ser una cuenta personal, no una organización de GitHub: Vercel Hobby no se conecta a repositorios de organizaciones |
| Supabase | Free (dos proyectos) | Base de datos, autenticación y Edge Functions de los dos ambientes |
| Vercel | Hobby | Hosting de la web |
| Expo | Gratuito | Compilación del APK y custodia de la llave de firma |
| Google Cloud | Gratuito, con el mismo Gmail | Cliente de OAuth para que el respaldo escriba en Drive |

### 2.2. Herramientas

Solo en la computadora de quien instala o mantiene el sistema.

| Herramienta | Versión | Para qué |
| --- | --- | --- |
| Git | Cualquiera reciente | Clonar el repositorio y trabajar con ramas |
| Node.js y npm | Node **22** (lo fijan `.nvmrc` y `engines`), npm 10 | Dependencias, web, pruebas y herramientas |
| CLI de Supabase | **2.115.0**, la que fija el CI; con `npx supabase` | Stack local, secrets de las funciones. Otra versión puede cambiar los privilegios por defecto de la base (sección 11) |
| Docker Desktop | Cualquiera reciente | Solo para el stack local de Supabase |
| EAS CLI | 16 o superior (se usó la 24.13.0); con `npx eas-cli` | Proyecto de Expo, variables y APK |
| GitHub CLI (`gh`) | Opcional | Cargar secrets y disparar workflows |
| GnuPG y rclone | Solo para preparar el respaldo | Llave de cifrado y credencial de Drive (sección 9) |

## 3. Cuentas y cómo se conectan

En este orden, porque cada una se registra o se conecta con la anterior:

| # | Paso | Cómo |
| --- | --- | --- |
| 1 | Gmail | Crearlo y activar la verificación en dos pasos (myaccount.google.com/security). El teléfono de recuperación es de la organización |
| 2 | Contraseña de aplicación de Gmail | myaccount.google.com/apppasswords. Son 16 letras que Google muestra en cuatro grupos: se usan **sin espacios**. En una cuenta recién creada Google puede bloquear este paso (sección 11) |
| 3 | GitHub | Registrarse con el Gmail y activar la verificación en dos pasos. Cuenta personal: no crear una organización de GitHub |
| 4 | Supabase | Registrarse. Supabase crea una organización propia dentro de la cuenta; ahí van los dos proyectos |
| 5 | Vercel | Registrarse con la cuenta de GitHub del paso 3. En Account Settings > Authentication queda conectada a GitHub |
| 6 | App de Vercel en GitHub | github.com/apps/vercel > Configure > la cuenta de la organización > **Only select repositories** > el repositorio. Sin esto, Vercel responde que el repositorio no existe |
| 7 | Expo | Registrarse con el Gmail. Si se crea un equipo (por ejemplo `ecopacdigitals-team`), ese es el dueño del proyecto de la app |

**Tokens para instalar.** Se guardan en el gestor de contraseñas, nunca en el repositorio, y se
revocan al terminar.

| Token | Dónde se genera | Para qué |
| --- | --- | --- |
| GitHub | Settings > Developer settings > Personal access tokens (classic), permisos `repo` y `workflow` | Crear el repositorio y cargar secrets |
| Supabase | Account > Access tokens | La CLI y el secret `SUPABASE_ACCESS_TOKEN` del CI. El del CI no debe vencer pronto: si vence, deja de desplegar |
| Vercel | Account Settings > Tokens | Configurar el proyecto por la API (opcional) |
| Expo | expo.dev > Account settings > Access tokens | Compilar sin iniciar sesión de forma interactiva (`EXPO_TOKEN`) |

## 4. Base de datos: Supabase

> **La regla que explica esta sección.** El despliegue automático solo aplica migraciones
> (`supabase db push`) y despliega funciones. Nunca aplica `supabase/config.toml`, que gobierna solo
> el stack local. Lo de las secciones 4.2, 4.3, 4.4 y 4.6 se configura a mano en el Dashboard de cada
> proyecto, una vez. Si el Dashboard y `config.toml` no coinciden, gana el Dashboard y nadie se entera.

### 4.1. Crear los proyectos

En la organización de Supabase, plan Free, dos proyectos vacíos:

| Proyecto | Rama que lo despliega | Contraseña de la base |
| --- | --- | --- |
| `ecopac-prod` | `main` | Aleatoria, larga (32 caracteres), solo para este proyecto |
| `ecopac-dev` | `develop` | Aleatoria y **distinta** de la de producción |

La región se elige por cercanía a Guatemala (una de Estados Unidos). Si se pierde una contraseña se
cambia en Project Settings > Database > Reset database password, y se actualiza el secret de GitHub
correspondiente (sección 6).

De cada proyecto se anotan el **ref** (lo que va entre `https://` y `.supabase.co`), la **llave
pública** y la **llave de servicio**, en Project Settings > API Keys.

> **Qué llave es cuál.** Como llave pública se usa la *legacy* `anon` (empieza con `eyJ`). Como
> llave de servicio, la nueva `sb_secret_...`, no la legacy `service_role`: las Edge Functions
> comparan la llave literalmente y responden 401 con la otra. **No se toca** "Disable JWT-based API
> keys": apagaría la llave pública que usan la web y la app.

### 4.2. Cerrar el registro antes que nada

Un proyecto nuevo nace con el registro público **abierto**, y cualquiera con la llave pública (que
viaja en la web) podría darse de alta. Por eso es lo primero:

Authentication > Sign In / Providers > **Allow new users to sign up: desactivado**.

No confundirlo con *Enable email provider*, que queda **activado**: apagarlo deja a toda la
organización sin poder iniciar sesión. Se comprueba con un intento de registro, que tiene que
responder `422 signup_disabled`.

### 4.3. Autenticación

| ID | Ajuste y dónde | Producción | Desarrollo |
| --- | --- | --- | --- |
| CFG-01 | Site URL (Authentication > URL Configuration) | URL de producción de la web | URL de la rama `develop` en Vercel |
| CFG-02 | Redirect URLs (mismo lugar) | `<web>/nueva-contrasena`, `<web>/nueva-contrasena?origen=invitacion` y `ecopac://recuperar`. **Sin comodines** | Las mismas con la URL de dev, más `http://localhost:5173/nueva-contrasena`, su variante `?origen=invitacion` y `exp://*` |
| CFG-03 | Registro (4.2) | Cerrado | Cerrado |
| CFG-04 | Enable email provider | Activado | Activado |
| CFG-05 | Confirm email | Activado | Activado |
| CFG-06 y 07 | Contraseñas (Providers > Email) | Mínimo 8, letras y dígitos | Igual |
| CFG-08 y 09 | Sesiones | JWT 3600 s; rotación activada; reuso 10 s | Igual |
| CFG-10 | Rate limits | 30 / 30 / 150 por 5 minutos (de fábrica) | Igual |
| CFG-11 | Email OTP expiration | 3600 s | Igual |

El Site URL y las Redirect URLs dependen de la URL de Vercel (sección 7). Supabase descarta en
silencio un destino que no esté en la lista y manda a la persona a la raíz, con sesión iniciada y sin
haber elegido contraseña. El diálogo admite una URL por entrada ("+ Add URL"): al terminar, contar
las entradas.

### 4.4. Correo (SMTP)

El correo que trae Supabase solo envía a miembros de su organización. Para el personal hace falta un
SMTP propio: el Gmail de la organización con su contraseña de aplicación. **Son dos canales y se
configuran en dos lugares**; configurar uno no configura el otro.

| Canal | Dónde | Valores |
| --- | --- | --- |
| Recuperación de contraseña (CFG-13) | Authentication > Emails > SMTP Settings > Enable custom SMTP | Host `smtp.gmail.com`, puerto `465`, usuario y remitente el Gmail, nombre "Ecopac Digital", la contraseña de aplicación. Límite: 30 correos por hora |
| Invitaciones y notificaciones (CFG-16) | Secrets de las Edge Functions (4.6) | `SMTP_HOST`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |

**Plantilla de recuperación (CFG-12).** Authentication > Emails > Templates > Reset Password: asunto
"Restablece tu contraseña de Ecopac Digital" y, como cuerpo, `supabase/templates/recovery.html` desde
`<!doctype html>`. En plan Free, Supabase solo deja editar las plantillas **después** de activar el
SMTP propio.

### 4.5. Migraciones y Edge Functions

El esquema, el catálogo geográfico (22 departamentos y 340 municipios), la bodega principal, las
áreas de atención y el administrador inicial llegan por migración, en `supabase/migrations/`. El
repositorio no trae datos de demostración: los dos ambientes nacen limpios.

> **Las migraciones nunca se aplican a mano.** Nadie corre `supabase db push` desde su computadora
> contra `ecopac-prod` ni `ecopac-dev`: las aplica el workflow al hacer push o merge a la rama del
> ambiente. Una migración aplicada a mano antes de mergearse rompe todos los despliegues siguientes
> (sección 11).

Con los secrets de la sección 6 cargados, el primer push a `develop` despliega `ecopac-dev` y el
primero a `main` despliega `ecopac-prod`. El job **Aplicar migraciones** corre todas las migraciones
y despliega las tres Edge Functions (`alertas-vencimiento`, `enviar-notificaciones`,
`invitar-usuario`). Para relanzarlo sin un cambio nuevo: Actions > Supabase > Re-run.

Se comprueba en el Dashboard: Database > Migrations muestra todas, y Edge Functions las tres activas.

### 4.6. Secrets de las funciones y Vault

Después del primer despliegue, en cada proyecto, en Edge Functions > Secrets o con
`npx supabase secrets set NOMBRE=valor --project-ref <ref>`:

| Secret | Valor | Qué se rompe si falta |
| --- | --- | --- |
| `ALLOWED_ORIGINS` | URL de la web del ambiente (en dev, además `http://localhost:5173`), separadas por comas | El navegador bloquea la invitación de usuarios: falla cerrado a propósito |
| `WEB_URL` | URL de la web del ambiente, sin barra final | Los enlaces de los correos no llevan a la web correcta |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | `smtp.gmail.com`, `465`, el Gmail, la contraseña de aplicación, `Ecopac Digital <gmail de la organización>` | No salen invitaciones ni notificaciones por correo; la invitación crea la cuenta igual |
| `AMBIENTE` | `production` o `development` | Nada: etiqueta de los errores en Sentry |
| `SENTRY_DSN` | Opcional | Nada: los errores quedan en el log de la función |

**Vault (CFG-18 y CFG-19).** El trigger que manda los correos de notificación en el momento lee dos
secretos. Una vez por proyecto, en el SQL Editor:

```sql
select vault.create_secret('https://<ref>.supabase.co/functions/v1/enviar-notificaciones', 'notificaciones_url');
select vault.create_secret('<la sb_secret_ del proyecto>', 'notificaciones_llave');
```

El SQL Editor guarda historial: al terminar se borra ese snippet, porque deja la llave a la vista de
los demás miembros. Para comprobar se usa `select name from vault.secrets`, nunca
`vault.decrypted_secrets`.

### 4.7. Primer administrador

La migración `00188` crea la cuenta de administración con el Gmail de la organización, **sin
contraseña**: una contraseña versionada sería una credencial publicada. La `00189` retira una cuenta
anterior que no controlaba la organización, así que la base nace con **un solo usuario**.

La contraseña se fija por uno de dos caminos:

- En la web de producción, "¿Olvidaste tu contraseña?" con el Gmail. Requiere el SMTP de la 4.4.
- En el Dashboard: Authentication > Users > la cuenta > Reset password, o fijando una temporal que
  se cambia en el primer ingreso, desde el perfil.

Desde ahí la administradora crea al resto del personal en la web (Colaboradores); cada persona recibe
un correo de bienvenida para elegir su contraseña.

## 5. Repositorio

| Ajuste | Valor y por qué |
| --- | --- |
| Visibilidad | **Público.** En privado, Vercel Hobby bloquea el despliegue de cualquier commit cuyo autor no sea el dueño de la cuenta, y GitHub Free no da protección de ramas. Los secrets no son visibles en ningún caso, y quien protege los datos es RLS |
| Ramas | `main` (producción) y `develop` (integración). `main` es la rama por defecto: GitHub solo programa los crons desde ella, y Vercel toma la rama por defecto como producción al importar |
| Merge | Squash para los PR de trabajo hacia `develop`; merge commit para `develop` hacia `main`, para que las dos ramas no se separen |
| Borrar ramas al mergear | Activado. Por eso `develop` y `main` tienen que estar protegidas: GitHub no borra ramas protegidas |
| Protección de `main` y `develop` | PR con una aprobación; checks requeridos `Lint y build`, `Migraciones no editadas` y `Validar migraciones y funciones`, con la rama al día; sin force-push ni borrado; conversaciones resueltas |
| Etiquetas | `type:*`, `module:*`, `priority:*`, `platform:*`: los workflows las usan al abrir issues de fallo |
| Colaboradores | Con escritura. En una cuenta personal, **solo la dueña puede cargar secrets** |

## 6. CI/CD: workflows y secrets

### 6.1. Los seis workflows

| Workflow | Cuándo corre | Qué hace |
| --- | --- | --- |
| CI (`ci.yml`) | PR y push a `develop` y `main` | Auditoría de dependencias, guardas del esquema, lint, formato, pruebas y build de la web |
| Supabase (`supabase.yml`) | PR y push a `develop` y `main` | Valida las migraciones desde cero con todas las pruebas de base de datos y, en push, las aplica al ambiente de la rama y despliega las funciones |
| Alertas de vencimiento | Diario, 06:00 UTC (00:00 en Guatemala) | Genera las alertas de lotes por vencer en los dos ambientes y reintenta los correos pendientes |
| Respaldo de la base | Diario, 07:00 UTC | Respaldo cifrado de producción a Google Drive (sección 9) |
| Verificar despliegue | Diario, 13:00 UTC | Comprueba que cada base tenga todas las migraciones de su rama; abre una issue si no |
| Mantener Supabase activo | Cada 3 días, 12:00 UTC | Una consulta a cada ambiente para que el plan Free no los pause |

Los programados solo corren desde `main`, y GitHub los desactiva tras 60 días sin actividad en el
repositorio. Cada uno se puede disparar en Actions > el workflow > Run workflow.

### 6.2. Los diecisiete secrets

En Settings > Secrets and variables > Actions. `gh secret set NOMBRE` pide el valor por teclado y no
lo deja en el historial de la terminal.

| Secret | De dónde se saca | Qué se rompe si falta |
| --- | --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase > Account > Access tokens | No se aplican migraciones ni funciones en ningún ambiente |
| `SUPABASE_PROJECT_REF_PROD`, `_DEV` | El ref de cada proyecto | Ese ambiente no se despliega (avisa y termina en verde) |
| `SUPABASE_DB_PASSWORD_PROD`, `_DEV` | Las contraseñas de la 4.1 | Falla la conexión: no se despliega |
| `SUPABASE_URL_PROD`, `_DEV` | `https://<ref>.supabase.co`, sin barra final | Alertas y keep-alive omiten ese ambiente: no hay alertas y se puede pausar |
| `SUPABASE_SERVICE_ROLE_KEY_PROD`, `_DEV` | Project Settings > API Keys > la `sb_secret_` | Igual que la fila anterior |
| `VITE_SUPABASE_URL_PROD`, `_DEV` | Igual que `SUPABASE_URL_*` | El build del CI sale sin configuración; no afecta a Vercel |
| `VITE_SUPABASE_ANON_KEY_PROD`, `_DEV` | La llave pública legacy `anon` | Igual que la fila anterior |
| `RESPALDO_GPG_CLAVE_PUBLICA` | Llave pública GPG (sección 9) | El respaldo falla en rojo y abre una issue |
| `RESPALDO_DRIVE_CLIENT_ID`, `_CLIENT_SECRET` | Cliente de OAuth de Google Cloud | Igual |
| `RESPALDO_DRIVE_TOKEN` | Token de rclone de la cuenta de Drive | Igual |

Salvo el respaldo, un secret que falta **no pone el workflow en rojo**: deja una advertencia en el
resumen de la corrida. Por eso, después de cargarlos, se revisa el resumen de cada workflow.

## 7. Web: Vercel

Con la app de Vercel instalada sobre el repositorio (sección 3), Vercel > Add New > Project >
importar el repositorio:

| Ajuste | Valor |
| --- | --- |
| Root Directory | `apps/web` |
| Framework | Vite (lo detecta) |
| Node.js Version (Settings > Build) | **22.x** |
| Production Branch (Settings > Environments) | **`main`**. Revisarlo: al importar, Vercel toma la rama por defecto de GitHub |
| Variables, Production | `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` de `ecopac-prod`; `VITE_SENTRY_DSN` si hay Sentry |
| Variables, Preview | Las mismas, de `ecopac-dev` |

Las variables `VITE_*` se incrustan al compilar: si se cambia una, hay que redesplegar. El primer
despliegue que hace Vercel al importar sale sin variables; se redespliega después de cargarlas.

`apps/web/vercel.json` ya trae el reenvío de rutas (sin él, recargar una página interna da 404) y las
seis cabeceras de seguridad.

**Dominio.** Producción queda en `<proyecto>.vercel.app`, con HTTPS automático. Para un dominio
propio: Settings > Domains > agregarlo y configurar el DNS que indique Vercel; después se actualizan
con él el Site URL y las Redirect URLs (4.3) y `WEB_URL` y `ALLOWED_ORIGINS` (4.6). Si no coinciden,
los correos apuntan a otro sitio.

Las URL de vista previa (la de `develop` y la de cada PR) quedan detrás del inicio de sesión de
Vercel. La de producción es pública.

## 8. Aplicación móvil: APK

Play Store cuesta 25 USD y App Store 99 USD al año. Sin ese presupuesto, la app Android se reparte
como **APK instalado directamente**. iOS queda fuera: sin cuenta de desarrollador de Apple no se
puede instalar fuera de la tienda.

| Archivo | Qué define |
| --- | --- |
| `apps/mobile/eas.json` | Dos perfiles, los dos en APK: `desarrollo` (ambiente `preview` de EAS, contra `ecopac-dev`) y `produccion` (ambiente `production`, contra `ecopac-prod`). La versión se lleva en EAS y sube sola en cada build de producción |
| `apps/mobile/app.config.js` | El dueño en Expo (`owner`), el id del proyecto de EAS (`extra.eas.projectId`) y el identificador `org.ecopacguatemala.digital`, que **no se cambia nunca**: Android lo trataría como otra app |

**Preparar Expo (una vez)**, desde `apps/mobile`, después de `npm ci` en la raíz:

```bash
npx eas-cli login          # o la variable EXPO_TOKEN con un token de la cuenta
npx eas-cli init           # solo si se crea un proyecto de Expo nuevo
```

`eas init` no puede escribir en `app.config.js` porque es JavaScript: imprime el `projectId` y hay
que copiarlo a mano, junto con `owner`, en un PR.

Variables por ambiente (valores públicos, pero no se versionan):

```bash
npx eas-cli env:create --scope project --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref-prod>.supabase.co --visibility plaintext
npx eas-cli env:create --scope project --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon de prod> --visibility plaintext
npx eas-cli env:create --scope project --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref-dev>.supabase.co --visibility plaintext
npx eas-cli env:create --scope project --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon de dev> --visibility plaintext
```

**Compilar:**

```bash
npx eas-cli build --platform android --profile produccion
```

Compila en los servidores de Expo (plan gratuito: unas 30 compilaciones al mes, con cola; la primera
tardó unos 15 minutos) y da un enlace de descarga del `.apk`. La primera vez EAS genera la **llave de
firma** y la guarda en la cuenta de Expo; todas las versiones se firman con ella, y por eso una
actualización se instala encima. Si se perdiera, la app ya no se podría actualizar sin desinstalarla:
se respalda con `npx eas-cli credentials`. Si se agota la cuota,
`npx eas-cli build --platform android --profile produccion --local` compila en la propia computadora
(Android SDK y JDK 17).

**Instalar en los teléfonos:**

1. Descargar el `.apk` y guardarlo en una carpeta del Drive de la organización, con la versión en el
   nombre. El enlace de EAS caduca; la copia que vale es la de Drive.
2. En cada teléfono, abrir el enlace de Drive, descargar y aceptar "Instalar apps de fuentes
   desconocidas" cuando Android lo pida.
3. Abrir la app e iniciar sesión con la cuenta de la persona.

Para actualizar: una compilación nueva con el mismo perfil, subirla a la misma carpeta y avisar. Se
instala encima y conserva la sesión.

## 9. Respaldos

El plan Free de Supabase **no incluye respaldos**. `respaldo-base.yml` respalda producción todos los
días: saca un volcado, lo cifra con la llave pública GPG de la organización antes de que salga del
servidor de GitHub y lo sube a la carpeta `respaldos-ecopac-digital` del Drive de la organización.
Conserva los 30 más recientes. **Producción no recibe datos reales hasta tener un respaldo restaurado
con éxito.** El detalle está en [RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md).

| # | Paso | Cómo |
| --- | --- | --- |
| 1 | Par de llaves GPG | `gpg --quick-generate-key "Respaldos Ecopac Digital <gmail>" rsa4096 encr never`, y exportar la pública y la privada (`gpg --armor --export` y `--export-secret-keys`). La privada se guarda en dos lugares seguros, con su frase de paso aparte; la pública va a GitHub |
| 2 | Cliente de OAuth de Google | console.cloud.google.com con el Gmail: proyecto nuevo, Google Drive API habilitada, consentimiento Externo con el permiso `drive.file`, **publicado** (en modo prueba la credencial caduca a los 7 días), y un ID de cliente "App de escritorio" |
| 3 | Token de Drive | `rclone config create respaldo-ecopac drive client_id=<id> client_secret=<secreto> scope=drive.file`, autorizar en el navegador, y `rclone config show respaldo-ecopac`: el JSON de `token` es el secret. Después, `rclone config delete respaldo-ecopac` |
| 4 | Secrets de GitHub | `RESPALDO_GPG_CLAVE_PUBLICA`, `RESPALDO_DRIVE_CLIENT_ID`, `RESPALDO_DRIVE_CLIENT_SECRET` y `RESPALDO_DRIVE_TOKEN`. Los carga la dueña de la cuenta de GitHub |
| 5 | Activar y probar | Actions > Respaldo de la base > Enable workflow (si estaba desactivado) > Run workflow. Termina en verde y aparece el archivo en Drive. La carpeta la crea el workflow |
| 6 | Primera restauración | Bajar ese respaldo, descifrarlo y restaurarlo en el stack local según [RESPALDO-Y-RECUPERACION.md](./RESPALDO-Y-RECUPERACION.md), sección 5, y anotarlo en su registro |

Mientras falten los secrets, el workflow falla en rojo y abre una issue cada día, a propósito. Si se
instala el resto antes, se desactiva (Disable workflow) hasta tenerlos. Así quedó la instalación de
octubre de 2026: el respaldo se termina en la issue #914.

## 10. Verificación de la instalación

Las primeras se hacen sin datos; las del final, con datos ficticios marcados como prueba (por
ejemplo, nombres con el prefijo `PRUEBA`), que se borran al terminar.

| Qué | Cómo | Resultado esperado |
| --- | --- | --- |
| Registro cerrado | `POST /auth/v1/signup` con la llave pública | `422 signup_disabled` |
| Base al día | Actions > Verificar despliegue > Run workflow | Los dos ambientes "Al día" |
| Funciones | Edge Functions en el Dashboard | Las tres activas |
| Un solo usuario | Authentication > Users | Solo la cuenta de administración de la organización |
| Web de producción | Abrir la URL y recargar `/pacientes` | Carga el inicio de sesión; la ruta interna no da 404 |
| HTTPS | Abrir la URL con `http://` | Redirige a `https://` |
| Cabeceras | Herramientas del navegador > Red | HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| Crons | Run workflow en Alertas de vencimiento y Mantener Supabase activo | Las dos filas (prod y dev) en verde |
| Notificaciones | Prueba de Vault de [CONFIGURACION-SUPABASE.md](./CONFIGURACION-SUPABASE.md) (CFG-19) | `200`, con `"correo": "enviado"` |
| Recuperación | "¿Olvidaste tu contraseña?" en la web | Llega con la plantilla de Ecopac y abre `/nueva-contrasena` |
| Invitación | Crear una cuenta de prueba en Colaboradores | Llega el correo de **bienvenida** y lleva a `/nueva-contrasena?origen=invitacion` |
| Permisos | Iniciar sesión con una cuenta de prueba de cada rol | Cada rol ve solo sus módulos; uno ajeno muestra "Acceso restringido" |
| Jornada | Jornada, paciente, triaje, consulta, receta y entrega | Se completa y el inventario descuenta lo entregado |
| Inventario | Un ingreso con su aprobación | Pendiente hasta que la administración lo aprueba |
| App móvil | APK de producción en un teléfono Android | Entra y muestra los datos de producción |
| Respaldo | Sección 9, pasos 5 y 6 | Archivo en Drive y restauración comprobada |

Al terminar se borran los datos y las cuentas de prueba, y se cambia la contraseña temporal de la
administración si se usó una.

## 11. Problemas comunes

| Síntoma | Causa | Solución |
| --- | --- | --- |
| Despliegues de Vercel en `BLOCKED`: "the commit author doesn't have permission" | Repositorio privado en Vercel Hobby: solo despliegan los commits del dueño | Repositorio público (sección 5) o Vercel Pro |
| Vercel publica `develop` como producción | Al importar tomó la rama por defecto de GitHub | Production Branch = `main`, y `main` por defecto en GitHub |
| La web abre con un error de configuración de Supabase | Faltan las `VITE_*` del entorno, o se cargaron sin redesplegar | Cargarlas y redesplegar |
| Vercel dice que el repositorio no existe | La app de Vercel no está instalada sobre el repositorio | Sección 3, paso 6 |
| Google responde "No pudimos verificar tu identidad" al crear la contraseña de aplicación | Verificación de cuentas recién creadas o endurecidas | Entrar desde el dispositivo y la red donde se creó la cuenta; si no, esperar unos días sin reintentar |
| Gmail rechaza la contraseña de aplicación | Se copió con espacios | Las 16 letras sin espacios |
| No se puede editar la plantilla de correo | Plan Free sin SMTP propio | Activar el SMTP primero (4.4) |
| La invitación manda el correo de restablecimiento | Falta `SMTP_HOST`, `SMTP_FROM` o `WEB_URL` en las funciones | Completar la 4.6 |
| Las funciones no logran enviar correo | `SMTP_PORT` en 587: las Edge Functions bloquean 25 y 587 | `SMTP_PORT=465` |
| Alertas o notificaciones dan 401 | Se usó la legacy `service_role` | La `sb_secret_`, en GitHub y en Vault |
| Invitar desde la web falla por conexión | Falta `ALLOWED_ORIGINS` o no incluye la URL de la web | Sección 4.6 |
| El enlace del correo lleva a la raíz y no pide contraseña | El destino no está en las Redirect URLs | 4.3, CFG-02, con la variante `?origen=invitacion` |
| "Remote migration versions not found" | Una migración aplicada a mano antes de mergearse | Mergear el PR que la trae; si se descartó, `supabase migration repair --status reverted <versión>` |
| Número de migración duplicado | Dos ramas tomaron el mismo número | Renumerar por encima del último de `develop` |
| Los crons no corren | No están en `main`, o GitHub los desactivó tras 60 días | Llevar el cambio a `main`; reactivarlos en Actions |
| Proyecto de Supabase pausado | Siete días sin actividad en Free | Restore project; revisar el keep-alive y sus secrets |
| Desapareció `develop` | "Borrar ramas al mergear" con `develop` sin proteger | Recrearla en el mismo commit y protegerla |
| Pruebas de permisos fallan en local y no en el CI | Otra versión de la CLI de Supabase | Usar la 2.115.0 |
| Un colaborador no puede cargar secrets | En una cuenta personal solo la dueña puede | Que los cargue quien maneja la cuenta de la organización |
| El APK no se instala encima del anterior | Cambió el identificador del paquete o la llave de firma | No cambiar ninguno de los dos (sección 8) |

## 12. Trabajo en local

```bash
git clone https://github.com/ecopacdigital/Ecopac-Digital.git
cd Ecopac-Digital
npm ci
cp .env.example .env.development     # URL y llave publica de ecopac-dev
npm run dev:web                      # web en http://localhost:5173
npm run dev:mobile                   # Expo, para abrir la app con Expo Go
```

Con Docker, el stack local reproduce lo que valida el CI, con datos ficticios que solo existen ahí
(`supabase/fixtures/datos-de-prueba.sql`, ver [DATOS-DE-PRUEBA.md](./DATOS-DE-PRUEBA.md)):

```bash
npx supabase start
npx supabase db reset       # migraciones y datos de prueba
npx supabase test db        # pruebas de permisos y de la base
npm run test:e2e            # flujos criticos contra la base local
npm test                    # pruebas unitarias y de pantallas
```

`.env.development` está excluido del repositorio. Solo lleva la URL y la llave pública: la llave de
servicio nunca va en un `.env`, y la aplicación la rechaza si se pone por error.

## 13. Anexo: instalación actual de la organización

Los valores con los que quedó instalado el sistema el 14 de octubre de 2026. Ninguno es secreto; las
credenciales están en el gestor de contraseñas de la organización.

| Elemento | Producción | Desarrollo |
| --- | --- | --- |
| Rama | `main` | `develop` |
| Proyecto de Supabase | `ecopacdigital Prod`, ref `vuujluoxlkiakfstiiur`, región `us-east-2` | `ecopacdigital Dev`, ref `swwtjekapvnkjzshzdjk`, región `us-west-2` |
| URL de Supabase | `https://vuujluoxlkiakfstiiur.supabase.co` | `https://swwtjekapvnkjzshzdjk.supabase.co` |
| Web | https://ecopac-digital.vercel.app | https://ecopac-digital-git-develop-ecopacdigital.vercel.app |
| Perfil del APK | `produccion` | `desarrollo` |

| Cuenta o recurso | Valor |
| --- | --- |
| Gmail de la organización | `ecopac.digital@gmail.com` (también es la cuenta de administración del sistema) |
| Repositorio | `github.com/ecopacdigital/Ecopac-Digital`, público |
| Vercel | Proyecto `ecopac-digital` en la cuenta Hobby de la organización |
| Expo | Equipo `ecopacdigitals-team`, proyecto `ecopac-digital`, id `a47ad811-6f01-43cb-be59-b10617b994e1` |
| Identificador de la app | `org.ecopacguatemala.digital` |
| Carpeta de respaldos | `respaldos-ecopac-digital` en el Drive de la organización (la crea el primer respaldo) |
| Correo del sistema | SMTP de Gmail, `smtp.gmail.com:465`, con contraseña de aplicación |
