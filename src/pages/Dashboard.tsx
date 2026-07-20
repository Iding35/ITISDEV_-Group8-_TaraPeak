
import { Navigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';


export default function MyPlans() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />
      <main className="max-w-7xl mx-auto px-margin-desktop py-lg">
        <h1 className="font-display-lg text-display-lg text-primary leading-tight mb-lg">My Trails</h1>

        
        
      </main>
    </div>
  );
}
