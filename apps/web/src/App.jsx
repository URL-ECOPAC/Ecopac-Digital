import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MODULOS } from '@ecopac/shared';
import { SesionProvider } from './contexto/SesionProvider';
import MainLayout from './components/MainLayout';
import RutaProtegida from './components/RutaProtegida';
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
import NotFoundPage from './pages/NotFoundPage';

// Las rutas siguen la definicion unica de MODULOS en packages/shared/navegacion.js:
// si se agrega un modulo alli, hay que registrar aqui su ruta.
//
// Y los roles permitidos de cada ruta salen de ese mismo MODULOS, no escritos a mano aqui:
// asi el sidebar y el guard no pueden discrepar. Esconder la opcion del menu no es control de
// acceso, y si las dos listas vivieran por separado acabarian diciendo cosas distintas.
const rolesDe = (ruta) => MODULOS.find((m) => m.ruta === ruta)?.roles ?? [];

export default function App() {
  return (
    <BrowserRouter>
      <SesionProvider>
        <Routes>
        {/* Ruta publica: el unico punto de entrada sin sesion */}
        <Route path="/login" element={<LoginPage />} />

        {/* Rutas autenticadas.
            El guard de sesion va POR ENCIMA de MainLayout: el layout dibuja el nombre y el rol
            de quien entro, asi que no puede montarse antes de saber si hay sesion. Los roles se
            comprueban despues, ruta por ruta, ya dentro del layout. */}
        <Route element={<RutaProtegida />}>
          <Route element={<MainLayout />}>
            <Route element={<RutaProtegida roles={rolesDe('/')} />}>
              <Route path="/" element={<HomePage />} />
            </Route>
            <Route element={<RutaProtegida roles={rolesDe('/pacientes')} />}>
              <Route path="/pacientes" element={<PacientesPage />} />
            </Route>
            <Route element={<RutaProtegida roles={rolesDe('/donaciones')} />}>
              <Route path="/donaciones" element={<DonacionesPage />} />
            </Route>
            <Route element={<RutaProtegida roles={rolesDe('/inventario')} />}>
              <Route path="/inventario" element={<InventarioPage />} />
            </Route>
            <Route element={<RutaProtegida roles={rolesDe('/presupuestos')} />}>
              <Route path="/presupuestos" element={<PresupuestosPage />} />
            </Route>
            <Route element={<RutaProtegida roles={rolesDe('/proyectos')} />}>
              <Route path="/proyectos" element={<ProyectosPage />} />
            </Route>
            <Route element={<RutaProtegida roles={rolesDe('/reportes')} />}>
              <Route path="/reportes" element={<ReportesPage />} />
            </Route>
            <Route element={<RutaProtegida roles={rolesDe('/jornadas')} />}>
              <Route path="/jornadas" element={<JornadasPage />} />
            </Route>
            <Route element={<RutaProtegida roles={rolesDe('/voluntarios')} />}>
              <Route path="/voluntarios" element={<VoluntariosPage />} />
            </Route>

            {/* La 404 queda dentro del layout y detras de la sesion, pero sin filtro de rol:
              una ruta que no existe no depende de permisos. */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        </Routes>
      </SesionProvider>
    </BrowserRouter>
  );
}
