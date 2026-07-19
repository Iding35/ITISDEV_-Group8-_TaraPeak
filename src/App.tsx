import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Mountains from './pages/Mountains';
import TrailDetail from './pages/TrailDetail';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Mountains />} />
        <Route path="/trail/:id" element={<TrailDetail />} />
      </Routes>
    </BrowserRouter>
  );
}
