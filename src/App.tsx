import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import Captura from './screens/Captura/Captura';
import Galeria from './screens/Galeria/Galeria';
import Lugar from './screens/Lugar/Lugar';
import Config from './screens/Config/Config';
import TabBar from './components/TabBar';
import { ensureBuiltinTags } from './db';

const Mapa = lazy(() => import('./screens/Mapa/Mapa'));

const TAB_PATHS = new Set(['/', '/galeria', '/mapa']);

function Shell() {
  const location = useLocation();
  const showTabBar = TAB_PATHS.has(location.pathname);

  return (
    <div className="app-shell">
      <div className="screen" key={location.pathname}>
        <Suspense fallback={null}>
          <Routes location={location}>
            <Route path="/" element={<Captura />} />
            <Route path="/galeria" element={<Galeria />} />
            <Route path="/mapa" element={<Mapa />} />
            <Route path="/lugar/:id" element={<Lugar />} />
            <Route path="/config" element={<Config />} />
          </Routes>
        </Suspense>
      </div>
      {showTabBar && <TabBar />}
    </div>
  );
}

export default function App() {
  useEffect(() => {
    ensureBuiltinTags();
  }, []);

  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
