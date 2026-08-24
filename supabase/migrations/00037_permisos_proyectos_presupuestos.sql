-- Ecopac Digital - Permisos de los modulos de proyectos y presupuestos
-- El seed de la 00003 cubre seis modulos (usuarios, pacientes, inventario, jornadas,
-- donaciones, reportes); proyectos y presupuestos son modulos propios de la
-- navegacion (packages/shared/navegacion.js) que quedaron fuera. La 00003 ya esta
-- aplicada y no se edita: este seed entra como archivo nuevo, mismo patron que uso la
-- 00010 (issue #71) para agregar permisos despues de la 00003 original.
--
-- modulo usa el mismo valor literal que el campo modulo de cada entrada de MODULOS en
-- packages/shared/navegacion.js ('proyectos', 'presupuestos'), no un nombre inventado
-- aqui: es lo que pide el DoD del issue #293.

INSERT INTO permisos (clave, modulo, descripcion) VALUES
  ('presupuestos.aprobar', 'presupuestos', 'Aprobar un gasto o presupuesto registrado por otra persona.'),
  ('presupuestos.registrar', 'presupuestos', 'Registrar un gasto o una solicitud de presupuesto.'),
  ('proyectos.gestionar', 'proyectos', 'Crear, editar o cerrar un proyecto sin ser administrador.');

-- El administrador tiene los tres por defecto, igual que el resto del catalogo (00003).
INSERT INTO rol_permiso (rol, permiso_id)
SELECT 'administrador', id FROM permisos
WHERE clave IN ('presupuestos.aprobar', 'presupuestos.registrar', 'proyectos.gestionar');

-- Junta directiva y socio fundador conservan solo lectura (DoD explicito): no reciben
-- ninguno de los tres. Ya tienen reportes.exportar de la 00003; no se agrega nada mas
-- aqui para ellos.
