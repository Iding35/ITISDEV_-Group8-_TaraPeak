import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />
      <main className="mx-auto max-w-md px-margin-desktop py-xl">
        <h1 className="font-headline-lg text-headline-lg text-primary mb-md">Log in</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-base">
          <label className="flex flex-col gap-1">
            <span className="font-label-md text-label-md text-on-surface-variant">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow font-body-md"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-label-md text-label-md text-on-surface-variant">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow font-body-md"
            />
          </label>

          {error && <p className="font-label-md text-label-md text-error">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 rounded-xl bg-primary px-md py-3 font-label-md text-label-md text-on-primary transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-60"
          >
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-md font-body-md text-on-surface-variant">
          Don't have an account?{' '}
          <Link to="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </main>
    </div>
  );
}
