import { useState, useEffect } from 'react';
import { BrowserRouter, Route, Routes, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Mountains from './pages/Mountains';
import PlanDetail from './pages/PlanDetail';
import Planner from './pages/Planner';
import Signup from './pages/Signup';
import TrailDetail from './pages/TrailDetail';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminReportsPage from './pages/AdminReportsPage'; 
import AdminUsersPage from './pages/AdminUsersPage';    
import PlanDetailCompleted from './pages/PlanDetailCompleted';

function AdminRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-8 text-gray-500">Loading...</div>;
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PlanRouteWrapper() {
  const { id } = useParams();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/plans/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setPlan(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="p-8 text-gray-500">Loading plan...</div>;
  }

  if (!plan) {
    return <Navigate to="/dashboard" replace />;
  }

  if (plan.is_completed) {
    return <Navigate to={`/plans/completed/${id}`} replace />;
  }

  return <PlanDetail />;
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
          
          {/* Explicit route for completed hikes */}
          <Route path="/plans/completed/:id" element={<PlanDetailCompleted />} />
          
          {/* Wrapper route for active/dynamic plan routing */}
          <Route path="/plans/:id" element={<PlanRouteWrapper />} />
          
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