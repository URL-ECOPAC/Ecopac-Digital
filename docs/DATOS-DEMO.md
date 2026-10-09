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
- 72 pacientes ficticios con su expediente: los 12 de siempre, con nombre y telefono, y 60 mas
  (del 101 al 160, apellido "Demo N") que solo existen para el historial clinico del reporte de
  enfermedades.
- 11 condiciones cronicas repartidas entre 9 de esos pacientes (issue #122): cubren las tres
  comunidades y los tres estados de `estado_condicion_cronica`, con un paciente que tiene dos
  condiciones a la vez y otro cuya condicion ya esta `resuelta` - el caso que los listados de
  cronicos excluyen por defecto.
- 2 proyectos sociales (issue #864): "Salud Rural Demo" `en curso` al 45 % y "Nutricion Infantil
  Demo" `planificado` al 10 %. Hasta ahora `proyectos` se quedaba vacia y el modulo se abria sin
  una sola fila para nadie.
- 3 jornadas: una `finalizada` (hace 30 dias), una `en curso` (hoy) y una `planificada` (en 20
  dias, del mismo proyecto que la finalizada: es a donde se puede traspasar su sobrante). Las dos
  primeras **cuelgan de un proyecto distinto cada una**. Es a proposito: desde la `00141` el personal de campo lee solo el proyecto
  de las jornadas a las que pertenece, y con un unico proyecto no se distingue "ve el suyo" de
  "ve todos". Con estos datos, Mario (medico) ve los dos -esta en el cuadro de turnos de una y es
  el responsable de la otra-, Miriam ve solo "Nutricion Infantil Demo", Victor (voluntario) solo
  "Salud Rural Demo", y junta directiva no ve ninguno.
- 7 medicamentos y 4 lotes: uno ya vencido, uno que vence dentro del mes y dos con
  vencimiento lejano - para probar alertas de caducidad y el bloqueo de salida de
  medicamentos vencidos.
- 7 movimientos de inventario cubriendo los tres estados: `pendiente` (poblando la bandeja
  de validacion), `aprobado` y `rechazado`.
- 2 insumos del catalogo (guantes y jeringas), sin principio activo ni concentracion (`00164`).
- 3 donantes y 4 donaciones, una de cada tipo: dinero (para la jornada en curso), medicamentos
  (dos renglones, uno ya ingresado a inventario), insumos y servicios.
- Presupuesto: la jornada en curso suma el aporte de la donacion de dinero, que entra solo al
  insertar la donacion (`00187`: el seed ya no lo inserta aparte); la planificada tiene fondos
  propios. Gastos en los tres estados, uno de preparacion antes de la jornada, y los de la
  jornada finalizada dejan un sobrante para liquidar desde la pestana Cierre.
- Atencion clinica: triaje, consulta con diagnostico y receta en las dos primeras jornadas; en la
  en curso ademas un paciente con triaje esperando consulta y uno recien llegado.
- Equipo e hitos de los dos proyectos, e insumos previstos para la jornada planificada.
- Historial para el reporte de enfermedades (issue #916): 3 jornadas mas, ya `finalizadas`, una por
  comunidad y en meses distintos (hace 150, 95 y 60 dias), con 20 consultas cada una. Cada
  consulta lleva su diagnostico principal y, en parte, dos secundarios (fiebre y anemia). El
  reparto da enfermedades con 5 casos o mas y otras con 1 a 4, que salen con su numero real (issue
  #926), y uno de cada cuatro pacientes no tiene comunidad o es de otra, para que "comunidad de
  la jornada" y "comunidad del paciente" den resultados distintos.

- Areas de atencion, clinicas y agenda de citas (issue #927): las tres areas las siembra la
  `00182`; el seed asigna areas a cuatro pacientes y agrega "Clínica Central Demo" (3 salas) y
  "Puesto de Salud Demo" (1 sala). Cinco citas, una de cada estado: en la jornada en curso, la de
  Sofia (Odontología, 10:30 con Miriam) ya atendida, con su consulta agendada como segunda
  consulta de la visita; dos creadas a las 11:00 (una sin profesional); una cancelada con su
  motivo; y una creada en la jornada planificada, para la agenda del mes que viene. Las citas
  pasan por `fn_validar_cita`: el seed de esta seccion corre con los triggers activos.
  La hora es la de Guatemala sobre `CURRENT_DATE` de la base (UTC), como la fecha de las
  jornadas: despues de las 18:00 de Guatemala la base ya va en el dia siguiente.

Las alertas de vencimiento no se siembran: las genera la rutina programada
(`supabase/functions/alertas-vencimiento`) sobre los lotes de arriba.

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

### Recargar `ecopac-dev` desde cero: `scripts/recargar-datos-demo.sh`

Deja `ecopac-dev` con los datos de este seed y nada mas, **conservando las cuentas del equipo**:

1. Vacia los datos de negocio (pacientes, jornadas, proyectos, donaciones, presupuesto, gastos,
   inventario, notificaciones y auditoria). Conserva cuentas, permisos y catalogos. La lista esta
   en `scripts/recargar-datos-demo/vaciar-datos-de-negocio.sql`.
2. Corre `supabase/seed-demo.sql`.
3. Deja una cuenta de administradora con el correo y la contrasena que se le pasan (si existe, le
   fija la contrasena y el rol; si no, la crea).

Todo en una sola transaccion: si algo falla, la base queda como estaba. Las credenciales llegan
por variables de entorno y no quedan en el repositorio:

```bash
ECOPAC_DB_URL='postgresql://...'        # Project Settings > Database de ecopac-dev
ECOPAC_ADMIN_CORREO='...'
ECOPAC_ADMIN_CLAVE='...'
ECOPAC_CONFIRMAR_VACIADO=si
ECOPAC_REF_PRODUCCION='<ref de ecopac-prod>'  # opcional: si la URL lo contiene, se niega
bash scripts/recargar-datos-demo.sh
```

Necesita `psql`. Los datos de negocio que se borran no vuelven: `ecopac-dev` no tiene respaldos
(plan Free, `docs/CI-CD.md`). **Nunca contra `ecopac-prod`.**

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

Desde la recarga completa ya incluye proyectos, atencion clinica, donaciones, presupuesto y
gastos. Siguen fuera las notificaciones de correo y la configuracion de alertas, que salen de las
migraciones y de la aplicacion.

Las condiciones cronicas si estaban fuera de ese alcance y entraron despues, con la issue #122:
la API expone un listado de pacientes cronicos por comunidad, y sin datos no habia forma de ver
esa pantalla funcionando en local.
