import { BrowserRouter, Routes, Route } from 'react-router-dom';
import StoresPage from './features/stores/StoresPage';
import SchedulePage from './features/schedule/SchedulePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StoresPage />} />
        <Route path="/stores/:storeId" element={<SchedulePage />} />
      </Routes>
    </BrowserRouter>
  );
}
