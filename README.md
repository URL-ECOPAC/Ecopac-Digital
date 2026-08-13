# Ecopac Digital

Ecosistema digital para Ecopac Guatemala, ONG dedicada a la ejecucion de jornadas medicas y
dentales gratuitas en comunidades rurales vulnerables de Quetzaltenango. El sistema digitaliza
el registro de pacientes, el control de inventario de medicamentos y la planificacion de
jornadas, reemplazando el proceso actual basado en papel y WhatsApp.

Proyecto desarrollado para el curso de Proyectos de Ingenieria en Informatica y Sistemas,
Universidad Rafael Landivar, Campus de Quetzaltenango.

## Modulos

1. Gestion de Pacientes e Historiales: expediente clinico, triaje, consulta medica y recetas.
2. Gestion de Recursos y Finanzas: inventario, lotes, alertas de vencimiento y donaciones.
3. Gestion de Jornadas y Voluntariado: planificacion con tablero Kanban y asignacion de
   personal.
4. Gestion de Proyectos y Reportes: indicadores de impacto para sostenibilidad y donantes.

## Stack tecnologico

| Componente               | Tecnologia          |
| ------------------------ | ------------------- |
| Web (administracion)     | React + Vite        |
| Movil (campo)            | React Native + Expo |
| Backend / Auth / Storage | Supabase            |
| Base de datos            | PostgreSQL          |
| Hosting web              | Vercel              |
| CI/CD                    | GitHub Actions      |

## Estructura del repositorio

```
apps/
  web/        Aplicacion React + Vite (panel de administracion)
  mobile/     Aplicacion React Native + Expo (operaciones en campo)
packages/
  shared/     Logica de negocio compartida sin JSX (API, validaciones, tipos, hooks)
  ui-tokens/  Diseño tokens: colores, tipografía y textos comunes
supabase/
  migrations/ Esquema de base de datos versionado
  functions/  Rutinas programadas (alertas de vencimiento)
docs/         Documentacion, entregables y contexto para IA
.github/      Plantillas de issues, PR, GitHub Projects y workflows de CI/CD
scripts/      Scripts de soporte del equipo
```

Regla de arquitectura: toda la logica que no es JSX/CSS vive en `packages/shared`. Las apps
`web` y `mobile` solo importan esa logica y la envuelven en componentes visuales.

## Ambientes

| Ambiente             | Rama    | Donde                                  |
| -------------------- | ------- | -------------------------------------- |
| Desarrollo / Staging | develop | Supabase `ecopac-dev` + Vercel Preview |
| Produccion           | main    | Supabase `ecopac-prod` + Vercel (main) |

Las variables de entorno se copian desde `.env.example` a `.env.development` o
`.env.production`. Nunca se suben llaves reales al repositorio.

## Inicio rapido

### Con Docker

```bash
cp .env.example .env.development
npm run docker:dev
```

La web queda en http://localhost:5173. Para produccion: `npm run docker:prod`.

### Sin Docker

```bash
npm install
cp .env.example .env.development
npm run dev:web
```

### App movil

Levanta el servidor de desarrollo de Expo (Metro) en el puerto `8081`:

```bash
npm install
npm run dev:mobile
```

El script `dev:mobile` ejecuta `expo start` en `apps/mobile`. En la terminal se muestran la
URL LAN, el QR y los atajos de teclado (`a` abre Android, `w` abre web, `e` vuelve a mostrar
el QR, `?` muestra todos los atajos).

#### Emulador de Android (Linux o Windows)

1. Instala Android Studio y crea un dispositivo virtual (AVD) en el Device Manager.
2. Abre el emulador.
3. Con `npm run dev:mobile` corriendo, presiona `a` en la terminal para abrir la app en el
   emulador (o `Shift+A` para elegir el dispositivo). Tambien puedes usar el script del
   workspace: `npm run android --workspace=apps/mobile`.

El emulador se conecta al host por `adb reverse`, asi que no necesita abrir el puerto en el
firewall ni conocer la IP LAN.

#### Celular fisico con Expo Go

1. Instala Expo Go desde https://expo.dev/go (Versión SDK 57).
2. Conecta el celular a la misma red WiFi (misma subred) que la computadora.
3. Con `npm run dev:mobile` corriendo, escanea el QR que muestra la terminal (presiona `e`
   para volver a mostrarlo).

El celular accede por la IP LAN de la computadora en el puerto `8081`, por lo que la maquina
debe permitir conexiones entrantes (ver abajo).

#### Habilitar el puerto 8081 en el firewall (solo celular fisico)

Linux (ufw):

```bash
sudo ufw allow 8081/tcp
sudo ufw status
```

Windows (PowerShell como administrador):

```powershell
New-NetFirewallRule -DisplayName 'Expo 8081' -Direction Inbound -LocalPort 8081 `
  -Protocol TCP -Action Allow
```

Si el puerto 8081 ya esta ocupado, liberalo antes de habilitar:

Linux:

```bash
ss -ltnp | grep 8081   # o: lsof -i :8081
kill -9 <PID>
```

Windows (PowerShell):

```powershell
netstat -ano | findstr :8081
taskkill /PID <PID> /F
```

#### Para cambiar el puerto de Expo

Por defecto, Expo usa el puerto `8081`. Para cambiarlo, agrega `--port <puerto>` al script:

```bash
npm run dev:mobile -- --port <puerto>
```

#### Si el celular sigue sin conectar (WiFi aislada o firewall)

Usa el tunnel de Expo, que sirve la app por una URL publica y no requiere abrir puertos:

```bash
npm install -g @expo/ngrok
npm run dev:mobilet
```

El script `dev:mobilet` ejecuta `expo start --tunnel`. Es mas lento que la conexion LAN y
necesita internet en ambos dispositivos. Es tambien la opcion recomendada si usas WSL2 en
Windows, porque el QR mostra la IP de WSL (no accesible desde el celular).

## Estrategia de ramas

```
main (produccion)
  ^ PR aprobado
develop (integracion / staging)
  ^ PR requerida
feature/*, fix/*, chore/* (trabajo)
```

Una rama por issue, PRs hacia `develop` con "Closes #X", merge con squash.

## Documentacion

| Documento                                      | Para que sirve                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| [docs/README.md](./docs/README.md)             | Indice de documentacion                                          |
| [docs/QUICKSTART.md](./docs/QUICKSTART.md)     | Guia de inicio rapido                                            |
| [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) | Guia de contribucion (ramas, commits, PRs, issues)               |
| [AGENTS.md](./AGENTS.md)                       | Contexto del repositorio para asistentes de IA                   |
| [SUPABASE.md](./SUPABASE.md)                   | Como funciona Supabase: nube vs local, y el flujo de migraciones |

## Links utiles

- [GitHub Issues](https://github.com/LisAY22/Ecopac-Digital/issues) - trabajo pendiente
- [GitHub Projects](https://github.com/LisAY22/Ecopac-Digital/projects) - tablero y sprints
