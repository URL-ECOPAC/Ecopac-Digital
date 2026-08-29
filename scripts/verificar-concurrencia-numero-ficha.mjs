#!/usr/bin/env node
// Prueba manual de concurrencia real para numero_ficha (issue #114, migracion 00078).
//
// pgTAP (supabase/tests/database/) corre en una sola sesion/transaccion y no puede probar dos
// conexiones simultaneas de verdad. Este script si abre conexiones paralelas reales contra el
// Postgres local que levanta `supabase start` (puerto 54322, ver supabase/config.toml) y llama
// fn_registrar_paciente() al mismo tiempo desde varias de ellas, para comprobar que
// expedientes_numero_ficha_seq (00078) nunca reparte el mismo numero_ficha dos veces.
//
// Manual y local: no corre en npm test ni en CI (no hay un Postgres real disponible ahi para
// esto, igual que db-local en docker-compose.yml es un paso opcional). Requiere `supabase
// start` corriendo. Se conecta como el superusuario local (postgres), que de por si evita RLS:
// el objetivo es probar la secuencia, no las politicas (esas ya las cubre el pgTAP existente).
//
// Uso: npm run verificar:concurrencia-ficha

import pg from "pg";

const CONEXION =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@localhost:54322/postgres";
const COMUNIDAD_DE_PRUEBA_ID = "40000000-0000-0000-0000-000000000001";
const CANTIDAD_DE_REGISTROS_EN_PARALELO = 20;

async function prepararComunidad(pool) {
  await pool.query(
    `INSERT INTO comunidades (id, municipio_id, nombre)
     VALUES ($1, 101, 'Comunidad de prueba - concurrencia numero_ficha')
     ON CONFLICT (id) DO NOTHING`,
    [COMUNIDAD_DE_PRUEBA_ID],
  );
}

async function registrarUnPaciente(pool, indice) {
  const telefono = `5555-30${String(indice).padStart(2, "0")}`;
  const { rows } = await pool.query(
    `SELECT id, numero_ficha
     FROM fn_registrar_paciente($1, $2, '1990-01-01', 'F', $3, $4, 'espanol')`,
    ["Concurrencia", `Prueba ${indice}`, COMUNIDAD_DE_PRUEBA_ID, telefono],
  );
  return rows[0];
}

async function limpiar(pool, idsDePacientes) {
  // expedientes.paciente_id referencia pacientes con ON DELETE RESTRICT (00009): hay que
  // borrar el expediente antes que el paciente, no al reves. impedir_borrado_fisico_paciente()
  // (migracion 00026) bloquea el DELETE fisico sobre pacientes para cualquier rol, incluido
  // este superusuario: hay que desactivar los triggers de usuario para la limpieza de datos de
  // prueba, mismo patron que ya usan los fixtures pgTAP (ALTER TABLE ... DISABLE TRIGGER USER).
  if (idsDePacientes.length > 0) {
    await pool.query(`DELETE FROM expedientes WHERE paciente_id = ANY($1::uuid[])`, [idsDePacientes]);
    await pool.query(`ALTER TABLE pacientes DISABLE TRIGGER USER`);
    try {
      await pool.query(`DELETE FROM pacientes WHERE id = ANY($1::uuid[])`, [idsDePacientes]);
    } finally {
      await pool.query(`ALTER TABLE pacientes ENABLE TRIGGER USER`);
    }
  }
  await pool.query(`DELETE FROM comunidades WHERE id = $1`, [COMUNIDAD_DE_PRUEBA_ID]);
}

async function main() {
  const pool = new pg.Pool({ connectionString: CONEXION, max: CANTIDAD_DE_REGISTROS_EN_PARALELO });
  let filas = [];

  try {
    await prepararComunidad(pool);

    filas = await Promise.all(
      Array.from({ length: CANTIDAD_DE_REGISTROS_EN_PARALELO }, (_, indice) =>
        registrarUnPaciente(pool, indice),
      ),
    );

    const numerosDeFicha = filas.map((fila) => fila.numero_ficha);
    const distintos = new Set(numerosDeFicha);

    if (distintos.size !== numerosDeFicha.length) {
      console.error(
        `COLISION: se generaron ${numerosDeFicha.length} fichas pero solo ${distintos.size} son distintas.`,
      );
      console.error([...numerosDeFicha].sort());
      process.exitCode = 1;
      return;
    }

    console.log(
      `OK: ${numerosDeFicha.length} registros en paralelo, ${distintos.size} numero_ficha distintos.`,
    );
    console.log([...numerosDeFicha].sort());
  } finally {
    await limpiar(
      pool,
      filas.map((fila) => fila?.id).filter(Boolean),
    );
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Error al verificar la concurrencia de numero_ficha:", error);
  process.exitCode = 1;
});
