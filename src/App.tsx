import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Mountains from './pages/Mountains';
import MyPlans from './pages/MyPlans';
import PlanDetail from './pages/PlanDetail';
import Planner from './pages/Planner';
import Signup from './pages/Signup';
import TrailDetail from './pages/TrailDetail';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminReportsPage from './pages/AdminReportsPage'; 
import AdminUsersPage from './pages/AdminUsersPage';    

function AdminRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-8 text-gray-500">Loading...</div>;
  }

  // Check if logged in and role is 'admin'
  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Mountains />} />
          <Route path="/trail/:id" element={<TrailDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/plans" element={<MyPlans />} />
          <Route path="/plans/:id" element={<PlanDetail />} />
          <Route path="/dashboard" element={<Dashboard />} />
          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <AdminRoute>
                <AdminReportsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <AdminUsersPage />
              </AdminRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}