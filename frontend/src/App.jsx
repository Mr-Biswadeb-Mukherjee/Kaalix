import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import MainLayout from './Layout/MainLayout';
import * as Pages from './pages';

function RouteWrapper({ title, children }) {
  useEffect(() => {
    document.title = title || 'Amon';
  }, [title]);

  return children;
}

const routeConfig = [
  { path: '', element: <Pages.Dashboard />, title: 'Dashboard | Amon' },
  { path: 'target-config', element: <Pages.TargetConfig />, title: 'Target Config | Amon' },
  { path: 'attack-logic', element: <Pages.AttackLogic />, title: 'Attack Logic | Amon' },
  { path: 'modules', element: <Pages.Modules />, title: 'Modules | Amon' },
  { path: 'proxy', element: <Pages.Proxy />, title: 'Proxy | Amon' },
  { path: 'about', element: <Pages.AboutUs />, title: 'About Us | Amon' },
  { path: 'docs', element: <Pages.Documentation />, title: 'Documentation | Amon' },
  { path: 'settings', element: <Pages.Settings />, title: 'Settings | Amon' },
];

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          {routeConfig.map(({ path, element, title }) => (
            <Route
              key={path}
              path={path}
              index={path === ''}
              element={<RouteWrapper title={title}>{element}</RouteWrapper>}
            />
          ))}
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
