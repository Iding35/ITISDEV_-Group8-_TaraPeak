import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Mountains from './pages/Mountains';
import MyPlans from './pages/MyPlans';
import Signup from './pages/Signup';
import TrailDetail from './pages/TrailDetail';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Mountains />} />
          <Route path="/trail/:id" element={<TrailDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/plans" element={<MyPlans />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
