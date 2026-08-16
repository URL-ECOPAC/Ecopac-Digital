import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import PacientesPage from './pages/PacientesPage';
import DonacionesPage from './pages/DonacionesPage';
import InventarioPage from './pages/InventarioPage';
import PresupuestosPage from './pages/PresupuestosPage';
import ProyectosPage from './pages/ProyectosPage';
import ReportesPage from './pages/ReportesPage';
import JornadasPage from './pages/JornadasPage';
import VoluntariosPage from './pages/VoluntariosPage';

// Las rutas siguen la definicion unica de MODULOS en packages/shared/navegacion.js:
// si se agrega un modulo alli, hay que registrar aqui su ruta.
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta publica fuera del layout autenticado */}
        <Route path="/login" element={<LoginPage />} />

        {/* Rutas autenticadas con el layout principal */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/pacientes" element={<PacientesPage />} />
          <Route path="/donaciones" element={<DonacionesPage />} />
          <Route path="/inventario" element={<InventarioPage />} />
          <Route path="/presupuestos" element={<PresupuestosPage />} />
          <Route path="/proyectos" element={<ProyectosPage />} />
          <Route path="/reportes" element={<ReportesPage />} />
          <Route path="/jornadas" element={<JornadasPage />} />
          <Route path="/voluntarios" element={<VoluntariosPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
