# Datos de prueba - Ecopac Digital

Que trae `supabase/fixtures/datos-de-prueba.sql`, donde se carga y las credenciales de las cuentas
de prueba. Complementa a [SUPABASE.md](./SUPABASE.md) (nube vs local) y a
[QUICKSTART.md](./QUICKSTART.md) (inicio rapido).

**Todos los datos son inventados.** Ningun nombre, telefono, DPI, comunidad ni credencial de
este archivo corresponde a una persona o lugar real (regla de confidencialidad de
[AGENTS.md](../AGENTS.md)).

**Es un fixture de prueba, no un seed de ningun ambiente** (issue #252). Nacio como
`supabase/seed-demo.sql` (issue #94); al pasar el repositorio a la cuenta de la organizacion se
retiraron los seeds y los scripts que cargaban datos de demostracion en `ecopac-dev`, porque los
dos ambientes de la organizacion arrancan **limpios**. Este archivo se conservo porque lo necesitan
las suites pgTAP y las pruebas de flujos criticos, y solo se carga en el stack local desechable.

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

## Credenciales (SOLO STACK LOCAL)

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

## Donde se carga

| Donde | Se carga | Como |
| --- | --- | --- |
| Stack local (`supabase start`) | Si | `supabase db reset` lo aplica despues de las migraciones (`supabase/config.toml`, `[db.seed].sql_paths`) |
| Job "Validar migraciones y funciones" del CI | Si | El mismo `supabase db reset`, sobre un stack desechable |
| `ecopac-dev` | **No** | `supabase db push` nunca ejecuta seeds |
| `ecopac-prod` | **No, nunca** | Idem. Produccion recibe datos reales desde el primer dia |

Es idempotente: correr `supabase db reset` de nuevo no duplica filas ni falla.

Lo que un ambiente remoto necesita para funcionar **no** depende de este archivo, llega por
migracion: el catalogo geografico (`00125`), la bodega principal (`00017`), las areas de atencion
(`00182`) y el primer administrador (`00188`). Por eso `ecopac-dev` y `ecopac-prod` pueden nacer
limpios y aun asi se puede crear la primera jornada.

### El catalogo geografico ya no es un seed (issue #704)

`supabase/seed.sql` cargaba los 22 departamentos y los 340 municipios de Guatemala. Desde la
migracion `00125` el catalogo se siembra como parte de las migraciones, porque `supabase db push`
**nunca ejecuta seeds**: sin municipios no hay comunidades y sin comunidades no se puede crear una
jornada. Las tres comunidades de este fixture cuelgan de los municipios 106, 401 y 1601, que
llegan por esa migracion.

### Quien depende de este archivo

- Las pruebas de flujos criticos (`pruebas/e2e/`) inician sesion con las siete cuentas de arriba
  y usan los ids fijos de pacientes, jornadas y lotes (`pruebas/e2e/datos.js`).
- Varias suites pgTAP reutilizan sus filas: `tokens_auth_users.sql`,
  `desacoplar_gastos_de_inventario.sql`, `politicas_rls_atenciones_consultas_recetas.sql`,
  `impedir_borrar_ultimo_administrador.sql`, `busqueda_pacientes.sql`, entre otras.
- `scripts/prueba-de-carga-jornada-50-pacientes.mjs`.

Si se quita o se cambia una fila, hay que correr `supabase test db` y `npm run test:e2e` contra
el stack local antes de abrir el PR: el job "Validar migraciones y funciones" es la compuerta de
"Aplicar migraciones", y si falla no se despliega nada.

## Fuera de alcance

Las notificaciones de correo y la configuracion de alertas no se siembran: salen de las
migraciones y de la aplicacion. Las alertas de vencimiento tampoco: las genera la rutina
programada (`supabase/functions/alertas-vencimiento`) sobre los lotes de arriba.
