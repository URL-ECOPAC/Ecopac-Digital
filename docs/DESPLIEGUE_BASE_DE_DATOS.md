# Scripts de base de datos finales - Ecopac Digital

Que scripts crean la base de datos de produccion, en que orden se aplican, que catalogos dejan
cargados desde el primer dia (departamentos, municipios y los demas) y como queda el administrador
inicial. Esta escrito para quien tenga que revisar o reconstruir la base sin leer las 181
migraciones una por una.

| | |
| --- | --- |
| Version | 2.0 |
| Fecha | 18 de octubre de 2026 |
| Base de referencia | `ecopac-prod`, migraciones `00001` a `00189` (181 archivos) |

## 1. Donde estan los scripts

| Que | Donde | Para que |
| --- | --- | --- |
| **Migraciones** | [`supabase/migrations/`](../supabase/migrations/) | **Son el script de la base.** Crean el esquema completo y siembran los catalogos y el administrador inicial. Es lo unico que se aplica a produccion |
| Esquema consolidado | [`supabase/esquema-final.sql`](../supabase/esquema-final.sql) | Referencia de lectura: el esquema `public` completo de produccion en un solo archivo (tablas, vistas, funciones, triggers, politicas RLS y permisos), sin datos. **No se usa para instalar** |
| Datos de prueba | [`supabase/fixtures/datos-de-prueba.sql`](../supabase/fixtures/datos-de-prueba.sql) | Solo para el stack local y el CI. **Nunca** se carga en produccion ([DATOS-DE-PRUEBA.md](./DATOS-DE-PRUEBA.md)) |
| Descripcion de cada tabla y columna | [DICCIONARIO-DE-DATOS.md](./DICCIONARIO-DE-DATOS.md) | Generado desde la base |

## 2. Orden de aplicacion

Las migraciones se aplican **en orden numerico**, de la `00001` a la ultima. El numero de cinco
digitos es el orden: cada una supone que las anteriores ya corrieron.

No se aplican a mano. Al mergear un cambio a `main`, el workflow **Supabase**
(`.github/workflows/supabase.yml`) corre `supabase db push` contra `ecopac-prod` y aplica solo las
que faltan; Supabase anota cada una en `supabase_migrations.schema_migrations` y no la vuelve a
correr. En una base nueva y vacia las aplica todas, de la primera a la ultima. El recorrido completo
para instalar desde cero esta en [MANUAL-DE-INSTALACION.md](./MANUAL-DE-INSTALACION.md), seccion 4.

Una migracion ya aplicada **no se edita**: los cambios entran como una migracion nueva con el
numero siguiente ([CI-CD.md](./CI-CD.md)).

## 3. Departamentos y municipios

| Migracion | Que hace |
| --- | --- |
| [`00006_departamentos_municipios.sql`](../supabase/migrations/00006_departamentos_municipios.sql) | Crea las tablas `departamentos` y `municipios` |
| [`00008_ajustes_departamentos_municipios.sql`](../supabase/migrations/00008_ajustes_departamentos_municipios.sql) | Evita nombres repetidos: un departamento por nombre y un municipio por nombre dentro de su departamento |
| [`00073_grant_lectura_departamentos_municipios.sql`](../supabase/migrations/00073_grant_lectura_departamentos_municipios.sql) | Permite que cualquier usuario con sesion los lea |
| [`00125_sembrar_catalogo_geografico.sql`](../supabase/migrations/00125_sembrar_catalogo_geografico.sql) | **Siembra los 22 departamentos y los 340 municipios de Guatemala** |

Los identificadores son fijos (no se generan al insertar), para que las comunidades que se
registren despues siempre apunten al mismo municipio. La `00125` es idempotente: correrla sobre una
base que ya tiene el catalogo no escribe nada.

Las **comunidades** no se siembran: las registra la organizacion desde la web, cada una dentro de
su municipio.

## 4. Administrador inicial

| Migracion | Que hace |
| --- | --- |
| [`00063_aprovisionar_primer_admin.sql`](../supabase/migrations/00063_aprovisionar_primer_admin.sql) | Creaba un primer administrador con una direccion provisional. Queda en el historial porque las migraciones aplicadas no se borran; su efecto lo retira la `00189` |
| [`00188_aprovisionar_admin_produccion_ecopac.sql`](../supabase/migrations/00188_aprovisionar_admin_produccion_ecopac.sql) | **Crea el administrador definitivo, `ecopac.digital@gmail.com`**, con el rol `administrador` y el correo confirmado |
| [`00189_retirar_admin_heredado_de_la_00063.sql`](../supabase/migrations/00189_retirar_admin_heredado_de_la_00063.sql) | Borra la cuenta provisional de la `00063`. La base queda con **un solo usuario** |

