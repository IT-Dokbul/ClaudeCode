import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './app/Layout';
import DashboardPage from './features/payroll/DashboardPage';
import EntriesPage from './features/work-entry/EntriesPage';
import PayrollPage from './features/payroll/PayrollPage';
import WagesPage from './features/wage-rates/WagesPage';
import SettingsPage from './features/settings/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="entries" element={<EntriesPage />} />
          <Route path="payroll" element={<PayrollPage />} />
          <Route path="wages" element={<WagesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
