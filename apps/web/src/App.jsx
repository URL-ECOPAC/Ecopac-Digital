import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import UsuariosPage from './pages/UsuariosPage';
import PacientesPage from './pages/PacientesPage';
import InventarioPage from './pages/InventarioPage';
import JornadasPage from './pages/JornadasPage';
import DonacionesPage from './pages/DonacionesPage';
import ReportesPage from './pages/ReportesPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública fuera del layout autenticado */}
        <Route path="/login" element={<LoginPage />} />

        {/* Rutas autenticadas con el layout principal */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/usuarios" element={<UsuariosPage />} />
          <Route path="/pacientes" element={<PacientesPage />} />
          <Route path="/inventario" element={<InventarioPage />} />
          <Route path="/jornadas" element={<JornadasPage />} />
          <Route path="/donaciones" element={<DonacionesPage />} />
          <Route path="/reportes" element={<ReportesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}