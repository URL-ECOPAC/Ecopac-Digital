import { useCallback, useEffect, useState } from "react";
import { listarBodegas, listarExistenciasDisponibles, listarMedicamentos } from "@ecopac/shared";

import { ErrorState, LoadingState, ScreenContainer } from "../components";
import { CatalogoMedicamentosScreen } from "./CatalogoMedicamentosScreen";

// La traduccion de cada fila a lo que pinta la tarjeta vive en shared desde la #840
// (filaDeStock, useCatalogoMedicamentos.js): aqui solo se cargan los datos.

/**
 * Trae el inventario real y se lo pasa a CatalogoMedicamentosScreen.js.
 *
 * QUE ESTABA MAL. Este componente montaba <CatalogoMedicamentosScreen {...props} /> pasando tal
 * cual las props que entrega React Navigation a una pantalla de stack (solo `navigation` y
 * `route`). CatalogoMedicamentosScreen.js espera ademas `inventarioInicial` y `bodegas`, que
 * nunca llegaban: sus valores por defecto son arreglos vacios, asi que la pantalla "Inventario"
 * siempre se veia vacia sin importar lo que hubiera en la base -incluido un ingreso que se
 * acababa de aprobar. Nada llamaba a una API en todo el archivo.
 *
 * QUE HACE AHORA. Carga listarExistenciasDisponibles() (issue #165), listarBodegas() y
 * listarMedicamentos() al montar. Las dos primeras alimentan la lista y el filtro de bodega; la
 * tercera es la unica forma de calcular "Sin Stock" del KPI -vista_lotes_disponibles solo
 * devuelve lo que SI tiene existencia, asi que "cuantos medicamentos del catalogo no aparecen
 * ahi" es la resta contra el catalogo completo, no algo que se pueda sacar de la lista filtrada.
 *
 * Solo se ven aqui los lotes con existencia positiva y no vencidos (vista_lotes_disponibles,
 * 00047): un movimiento que sigue 'pendiente' de validacion no ajusta existencias todavia, asi
 * que no aparece hasta que la administradora lo aprueba -eso es correcto, no un defecto de esta
 * pantalla.
 */
export default function StockScreen(props) {
  const [inventario, setInventario] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [medicamentosSinStock, setMedicamentosSinStock] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    const [respuestaExistencias, respuestaBodegas, respuestaMedicamentos] = await Promise.all([
      listarExistenciasDisponibles(),
      listarBodegas(),
      listarMedicamentos(),
    ]);

    const existencias = respuestaExistencias.existencias || [];
    const medicamentosConStock = new Set(existencias.map((fila) => fila.medicamentoId));
    const totalDelCatalogo = (respuestaMedicamentos.medicamentos || []).length;

    setInventario(existencias);
    setBodegas(respuestaBodegas.bodegas || []);
    setMedicamentosSinStock(Math.max(0, totalDelCatalogo - medicamentosConStock.size));
    setError(
      respuestaExistencias.error ?? respuestaBodegas.error ?? respuestaMedicamentos.error ?? null,
    );
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando) {
    return (
      <ScreenContainer>
        <LoadingState message="Cargando inventario..." />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <ErrorState message={error.mensaje} onRetry={cargar} />
      </ScreenContainer>
    );
  }

  return (
    <CatalogoMedicamentosScreen
      {...props}
      inventarioInicial={inventario}
      bodegas={bodegas}
      medicamentosSinStock={medicamentosSinStock}
    />
  );
}
