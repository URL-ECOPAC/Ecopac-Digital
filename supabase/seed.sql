-- Cargar Departamentos de Guatemala
INSERT INTO departamentos (id, nombre) VALUES
  (1, 'Guatemala'),
  (2, 'El Progreso'),
  (3, 'Sacatepéquez'),
  (4, 'Chimaltenango'),
  (5, 'Escuintla'),
  (6, 'Santa Rosa'),
  (7, 'Sololá'),
  (8, 'Totonicapán'),
  (9, 'Quetzaltenango'),
  (10, 'Suchitepéquez'),
  (11, 'Retalhuleu'),
  (12, 'San Marcos'),
  (13, 'Huehuetenango'),
  (14, 'Quiché'),
  (15, 'Baja Verapaz'),
  (16, 'Alta Verapaz'),
  (17, 'Petén'),
  (18, 'Izabal'),
  (19, 'Zacapa'),
  (20, 'Chiquimula'),
  (21, 'Jalapa'),
  (22, 'Jutiapa')
ON CONFLICT (id) DO NOTHING;

-- Cargar Municipios (Ejemplos principales)
INSERT INTO municipios (id, departamento_id, nombre) VALUES
  (101, 1, 'Guatemala'),
  (102, 1, 'Santa Catarina Pinula'),
  (103, 1, 'San José Pinula'),
  (901, 9, 'Quetzaltenango'),
  (902, 9, 'Salcajá'),
  (903, 9, 'Olintepeque')
ON CONFLICT (id) DO NOTHING;