**La contrasena no esta en ningun script.** La `00188` crea la cuenta sin contrasena. El primer
ingreso se hace con "Olvide mi contrasena" en la pantalla de inicio de sesion, que manda el enlace
al correo de la organizacion. Desde esa cuenta se invita a las demas personas (Colaboradores >
Nueva persona), y cada una fija su propia contrasena desde el correo de bienvenida.

## 5. Catalogos que quedan cargados

Lo que la base trae el primer dia, sin que nadie cargue nada. Las cifras son las de `ecopac-prod`
al 18 de octubre de 2026.

| Catalogo | Tabla | Filas | Migracion | Contenido |
| --- | --- | --- | --- | --- |
| Departamentos | `departamentos` | 22 | 00125 | Los de Guatemala |
| Municipios | `municipios` | 340 | 00125 | Los de Guatemala, cada uno en su departamento |
| Permisos | `permisos`, `rol_permiso` | 11 y 17 | 00003, 00037, 00148, 00162, 00185 | Acciones finas y modulos que ve cada rol ([PERMISOS.md](./PERMISOS.md)) |
| Diagnosticos | `diagnosticos` | 37 | 00105 | Los diagnosticos mas frecuentes en las jornadas, con su codigo CIE-10 |
| Condiciones cronicas | `condiciones_cronicas` | 5 | 00010 | Diabetes, hipertension, asma, epilepsia y desnutricion |
| Idiomas | `idiomas` | 4 | 00110 | Espanol, K'iche', Mam y Otro |
| Presentaciones | `presentaciones` | 7 | 00144 | Tableta, jarabe, capsula, inyectable, pomada, gotas oftalmicas y gotas oticas |
| Categorias de gasto | `categorias_de_gasto` | 6 | 00158 | Medicamentos, logistica, diagnostico, honorarios, educacion e infraestructura |
| Areas de atencion | `areas_atencion` | 3 | 00182 | Medicina general, odontologia y psicologia |
| Bodega | `bodegas` | 1 | 00017 | La Bodega Principal |
| Alertas de vencimiento | `configuracion_alertas_caducidad` | 1 | 00162 | Aviso a los 90 dias del vencimiento; se cambia desde Inventario |

Todos se amplian desde la web, sin tocar la base. **No se siembran** y los carga la organizacion:
comunidades, medicamentos e insumos, proveedores y donantes, proyectos, jornadas y pacientes.

## 6. Por que ningun seed corre en produccion

`supabase db push`, lo unico que corre contra `ecopac-prod` y `ecopac-dev`, solo aplica
migraciones. Los datos de prueba (`supabase/fixtures/datos-de-prueba.sql`) los carga el stack
local y el CI, que se borran despues de cada corrida. Por eso todo lo que el sistema necesita para
funcionar el primer dia esta en una migracion: un catalogo que viviera en un seed no llegaria
nunca a produccion.

## 7. Como se comprueba

En el SQL Editor de Supabase, sobre `ecopac-prod`:

```sql
select max(version) as ultima, count(*) as aplicadas
from supabase_migrations.schema_migrations;          -- 00189 y 181

select (select count(*) from public.departamentos) as departamentos,  -- 22
       (select count(*) from public.municipios)    as municipios,     -- 340
       (select count(*) from auth.users)           as usuarios;       -- 1 antes de invitar a nadie

select u.email, p.rol
from auth.users u join public.perfiles p on p.id = u.id;  -- ecopac.digital@gmail.com, administrador
```

El workflow **Verificar despliegue** hace la primera comprobacion todos los dias y abre una issue
si a la base le falta alguna migracion.

## 8. El esquema consolidado

[`supabase/esquema-final.sql`](../supabase/esquema-final.sql) es el volcado del esquema `public` de
`ecopac-prod` (`pg_dump --schema-only`), tomado el 18 de octubre de 2026 con la migracion `00189`
como ultima. Sirve para leer el esquema completo en un solo archivo o compararlo con otra base.

No sirve para instalar: no trae los catalogos, ni lo que las migraciones configuran fuera de
`public` (Auth, Storage, Vault), ni deja la base anotada en `schema_migrations`, asi que un
`db push` posterior intentaria aplicar todas las migraciones encima. Se vuelve a generar cuando
cambia el esquema, con el mismo comando y la fecha y la migracion nuevas en su cabecera.
