import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import UsuariosPage from './pages/UsuariosPage';
import PacientesPage from './pages/PacientesPage';
import InventarioPage from './pages/InventarioPage';
import JornadasPage from './pages/JornadasPage';
import DonacionesPage from './pages/DonacionesPage';
import ReportesPage from './pages/ReportesPage';

// Layout base para rutas autenticadas (listo para integrar el Navbar/Sidebar en #51)
function MainLayout() {
  return (
    <main style={{ padding: '1rem' }}>
      <Outlet />
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública fuera del layout principal */}
        <Route path="/login" element={<LoginPage />} />

        {/* Rutas autenticadas agrupadas en MainLayout */}
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