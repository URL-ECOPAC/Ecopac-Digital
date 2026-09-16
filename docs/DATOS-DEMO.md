# Datos de demostracion - Ecopac Digital

Que trae `supabase/seed-demo.sql`, como cargarlo y las credenciales de desarrollo.
Complementa a [SUPABASE.md](./SUPABASE.md) (nube vs local) y a
[QUICKSTART.md](./QUICKSTART.md) (inicio rapido).

**Todos los datos son inventados.** Ningun nombre, telefono, DPI, comunidad ni credencial de
este seed corresponde a una persona o lugar real (regla de confidencialidad de
[AGENTS.md](../AGENTS.md)).

## Que trae

- Un usuario por rol (`administrador`, `junta directiva`, `socio fundador`, dos `medico`, dos
  `voluntario general`).
- 3 comunidades ficticias.
- 12 pacientes ficticios con su expediente.
- 11 condiciones cronicas repartidas entre 9 de esos pacientes (issue #122): cubren las tres
  comunidades y los tres estados de `estado_condicion_cronica`, con un paciente que tiene dos
  condiciones a la vez y otro cuya condicion ya esta `resuelta` - el caso que los listados de
  cronicos excluyen por defecto.
- 2 jornadas: una `finalizada` (hace 30 dias) y una `en curso` (hoy).
- 7 medicamentos y 4 lotes: uno ya vencido, uno que vence dentro del mes y dos con
  vencimiento lejano - para probar alertas de caducidad y el bloqueo de salida de
  medicamentos vencidos.
- 7 movimientos de inventario cubriendo los tres estados: `pendiente` (poblando la bandeja
  de validacion), `aprobado` y `rechazado`.

## Credenciales (SOLO DESARROLLO)

Mismo password para las siete cuentas. **Nunca reutilizar este password en ningun sistema
real.**

| Rol                 | Email                        | Password         |
| -------------------- | ---------------------------- | ----------------- |
| Administrador         | `admin.demo@ecopac.test`      | `EcopacDemo#2026` |
| Junta directiva       | `junta.demo@ecopac.test`      | `EcopacDemo#2026` |
| Socio fundador        | `socio.demo@ecopac.test`      | `EcopacDemo#2026` |
| Medico (1)             | `medico.demo@ecopac.test`     | `EcopacDemo#2026` |
| Medico (2)             | `medico2.demo@ecopac.test`    | `EcopacDemo#2026` |
| Voluntario general (1) | `voluntario.demo@ecopac.test` | `EcopacDemo#2026` |
| Voluntario general (2) | `voluntario2.demo@ecopac.test`| `EcopacDemo#2026` |

## Como cargarlo

### Local (automatico)

`supabase db reset` (y por lo tanto `supabase start` la primera vez) ya aplica
`supabase/seed-demo.sql` despues de las migraciones, configurado en `supabase/config.toml`
(`[db.seed].sql_paths`). No hace falta ningun paso extra: levantar el stack local ya deja la base
con estos datos.

El seed es idempotente: correr `supabase db reset` de nuevo no duplica filas ni falla.

### El catalogo geografico ya no es un seed (issue #704)

`supabase/seed.sql` cargaba los 22 departamentos y los 340 municipios de Guatemala. **Desde la
migracion `00125` no carga nada**: el archivo quedo con comentarios que explican el cambio, y el
catalogo se siembra como parte de las migraciones.

El motivo es el que hace que este documento exista: `supabase db push` -lo unico que corre contra
`ecopac-dev` y `ecopac-prod`- **nunca ejecuta seeds**. Los datos de demostracion pueden vivir en un
seed porque son opcionales y solo de desarrollo; el catalogo geografico no, porque **sin municipios
no hay comunidades y sin comunidades no se puede crear una jornada**. Un proyecto de Supabase nuevo
nacia sin ese catalogo y sin forma de cargarlo desde la aplicacion.

Las tres comunidades de `seed-demo.sql` siguen colgando de los municipios 106, 401 y 1601, que
ahora llegan por migracion, asi que el seed de demostracion no cambio.

### `ecopac-dev` (manual, una sola vez, con criterio del equipo)

`supabase db push` (lo que aplica el CI/CD en push a `develop`) **nunca ejecuta seeds**, solo
migraciones - por diseno, ver [CI-CD.md](./CI-CD.md). Cargar estos datos en el proyecto
`Ecopac-Digital-Dev` es una decision manual y explicita de quien administra el proyecto:

```bash
supabase link --project-ref <ref-de-ecopac-dev>
supabase db push --include-seed
```

o, sin depender de esa bandera, conectando directo con `psql` a la base de `ecopac-dev` (URL
en el dashboard, Project Settings > Database) y corriendo `supabase/seed-demo.sql`.

### `ecopac-prod`

**NUNCA.** Este archivo no debe ejecutarse jamas contra `Ecopac-Digital-Prod`. No existe
ningun comando de este repositorio que lo intente: el job que aplica migraciones en `main`
(`.github/workflows/supabase.yml`) solo corre `supabase db push`, sin seeds.

## Fuera de alcance de este seed

No incluye `proyectos`, `atenciones`/`consultas`/`recetas` ni `donantes`/`donaciones`: no estan
en el alcance del issue #94. Se puede ampliar en un seed posterior si el equipo lo necesita.

Las condiciones cronicas si estaban fuera de ese alcance y entraron despues, con la issue #122:
la API expone un listado de pacientes cronicos por comunidad, y sin datos no habia forma de ver
esa pantalla funcionando en local.
