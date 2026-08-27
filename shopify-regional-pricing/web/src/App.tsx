import { Frame } from '@shopify/polaris';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RegionsPage } from './pages/RegionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { HealthPage } from './pages/HealthPage';
import { WizardPage } from './pages/WizardPage';

export function App() {
  return (
    <Frame>
      <Routes>
        <Route path="/" element={<Navigate to="/regions" replace />} />
        <Route path="/regions" element={<RegionsPage />} />
        <Route path="/regions/new" element={<WizardPage />} />
        <Route path="/regions/:regionId/edit" element={<WizardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="*" element={<Navigate to="/regions" replace />} />
      </Routes>
    </Frame>
  );
}
