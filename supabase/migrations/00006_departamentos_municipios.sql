-- Crear tabla de departamentos
CREATE TABLE IF NOT EXISTS departamentos (
    id INT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

-- Crear tabla de municipios
CREATE TABLE IF NOT EXISTS municipios (
    id INT PRIMARY KEY,
    departamento_id INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    CONSTRAINT fk_departamentos FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE CASCADE
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipios ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir lectura pública
CREATE POLICY "Lectura publica departamentos" ON departamentos FOR SELECT USING (true);
CREATE POLICY "Lectura publica municipios" ON municipios FOR SELECT USING (true);